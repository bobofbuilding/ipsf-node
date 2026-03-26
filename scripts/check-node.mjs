import { pathToFileURL } from "node:url";

import { IpfsStorageClient } from "../src/client.js";
import { getIpfsStorageConfig } from "../src/config.js";

export async function runCheckNode({
  client = new IpfsStorageClient(getIpfsStorageConfig()),
  stdout = console.log,
  stderr = console.error,
} = {}) {
  const health = await client.checkNodeHealth();

  if (!health.available) {
    stderr("ipfs-node:unavailable");
    if (health.error) {
      stderr(health.error);
    }
    return 1;
  }

  stdout("ipfs-node:available");
  stdout(`version=${health.version ?? "unknown"}`);
  stdout(`id=${health.id ?? "unknown"}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const exitCode = await runCheckNode();
  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}
