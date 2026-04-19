import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";

import { IpfsStorageClient } from "../src/client.js";

function createJsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function createTextResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => JSON.parse(body),
    text: async () => body,
  };
}

test("publishFile posts add request and returns publish result", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "ipfs-client-"));
  const filePath = path.join(tempDir, "artifact.txt");
  await writeFile(filePath, "hello world\n", "utf8");

  const calls = [];
  const client = new IpfsStorageClient({
    apiBaseUrl: "http://127.0.0.1:5001/",
    gatewayBaseUrl: "http://127.0.0.1:8080/",
    defaultSourceProject: "bitlogic",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return createTextResponse('{"Name":"artifact.txt","Hash":"bafy-file","Size":"11"}\n');
    },
  });

  const result = await client.publishFile({
    filePath,
    metadata: { kind: "file" },
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/api\/v0\/add\?pin=true&wrap-with-directory=false$/);
  assert.equal(calls[0].options.method, "POST");
  assert.equal(result.cid, "bafy-file");
  assert.equal(result.name, "artifact.txt");
  assert.equal(result.size, 11);
  assert.equal(result.sourceProject, "bitlogic");
  assert.equal(result.gatewayUrl, "http://127.0.0.1:8080/ipfs/bafy-file");
  assert.deepEqual(result.metadata, { kind: "file" });
});

test("publishDirectory returns wrapped directory root record", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "ipfs-dir-"));
  const siteDir = path.join(tempDir, "site");
  await mkdir(siteDir, { recursive: true });
  await writeFile(path.join(siteDir, "index.html"), "<html></html>", "utf8");
  await mkdir(path.join(siteDir, "assets"), { recursive: true });
  await writeFile(path.join(siteDir, "assets", "app.js"), "console.log('ok')\n", "utf8");

  const calls = [];
  const client = new IpfsStorageClient({
    apiBaseUrl: "http://127.0.0.1:5001",
    gatewayBaseUrl: "http://127.0.0.1:8080",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return createTextResponse([
        '{"Name":"index.html","Hash":"bafy-index","Size":"12"}',
        '{"Name":"assets/app.js","Hash":"bafy-app","Size":"18"}',
        '{"Name":"site","Hash":"bafy-site","Size":"30"}',
      ].join("\n"));
    },
  });

  const result = await client.publishDirectory({
    directoryPath: siteDir,
    sourceProject: "crypto-directory",
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /wrap-with-directory=true$/);
  assert.equal(result.cid, "bafy-site");
  assert.equal(result.name, "site");
  assert.equal(result.size, 30);
  assert.equal(result.sourceProject, "crypto-directory");
});

test("publishJson emits json artifact through add endpoint", async () => {
  const calls = [];
  const client = new IpfsStorageClient({
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return createTextResponse('{"Name":"artifact.json","Hash":"bafy-json","Size":"44"}\n');
    },
  });

  const result = await client.publishJson({
    data: { ok: true },
    fileName: "artifact.json",
    sourceProject: "skillmesh",
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/api\/v0\/add\?pin=true&wrap-with-directory=false$/);
  assert.equal(result.cid, "bafy-json");
  assert.equal(result.sourceProject, "skillmesh");
});

test("client sends bearer auth headers to IPFS API requests", async () => {
  const calls = [];
  const client = new IpfsStorageClient({
    apiBearerToken: "token-123",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return createJsonResponse({ Pins: ["bafy-pin"] });
    },
  });

  await client.pinCid({ cid: "bafy-pin" });

  assert.equal(calls[0].options.headers.Authorization, "Bearer token-123");
});

test("client sends basic auth headers to IPFS API requests", async () => {
  const calls = [];
  const client = new IpfsStorageClient({
    apiBasicAuthUsername: "admin",
    apiBasicAuthPassword: "secret",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return createJsonResponse({ Pins: ["bafy-pin"] });
    },
  });

  await client.pinCid({ cid: "bafy-pin" });

  assert.equal(calls[0].options.headers.Authorization, "Basic " + Buffer.from("admin:secret", "utf8").toString("base64"));
});

