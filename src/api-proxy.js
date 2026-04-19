import http from "node:http";

import { getIpfsStorageConfig } from "./config.js";

function isTruthyEnvFlag(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function readBearerToken(env) {
  return String(env.IPFS_API_BEARER_TOKEN || "").trim();
}

function readSecondaryBearerToken(env) {
  return String(env.IPFS_API_BEARER_TOKEN_SECONDARY || "").trim();
}

function readBasicAuth(env) {
  return {
    username: String(env.IPFS_API_BASIC_AUTH_USERNAME || "").trim(),
    password: String(env.IPFS_API_BASIC_AUTH_PASSWORD || "").trim(),
  };
}

export function getIpfsApiProxyAuthMode(env = process.env) {
  if (readBearerToken(env)) {
    return "bearer";
  }

  const { username, password } = readBasicAuth(env);
  if (username && password) {
    return "basic";
  }

  if (isTruthyEnvFlag(env.ALLOW_PUBLIC_IPFS_API_WITHOUT_AUTH)) {
    return "public-override";
  }

  return "none";
}

export function authorizeIpfsApiProxyRequest(headers, env = process.env) {
  const authMode = getIpfsApiProxyAuthMode(env);
  if (authMode === "public-override") {
    return { ok: true, authMode };
  }

  const authorization = String(headers.authorization || "").trim();

  if (authMode === "bearer") {
    const acceptedValues = [readBearerToken(env), readSecondaryBearerToken(env)]
      .filter(Boolean)
      .map((token) => `Bearer ${token}`);

    if (acceptedValues.includes(authorization)) {
      return { ok: true, authMode };
    }
    return {
      ok: false,
      authMode,
      statusCode: 401,
      message: "Missing or invalid bearer token for IPFS API proxy.",
    };
  }

  if (authMode === "basic") {
    const { username, password } = readBasicAuth(env);
    const expected = "Basic " + Buffer.from(`${username}:${password}`, "utf8").toString("base64");
    if (authorization === expected) {
      return { ok: true, authMode };
    }
    return {
      ok: false,
      authMode,
      statusCode: 401,
      message: "Missing or invalid basic auth credentials for IPFS API proxy.",
    };
  }

  return {
    ok: false,
    authMode,
    statusCode: 500,
    message:
      "IPFS API proxy auth is not configured. Set IPFS_API_BEARER_TOKEN, both IPFS_API_BASIC_AUTH variables, or ALLOW_PUBLIC_IPFS_API_WITHOUT_AUTH=1.",
  };
}

function buildForwardUrl(requestUrl, upstreamBaseUrl) {
  const incomingUrl = new URL(requestUrl, "http://127.0.0.1");
  return new URL(`${incomingUrl.pathname}${incomingUrl.search}`, upstreamBaseUrl).toString();
}

function filterResponseHeaders(headers) {
  const filtered = {};

  for (const [key, value] of headers.entries()) {
    if (key.toLowerCase() === "content-length") {
      continue;
    }
    filtered[key] = value;
  }

  return filtered;
}

export function createIpfsApiProxyServer({
  env = process.env,
  fetchImpl = globalThis.fetch,
  upstreamBaseUrl = getIpfsStorageConfig(env).apiProxyUpstreamUrl,
  host = "127.0.0.1",
  port = Number.parseInt(getIpfsStorageConfig(env).apiProxyPort, 10) || 5002,
  stdout = console.log,
  stderr = console.error,
} = {}) {
  const server = http.createServer(async (req, res) => {
    const authorization = authorizeIpfsApiProxyRequest(req.headers, env);

    if (!authorization.ok) {
      res.writeHead(authorization.statusCode, {
        "content-type": "application/json; charset=utf-8",
        "www-authenticate": authorization.authMode === "basic" ? 'Basic realm="IPFS API"' : "Bearer",
      });
      res.end(JSON.stringify({ error: authorization.message }));
      return;
    }

    const bodyChunks = [];
    for await (const chunk of req) {
      bodyChunks.push(chunk);
    }
    const body = bodyChunks.length > 0 ? Buffer.concat(bodyChunks) : undefined;

    const upstreamUrl = buildForwardUrl(req.url || "/", upstreamBaseUrl);

    try {
      const upstreamResponse = await fetchImpl(upstreamUrl, {
        method: req.method || "GET",
        headers: req.headers,
        body,
        duplex: body ? "half" : undefined,
      });

      res.writeHead(upstreamResponse.status, filterResponseHeaders(upstreamResponse.headers));
      const responseBytes = Buffer.from(await upstreamResponse.arrayBuffer());
      res.end(responseBytes);
    } catch (error) {
      stderr(
        error instanceof Error
          ? `ipfs-api-proxy:upstream-error ${error.message}`
          : "ipfs-api-proxy:upstream-error unknown"
      );
      res.writeHead(502, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "IPFS API proxy could not reach the upstream Kubo API." }));
    }
  });

  return {
    host,
    port,
    upstreamBaseUrl,
    server,
    listen() {
      return new Promise((resolve) => {
        server.listen(port, host, () => {
          stdout(`ipfs-api-proxy:listening http://${host}:${port} -> ${upstreamBaseUrl}`);
          resolve({ host, port, upstreamBaseUrl });
        });
      });
    },
  };
}
