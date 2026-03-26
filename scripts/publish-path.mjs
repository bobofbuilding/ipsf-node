import path from "node:path";
import { pathToFileURL } from "node:url";

import { detectPublishTarget, IpfsStorageClient } from "../src/client.js";
import { getIpfsStorageConfig } from "../src/config.js";

export async function runPublishPath({
  argv = process.argv.slice(2),
  client = null,
  detectTarget = detectPublishTarget,
  stdout = console.log,
  stderr = console.error,
} = {}) {
  const inputPath = argv[0];
  const sourceProject = argv[1];

  if (!inputPath) {
    stderr("usage: npm run publish:path -- <path> [source-project]");
    return 1;
  }

  const resolvedClient =
    client ??
    new IpfsStorageClient({
      ...getIpfsStorageConfig(),
      defaultSourceProject: sourceProject ?? getIpfsStorageConfig().defaultSourceProject,
    });

  const target = await detectTarget(inputPath);

  if (target.isDirectory) {
    const result = await resolvedClient.publishDirectory({
      directoryPath: inputPath,
      sourceProject,
      metadata: {
        path: path.resolve(inputPath),
        kind: "directory",
      },
    });

    stdout(JSON.stringify(result, null, 2));
    return 0;
  }

  if (target.isFile) {
    const result = await resolvedClient.publishFile({
      filePath: inputPath,
      sourceProject,
      metadata: {
        path: path.resolve(inputPath),
        kind: "file",
      },
    });

    stdout(JSON.stringify(result, null, 2));
    return 0;
  }

  stderr(`unsupported-path-type:${inputPath}`);
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const exitCode = await runPublishPath();
  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}
