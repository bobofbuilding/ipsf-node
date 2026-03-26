import test from "node:test";
import assert from "node:assert/strict";

import { runCheckNode } from "../scripts/check-node.mjs";
import { runRecoveryExport, timestampUtc } from "../scripts/export-recovery-artifacts.mjs";
import { runPreflight } from "../scripts/preflight-node.mjs";
import { runPublishPath } from "../scripts/publish-path.mjs";

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
