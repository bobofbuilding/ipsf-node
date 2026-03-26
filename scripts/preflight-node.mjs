import { spawnSync } from "node:child_process";
import fs from "node:fs";

import { getIpfsStorageConfig } from "../src/config.js";

function main() {
  const config = getIpfsStorageConfig();
  const hasConfiguredBinary = fs.existsSync(config.cliPath);

  console.log(`apiBaseUrl=${config.apiBaseUrl}`);
  console.log(`gatewayBaseUrl=${config.gatewayBaseUrl}`);
  console.log(`defaultSourceProject=${config.defaultSourceProject ?? "unset"}`);
  console.log(`cliPath=${config.cliPath}`);
  console.log(`repoPath=${config.repoPath}`);

  if (!hasConfiguredBinary) {
    console.error("ipfs-cli:missing");
    console.error(`Configured IPFS CLI path does not exist: ${config.cliPath}`);
    process.exitCode = 1;
    return;
  }

  const version = spawnSync(config.cliPath, ["--version"], { encoding: "utf8" });
  if (version.status !== 0) {
    console.error("ipfs-cli:unusable");
    console.error(version.stderr.trim());
    process.exitCode = 1;
    return;
  }

  console.log(version.stdout.trim());
}

main();
