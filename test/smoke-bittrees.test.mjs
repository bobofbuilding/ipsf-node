import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSmokeReport,
  extractJsonObject,
  parseSmokeArgs,
  runSmokeBittrees,
  selectCustomers,
  summarizeSmokeOutput,
} from "../scripts/smoke-bittrees.mjs";

test("parseSmokeArgs detects json mode, continue-on-error, and selected customers", () => {
  assert.deepEqual(parseSmokeArgs([]), { json: false, continueOnError: false, selectedCustomers: [] });
  assert.deepEqual(parseSmokeArgs(["--json"]), { json: true, continueOnError: true, selectedCustomers: [] });
  assert.deepEqual(parseSmokeArgs(["--continue-on-error"]), { json: false, continueOnError: true, selectedCustomers: [] });
  assert.deepEqual(parseSmokeArgs(["--customer", "nftfactory"]), {
    json: false,
    continueOnError: false,
    selectedCustomers: ["nftfactory"],
  });
  assert.deepEqual(parseSmokeArgs(["--customers=skillmesh,nftfactory"]), {
    json: false,
    continueOnError: false,
    selectedCustomers: ["skillmesh", "nftfactory"],
  });
});

test("selectCustomers filters known customer names and reports invalid ones", () => {
  const { selected, invalid } = selectCustomers(
    [{ name: "crypto-directory" }, { name: "nftfactory" }],
    ["nftfactory", "missing"],
  );

  assert.deepEqual(selected, [{ name: "nftfactory" }]);
  assert.deepEqual(invalid, ["missing"]);
});

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

test("buildSmokeReport produces machine-readable summary shape", () => {
  const report = buildSmokeReport(
    { available: true, version: "0.30.0", id: "node-123" },
    [
      { customer: "crypto-directory", ok: true, cid: "bafy1" },
      { customer: "skillmesh", ok: false, cid: null },
    ],
  );

  assert.equal(report.ok, false);
  assert.equal(report.node.version, "0.30.0");
  assert.equal(report.customers.length, 2);
  assert.equal(typeof report.checkedAt, "string");
});

test("runSmokeBittrees stops on first failure by default", async () => {
  const seen = [];
  const exitCode = await runSmokeBittrees({
    json: true,
    continueOnError: false,
    stdout: () => {},
    stderr: () => {},
    client: { checkNodeHealth: async () => ({ available: true, version: "0.30.0", id: "node-123" }) },
    customers: [{ name: "one" }, { name: "two" }],
    runCustomer: async (customer) => {
      seen.push(customer.name);
      return { customer: customer.name, ok: customer.name !== "one", exitCode: 1 };
    },
  });

  assert.equal(exitCode, 1);
  assert.deepEqual(seen, ["one"]);
});

test("runSmokeBittrees continues across failures when requested", async () => {
  const seen = [];
  const exitCode = await runSmokeBittrees({
    json: true,
    continueOnError: true,
    stdout: () => {},
    stderr: () => {},
    client: { checkNodeHealth: async () => ({ available: true, version: "0.30.0", id: "node-123" }) },
    customers: [{ name: "one" }, { name: "two" }],
    runCustomer: async (customer) => {
      seen.push(customer.name);
      return { customer: customer.name, ok: customer.name !== "one", exitCode: customer.name === "one" ? 1 : 0 };
    },
  });

  assert.equal(exitCode, 1);
  assert.deepEqual(seen, ["one", "two"]);
});

test("runSmokeBittrees limits execution to selected customers", async () => {
  const seen = [];
  const exitCode = await runSmokeBittrees({
    json: true,
    selectedCustomers: ["two"],
    stdout: () => {},
    stderr: () => {},
    client: { checkNodeHealth: async () => ({ available: true, version: "0.30.0", id: "node-123" }) },
    customers: [{ name: "one" }, { name: "two" }],
    runCustomer: async (customer) => {
      seen.push(customer.name);
      return { customer: customer.name, ok: true, exitCode: 0 };
    },
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(seen, ["two"]);
});

test("runSmokeBittrees rejects unknown selected customers", async () => {
  const output = [];
  const exitCode = await runSmokeBittrees({
    json: true,
    selectedCustomers: ["missing"],
    stdout: (line) => output.push(line),
    stderr: () => {},
    client: { checkNodeHealth: async () => ({ available: true, version: "0.30.0", id: "node-123" }) },
    customers: [{ name: "one" }, { name: "two" }],
    runCustomer: async () => {
      throw new Error("should not run");
    },
  });

  assert.equal(exitCode, 1);
  assert.equal(output.length, 1);
  assert.match(output[0], /unknown customers: missing/);
});
