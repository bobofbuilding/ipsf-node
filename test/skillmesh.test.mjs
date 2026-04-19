import test from "node:test";
import assert from "node:assert/strict";

import { createSkillMeshDefinitionMetadata, publishSkillMeshDefinition } from "../src/skillmesh.js";
import { runPublishSkillMeshDefinition } from "../scripts/publish-skillmesh-definition.mjs";

test("createSkillMeshDefinitionMetadata supports canonical SkillMesh definitions", () => {
  const metadata = createSkillMeshDefinitionMetadata({
    name: "Runtime Skill",
    version: "1.2.3",
    runtimeType: "javascript",
    entrypoint: "run",
    chainable: true,
    computeCost: 25,
  });

  assert.deepEqual(metadata, {
    skillName: "Runtime Skill",
    skillVersion: "1.2.3",
    runtimeType: "javascript",
    entrypoint: "run",
    chainable: "true",
    computeCost: "25",
  });
});

test("createSkillMeshDefinitionMetadata supports legacy smoke definitions", () => {
  const metadata = createSkillMeshDefinitionMetadata({
    name: "Smoke Skill",
    version: "0.1.0",
    type: "javascript",
    runtime: { entrypoint: "run" },
    chainable: false,
    computeCost: 1,
  });

  assert.deepEqual(metadata, {
    skillName: "Smoke Skill",
    skillVersion: "0.1.0",
    runtimeType: "javascript",
    entrypoint: "run",
    chainable: "false",
    computeCost: "1",
  });
});

test("publishSkillMeshDefinition publishes a JSON artifact with SkillMesh metadata", async () => {
  const calls = [];
  const client = {
    publishJson: async (input) => {
      calls.push(input);
      return {
        cid: "bafytestcid",
        name: input.fileName,
        size: 123,
        sourceProject: input.sourceProject,
        gatewayUrl: `http://127.0.0.1:8080/ipfs/bafytestcid`,
        metadata: input.metadata,
      };
    },
    ensurePinned: async (cid) => ({ cid, pinned: true }),
    checkCidHealth: async ({ cid }) => ({ cid, available: true, status: 200, gatewayUrl: `http://127.0.0.1:8080/ipfs/${cid}` }),
  };

  const result = await publishSkillMeshDefinition(client, {
    inputPath: "/tmp/skillmesh-runtime.json",
    readFileImpl: async () => JSON.stringify({
      name: "Runtime Skill",
      version: "2.0.0",
      runtimeType: "api",
      entrypoint: "invoke",
      chainable: true,
      computeCost: 9,
    }),
  });

  assert.equal(result.cid, "bafytestcid");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].fileName, "skillmesh-runtime.json");
  assert.equal(calls[0].metadata.skillName, "Runtime Skill");
  assert.equal(calls[0].metadata.skillVersion, "2.0.0");
  assert.equal(calls[0].metadata.runtimeType, "api");
  assert.equal(calls[0].metadata.entrypoint, "invoke");
});

test("runPublishSkillMeshDefinition reports usage when no path is provided", async () => {
  const out = [];
  const err = [];
  const exitCode = await runPublishSkillMeshDefinition({
    argv: [],
    stdout: (line) => out.push(line),
    stderr: (line) => err.push(line),
  });

  assert.equal(exitCode, 1);
  assert.deepEqual(out, []);
  assert.equal(err[0], "usage: npm run publish:skillmesh-definition -- <definition-json-path>");
});

test("runPublishSkillMeshDefinition publishes through the shared client", async () => {
  const out = [];
  const err = [];
  const client = {
    checkNodeHealth: async () => ({ available: true }),
    publishJson: async (input) => ({
      cid: "bafysharedcid",
      name: input.fileName,
      size: 88,
      sourceProject: input.sourceProject,
      gatewayUrl: "http://127.0.0.1:8080/ipfs/bafysharedcid",
      metadata: input.metadata,
    }),
    ensurePinned: async (cid) => ({ cid, pinned: true }),
    checkCidHealth: async ({ cid }) => ({ cid, available: true, status: 200, gatewayUrl: `http://127.0.0.1:8080/ipfs/${cid}` }),
  };
  const exitCode = await runPublishSkillMeshDefinition({
    argv: ["/tmp/runtime-skill.json"],
    client,
    publishDefinition: async (_client, input) => ({
      cid: "bafysharedcid",
      name: "runtime-skill.json",
      size: 88,
      sourceProject: "skillmesh",
      gatewayUrl: "http://127.0.0.1:8080/ipfs/bafysharedcid",
      metadata: { skillName: "Runtime Skill" },
      verified: true,
      pinStatus: { cid: "bafysharedcid", pinned: true },
      health: { cid: "bafysharedcid", available: true, status: 200, gatewayUrl: "http://127.0.0.1:8080/ipfs/bafysharedcid" },
      forwardedInputPath: input.inputPath,
    }),
    stdout: (line) => out.push(line),
    stderr: (line) => err.push(line),
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(err, []);
  const payload = JSON.parse(out[0]);
  assert.equal(payload.cid, "bafysharedcid");
  assert.equal(payload.inputPath, "/tmp/runtime-skill.json");
  assert.equal(payload.forwardedInputPath, "/tmp/runtime-skill.json");
});

test("runPublishSkillMeshDefinition reports unavailable node errors", async () => {
  const out = [];
  const err = [];
  const exitCode = await runPublishSkillMeshDefinition({
    argv: ["/tmp/runtime-skill.json"],
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
