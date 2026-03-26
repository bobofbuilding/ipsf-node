import test from "node:test";
import assert from "node:assert/strict";

import { extractJsonObject, summarizeSmokeOutput } from "../scripts/smoke-bittrees.mjs";

test("extractJsonObject returns trailing JSON payload from noisy output", () => {
  const payload = extractJsonObject('> npm run something\nnoise\n{\n  "cid": "bafy123",\n  "gatewayUrl": "http://127.0.0.1:8080/ipfs/bafy123"\n}\n');
  assert.deepEqual(payload, {
    cid: "bafy123",
    gatewayUrl: "http://127.0.0.1:8080/ipfs/bafy123",
  });
});

test("summarizeSmokeOutput parses crypto-directory style line output", () => {
  const summary = summarizeSmokeOutput(
    "crypto-directory",
    [
      "Publishing site/ to IPFS through the shared storage contract...",
      "CID: bafy-line",
      "Pinned: yes",
      "Gateway available: yes",
      "",
      "Gateway URL:",
      "http://127.0.0.1:8080/ipfs/bafy-line/",
    ].join("\n"),
    0,
  );

  assert.equal(summary.customer, "crypto-directory");
  assert.equal(summary.ok, true);
  assert.equal(summary.cid, "bafy-line");
  assert.equal(summary.pinned, true);
  assert.equal(summary.gatewayAvailable, true);
  assert.equal(summary.gatewayUrl, "http://127.0.0.1:8080/ipfs/bafy-line/");
});

test("summarizeSmokeOutput parses JSON adapter output", () => {
  const summary = summarizeSmokeOutput(
    "nftfactory",
    '{\n  "cid": "bafy-json",\n  "artifactKind": "nft-metadata-json",\n  "gatewayUrl": "http://127.0.0.1:8080/ipfs/bafy-json",\n  "verified": true,\n  "pinStatus": { "pinned": true },\n  "health": { "available": true }\n}\n',
    0,
  );

  assert.equal(summary.customer, "nftfactory");
  assert.equal(summary.ok, true);
  assert.equal(summary.cid, "bafy-json");
  assert.equal(summary.pinned, true);
  assert.equal(summary.gatewayAvailable, true);
  assert.equal(summary.gatewayUrl, "http://127.0.0.1:8080/ipfs/bafy-json");
  assert.equal(summary.artifactKind, "nft-metadata-json");
});

test("summarizeSmokeOutput preserves failing exit code", () => {
  const summary = summarizeSmokeOutput("skillmesh", "ipfs-node:unavailable\nfetch failed\n", 1);
  assert.equal(summary.ok, false);
  assert.equal(summary.exitCode, 1);
  assert.equal(summary.cid, null);
});
