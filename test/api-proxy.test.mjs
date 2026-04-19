import test from "node:test";
import assert from "node:assert/strict";

import { authorizeIpfsApiProxyRequest, createIpfsApiProxyServer, getIpfsApiProxyAuthMode } from "../src/api-proxy.js";

test("proxy auth mode prefers bearer tokens", () => {
  assert.equal(getIpfsApiProxyAuthMode({ IPFS_API_BEARER_TOKEN: "token" }), "bearer");
  assert.equal(
    getIpfsApiProxyAuthMode({
      IPFS_API_BASIC_AUTH_USERNAME: "admin",
      IPFS_API_BASIC_AUTH_PASSWORD: "secret",
    }),
    "basic"
  );
  assert.equal(getIpfsApiProxyAuthMode({ ALLOW_PUBLIC_IPFS_API_WITHOUT_AUTH: "1" }), "public-override");
  assert.equal(getIpfsApiProxyAuthMode({}), "none");
});

test("proxy rejects missing bearer auth", () => {
  const result = authorizeIpfsApiProxyRequest({}, { IPFS_API_BEARER_TOKEN: "token-123" });
  assert.equal(result.ok, false);
  assert.equal(result.statusCode, 401);
});

test("proxy accepts valid bearer auth", () => {
  const result = authorizeIpfsApiProxyRequest(
    { authorization: "Bearer token-123" },
    { IPFS_API_BEARER_TOKEN: "token-123" }
  );
  assert.equal(result.ok, true);
  assert.equal(result.authMode, "bearer");
});

test("proxy accepts a configured secondary bearer token during rotation", () => {
  const result = authorizeIpfsApiProxyRequest(
    { authorization: "Bearer token-next" },
    {
      IPFS_API_BEARER_TOKEN: "token-current",
      IPFS_API_BEARER_TOKEN_SECONDARY: "token-next",
    }
  );
  assert.equal(result.ok, true);
  assert.equal(result.authMode, "bearer");
});

test("proxy forwards authenticated requests upstream", async () => {
  const calls = [];
  const proxy = createIpfsApiProxyServer({
    env: {
      IPFS_API_BEARER_TOKEN: "token-123",
      IPFS_API_PROXY_PORT: "0",
      IPFS_API_PROXY_UPSTREAM_URL: "http://127.0.0.1:5001",
    },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response('{"Version":"0.40.1"}', {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
    port: 0,
    stdout: () => {},
    stderr: () => {},
  });

  await proxy.listen();
  const address = proxy.server.address();
  const port = typeof address === "object" && address ? address.port : 0;

  const response = await fetch(`http://127.0.0.1:${port}/api/v0/version`, {
    method: "POST",
    headers: {
      Authorization: "Bearer token-123",
    },
  });

  assert.equal(response.status, 200);
  assert.equal(await response.text(), '{"Version":"0.40.1"}');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "http://127.0.0.1:5001/api/v0/version");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers.authorization, "Bearer token-123");

  await new Promise((resolve, reject) => {
    proxy.server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
});