test("client rejects partial basic auth configuration", () => {
  assert.throws(
    () => new IpfsStorageClient({ apiBasicAuthUsername: "admin" }),
    /IPFS API basic auth requires both IPFS_API_BASIC_AUTH_USERNAME and IPFS_API_BASIC_AUTH_PASSWORD/,
  );
});

test("pinCid and unpinCid call the expected RPC endpoints", async () => {
  const urls = [];
  const client = new IpfsStorageClient({
    fetchImpl: async (url) => {
      urls.push(url);
      return createJsonResponse({ Pins: ["bafy-pin"] });
    },
  });

  const pinned = await client.pinCid({ cid: "bafy-pin" });
  const unpinned = await client.unpinCid({ cid: "bafy-pin", recursive: false });

  assert.equal(pinned.pinned, true);
  assert.equal(unpinned.pinned, false);
  assert.match(urls[0], /\/api\/v0\/pin\/add\?arg=bafy-pin&recursive=true$/);
  assert.match(urls[1], /\/api\/v0\/pin\/rm\?arg=bafy-pin&recursive=false$/);
});

test("checkCidHealth falls back from HEAD to GET when needed", async () => {
  const calls = [];
  const client = new IpfsStorageClient({
    gatewayBaseUrl: "http://127.0.0.1:8080",
    fetchImpl: async (url, options) => {
      calls.push({ url, method: options.method });
      if (options.method === "HEAD") {
        return { ok: false, status: 405 };
      }
      return { ok: true, status: 200 };
    },
  });

  const result = await client.checkCidHealth({ cid: "bafy-health", path: "meta.json" });

  assert.deepEqual(calls, [
    { url: "http://127.0.0.1:8080/ipfs/bafy-health/meta.json", method: "HEAD" },
    { url: "http://127.0.0.1:8080/ipfs/bafy-health/meta.json", method: "GET" },
  ]);
  assert.equal(result.available, true);
  assert.equal(result.status, 200);
});

test("resolveCid returns gateway URL and health status", async () => {
  const client = new IpfsStorageClient({
    gatewayBaseUrl: "http://127.0.0.1:8080",
    fetchImpl: async () => ({ ok: true, status: 200 }),
  });

  const result = await client.resolveCid({ cid: "bafy-resolve", path: "/artifact.json" });

  assert.equal(result.gatewayUrl, "http://127.0.0.1:8080/ipfs/bafy-resolve/artifact.json");
  assert.equal(result.available, true);
  assert.equal(result.status, 200);
});

test("checkNodeHealth returns version and node id when RPC calls succeed", async () => {
  const calls = [];
  const client = new IpfsStorageClient({
    fetchImpl: async (url) => {
      calls.push(url);
      if (url.includes("/version")) {
        return createJsonResponse({ Version: "0.30.0" });
      }
      return createJsonResponse({ ID: "node-abc" });
    },
  });

  const result = await client.checkNodeHealth();

  assert.equal(result.available, true);
  assert.equal(result.version, "0.30.0");
  assert.equal(result.id, "node-abc");
  assert.equal(calls.length, 2);
});

test("ensurePinned polls until the cid appears", async () => {
  let attempts = 0;
  const client = new IpfsStorageClient({
    fetchImpl: async () => {
      attempts += 1;
      if (attempts < 3) {
        return createJsonResponse({ Keys: {} });
      }
      return createJsonResponse({ Keys: { "bafy-pinned": { Type: "recursive" } } });
    },
  });

  const result = await client.ensurePinned("bafy-pinned", { timeoutMs: 1200 });

  assert.equal(result.pinned, true);
  assert.equal(attempts, 3);
});

test("ensurePinned returns false when polling never finds the cid", async () => {
  const client = new IpfsStorageClient({
    fetchImpl: async () => createJsonResponse({ Keys: {} }),
  });

  const result = await client.ensurePinned("bafy-missing", { timeoutMs: 10 });

  assert.equal(result.pinned, false);
  assert.equal(result.cid, "bafy-missing");
});
