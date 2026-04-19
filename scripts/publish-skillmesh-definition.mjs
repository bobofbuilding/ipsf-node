import path from "node:path";
import { pathToFileURL } from "node:url";

import { IpfsStorageClient } from "../src/client.js";
import { getIpfsStorageConfig } from "../src/config.js";
import { publishSkillMeshDefinition } from "../src/skillmesh.js";

export async function runPublishSkillMeshDefinition({
  argv = process.argv.slice(2),
  client = null,
  publishDefinition = publishSkillMeshDefinition,
  stdout = console.log,
  stderr = console.error,
} = {}) {
  const inputPath = argv[0];

  if (!inputPath) {
    stderr("usage: npm run publish:skillmesh-definition -- <definition-json-path>");
    return 1;
  }

  const resolvedClient = client ?? new IpfsStorageClient({
    ...getIpfsStorageConfig(),
    defaultSourceProject: "skillmesh",
  });

  const health = await resolvedClient.checkNodeHealth();
  if (!health.available) {
    stderr("ipfs-node:unavailable");
    if (health.error) {
      stderr(health.error);
    }
    return 1;
  }

  const result = await publishDefinition(resolvedClient, {
    inputPath,
    sourceProject: "skillmesh",
  });

  stdout(JSON.stringify({
    ...result,
    inputPath: path.resolve(inputPath),
  }, null, 2));
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const exitCode = await runPublishSkillMeshDefinition();
  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}
