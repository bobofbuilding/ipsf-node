import { IpfsStorageClient } from "../src/client.js";
import { getIpfsStorageConfig } from "../src/config.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const timeoutMs = Number(process.env.IPFS_NODE_WAIT_TIMEOUT_MS ?? 15000);
  const intervalMs = Number(process.env.IPFS_NODE_WAIT_INTERVAL_MS ?? 1000);
  const startedAt = Date.now();
  const client = new IpfsStorageClient(getIpfsStorageConfig());

  while (Date.now() - startedAt < timeoutMs) {
    const health = await client.checkNodeHealth();
    if (health.available) {
      console.log("ipfs-node:available");
      console.log(`version=${health.version ?? "unknown"}`);
      console.log(`id=${health.id ?? "unknown"}`);
      return;
    }

    await sleep(intervalMs);
  }

  console.error("ipfs-node:timeout");
  console.error(`timed out after ${timeoutMs}ms waiting for the shared IPFS node`);
  process.exitCode = 1;
}

await main();
