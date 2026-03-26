import test from "node:test";
import assert from "node:assert/strict";

import { runCheckNode } from "../scripts/check-node.mjs";
import { runRecoveryExport, timestampUtc } from "../scripts/export-recovery-artifacts.mjs";
import { runPreflight } from "../scripts/preflight-node.mjs";
import { runPublishPath } from "../scripts/publish-path.mjs";
import { parseSetupArgs, runNodeSetup } from "../scripts/setup-node.mjs";

test("runCheckNode reports healthy node details", async () => {
  const out = [];
  const err = [];
  const exitCode = await runCheckNode({
    client: {
      checkNodeHealth: async () => ({ available: true, version: "1.0.0", id: "node-123" }),
    },
    stdout: (line) => out.push(line),
    stderr: (line) => err.push(line),
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(err, []);
  assert.deepEqual(out, ["ipfs-node:available", "version=1.0.0", "id=node-123"]);
});

test("runCheckNode reports unavailable node errors", async () => {
  const out = [];
  const err = [];
  const exitCode = await runCheckNode({
    client: {
      checkNodeHealth: async () => ({ available: false, error: "connect ECONNREFUSED" }),
    },
    stdout: (line) => out.push(line),
    stderr: (line) => err.push(line),
  });

  assert.equal(exitCode, 1);
  assert.deepEqual(out, []);
  assert.deepEqual(err, ["ipfs-node:unavailable", "connect ECONNREFUSED"]);
});

test("runPreflight reports configured binary version", () => {
  const out = [];
  const err = [];
  const exitCode = runPreflight({
    config: {
      apiBaseUrl: "http://127.0.0.1:5001",
      gatewayBaseUrl: "http://127.0.0.1:8080",
      defaultSourceProject: "ipfs-evm-system",
      cliPath: "/mock/ipfs",
      repoPath: "/mock/repo",
    },
    existsSync: () => true,
    spawnSync: () => ({ status: 0, stdout: "ipfs version 0.0.1\n", stderr: "" }),
    stdout: (line) => out.push(line),
    stderr: (line) => err.push(line),
  });

  assert.equal(exitCode, 0);
  assert.equal(err.length, 0);
  assert.equal(out.at(-1), "ipfs version 0.0.1");
});

test("runPreflight accepts command-name cli paths", () => {
  const out = [];
  const err = [];
  const exitCode = runPreflight({
    config: {
      apiBaseUrl: "http://127.0.0.1:5001",
      gatewayBaseUrl: "http://127.0.0.1:8080",
      defaultSourceProject: null,
      cliPath: "ipfs",
      repoPath: "/mock/repo",
    },
    existsSync: () => false,
    spawnSync: () => ({ status: 0, stdout: "ipfs version 0.0.2\n", stderr: "" }),
    stdout: (line) => out.push(line),
    stderr: (line) => err.push(line),
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(err, []);
  assert.equal(out.at(-1), "ipfs version 0.0.2");
});

test("parseSetupArgs reads ports and repo overrides", () => {
  const options = parseSetupArgs([
    "--repo-path",
    "/tmp/ipfs",
    "--api-port",
    "7001",
    "--gateway-port=9090",
    "--profile=badgerds",
    "--no-default-cors",
    "--cors-origin",
    "http://localhost:8081",
  ], {
    apiBaseUrl: "http://127.0.0.1:5001",
    gatewayBaseUrl: "http://127.0.0.1:8080",
    cliPath: "ipfs",
    repoPath: "/mock/repo",
  });

  assert.equal(options.repoPath, "/tmp/ipfs");
  assert.equal(options.apiPort, 7001);
  assert.equal(options.gatewayPort, 9090);
  assert.equal(options.profile, "badgerds");
  assert.deepEqual(options.corsOrigins, ["http://localhost:8081"]);
});

test("runNodeSetup initializes and configures a repo", () => {
  const out = [];
  const err = [];
  const calls = [];
  const exitCode = runNodeSetup({
    config: {
      apiBaseUrl: "http://127.0.0.1:5001",
      gatewayBaseUrl: "http://127.0.0.1:8080",
      cliPath: "/mock/ipfs",
      repoPath: "/mock/repo",
    },
    existsSync: (filePath) => filePath === "/mock/repo/config" ? false : true,
    mkdirSync: () => {},
    spawnSync: (_cliPath, args) => {
      calls.push(args);
      return { status: 0, stdout: "", stderr: "" };
    },
    stdout: (line) => out.push(line),
    stderr: (line) => err.push(line),
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(err, []);
  assert.deepEqual(calls, [
    ["init", "--profile=server"],
    ["config", "Addresses.API", "/ip4/127.0.0.1/tcp/5001"],
    ["config", "Addresses.Gateway", "/ip4/127.0.0.1/tcp/8080"],
    ["config", "--json", "API.HTTPHeaders.Access-Control-Allow-Origin", JSON.stringify([
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:4173",
      "http://127.0.0.1:4173",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ])],
    ["config", "--json", "API.HTTPHeaders.Access-Control-Allow-Methods", JSON.stringify(["GET", "POST", "PUT"])],
    ["config", "--json", "API.HTTPHeaders.Access-Control-Allow-Credentials", JSON.stringify(["true"])],
  ]);
  assert.equal(out[0], "ipfs-repo:initialized");
  assert.equal(out.at(-1), "startCommand=IPFS_PATH=/mock/repo /mock/ipfs daemon");
});

test("runNodeSetup skips init when the repo already exists", () => {
  const calls = [];
  const out = [];
  const exitCode = runNodeSetup({
    config: {
      apiBaseUrl: "http://127.0.0.1:5001",
      gatewayBaseUrl: "http://127.0.0.1:8080",
      cliPath: "ipfs",
      repoPath: "/mock/repo",
    },
    existsSync: () => true,
    mkdirSync: () => {},
    spawnSync: (_cliPath, args) => {
      calls.push(args);
      return { status: 0, stdout: "", stderr: "" };
    },
    stdout: (line) => out.push(line),
    stderr: () => {},
  });

  assert.equal(exitCode, 0);
  assert.equal(out[0], "ipfs-repo:existing");
  assert.equal(calls[0][0], "config");
});

test("runPublishPath rejects missing argv path", async () => {
  const err = [];
  const exitCode = await runPublishPath({
    argv: [],
    stderr: (line) => err.push(line),
  });

  assert.equal(exitCode, 1);
  assert.deepEqual(err, ["usage: npm run publish:path -- <path> [source-project]"]);
});

test("runPublishPath publishes a file with expected metadata", async () => {
  const calls = [];
  const out = [];
  const exitCode = await runPublishPath({
    argv: ["./artifact.json", "skillmesh"],
    client: {
      publishFile: async (input) => {
        calls.push(input);
        return { cid: "bafytest", name: "artifact.json" };
      },
    },
    detectTarget: async () => ({ isFile: true, isDirectory: false }),
    stdout: (line) => out.push(line),
  });

  assert.equal(exitCode, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].sourceProject, "skillmesh");
  assert.equal(calls[0].metadata.kind, "file");
  assert.match(calls[0].metadata.path, /artifact\.json$/);
  assert.match(out[0], /bafytest/);
});

test("timestampUtc formats deterministic UTC stamps", () => {
  assert.equal(timestampUtc(new Date("2026-03-26T06:00:01.234Z")), "20260326T060001Z");
});

test("runRecoveryExport writes sorted recovery artifacts", async () => {
  const writes = new Map();
  const out = [];
  const calls = [];
  const exitCode = await runRecoveryExport({
    argv: ["tmp/test-recovery"],
    now: new Date("2026-03-26T06:00:01.234Z"),
    config: {
      apiBaseUrl: "http://127.0.0.1:5001",
      gatewayBaseUrl: "http://127.0.0.1:8080",
      cliPath: "/mock/ipfs",
      repoPath: "/mock/repo",
    },
    mkdirImpl: async () => {},
    writeFileImpl: async (filePath, contents) => {
      writes.set(filePath, contents);
    },
    runIpfsImpl: async (_cliPath, _repoPath, args) => {
      calls.push(args.join(" "));
      if (args[0] === "pin") {
        return "cid-b\ncid-a\n";
      }
      if (args[0] === "repo") {
        return '{"RepoSize": 10}\n';
      }
      return '{"ID": "node-123"}\n';
    },
    stdout: (line) => out.push(line),
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(calls, [
    "pin ls --type=recursive --quiet",
    "repo stat --enc=json",
    "id",
  ]);
  const manifestPath = [...writes.keys()].find((key) => key.endsWith("pin-manifest.json"));
  assert.ok(manifestPath);
  const manifest = JSON.parse(writes.get(manifestPath));
  assert.deepEqual(manifest.recursivePins, ["cid-a", "cid-b"]);
  assert.equal(manifest.pinCount, 2);
  assert.equal(out.at(-1), "pin-count=2");
});
