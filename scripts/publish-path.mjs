import path from "node:path";

import { detectPublishTarget, IpfsStorageClient } from "../src/client.js";
import { getIpfsStorageConfig } from "../src/config.js";

async function main() {
  const inputPath = process.argv[2];
  const sourceProject = process.argv[3];

  if (!inputPath) {
    console.error("usage: npm run publish:path -- <path> [source-project]");
    process.exitCode = 1;
    return;
  }

  const client = new IpfsStorageClient({
    ...getIpfsStorageConfig(),
    defaultSourceProject: sourceProject ?? getIpfsStorageConfig().defaultSourceProject,
  });

  const target = await detectPublishTarget(inputPath);

  if (target.isDirectory) {
    const result = await client.publishDirectory({
      directoryPath: inputPath,
      sourceProject,
      metadata: {
        path: path.resolve(inputPath),
        kind: "directory",
      },
    });

    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (target.isFile) {
    const result = await client.publishFile({
      filePath: inputPath,
      sourceProject,
      metadata: {
        path: path.resolve(inputPath),
        kind: "file",
      },
    });

    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.error(`unsupported-path-type:${inputPath}`);
  process.exitCode = 1;
}

await main();
