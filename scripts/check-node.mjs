import { IpfsStorageClient } from "../src/client.js";
import { getIpfsStorageConfig } from "../src/config.js";

async function main() {
  const client = new IpfsStorageClient(getIpfsStorageConfig());
  const health = await client.checkNodeHealth();

  if (!health.available) {
    console.error("ipfs-node:unavailable");
    if (health.error) {
      console.error(health.error);
    }
    process.exitCode = 1;
    return;
  }

  console.log("ipfs-node:available");
  console.log(`version=${health.version ?? "unknown"}`);
  console.log(`id=${health.id ?? "unknown"}`);
}

await main();
