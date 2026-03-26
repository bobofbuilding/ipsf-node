import test from "node:test";
import assert from "node:assert/strict";

import { buildGatewayUrl, normalizeIpfsCid, resolveJsonFromGateway } from "../src/gateway.js";

test("normalizeIpfsCid removes ipfs protocol and path prefixes", () => {
  assert.equal(normalizeIpfsCid("ipfs://bafy123"), "bafy123");
  assert.equal(normalizeIpfsCid("/ipfs/bafy123"), "bafy123");
  assert.equal(normalizeIpfsCid("ipfs/bafy123"), "bafy123");
});

test("buildGatewayUrl returns a gateway ipfs path", () => {
  assert.equal(
    buildGatewayUrl({
      gatewayBaseUrl: "http://127.0.0.1:8080/",
      cid: "ipfs://bafy123",
      path: "/dir/file.json",
    }),
    "http://127.0.0.1:8080/ipfs/bafy123/dir/file.json",
  );
});

test("resolveJsonFromGateway uses the normalized gateway url", async () => {
  const calls = [];
  const result = await resolveJsonFromGateway({
    gatewayBaseUrl: "http://127.0.0.1:8080",
    cid: "/ipfs/bafy123",
    path: "artifact.json",
    fetchImpl: async (url) => {
      calls.push(url);
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      };
    },
  });

  assert.deepEqual(calls, ["http://127.0.0.1:8080/ipfs/bafy123/artifact.json"]);
  assert.equal(result.ok, true);
  assert.deepEqual(result.data, { ok: true });
});
