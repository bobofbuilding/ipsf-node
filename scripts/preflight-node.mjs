import { spawnSync as nodeSpawnSync } from "node:child_process";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

import { getIpfsStorageConfig } from "../src/config.js";

function isCommandName(value) {
  const normalized = String(value);
  return normalized.length > 0 && normalized.includes("/") === false && normalized.includes("\\") === false;
}

export function runPreflight({
  config = getIpfsStorageConfig(),
  existsSync = fs.existsSync,
  spawnSync = nodeSpawnSync,
  stdout = console.log,
  stderr = console.error,
} = {}) {
  const hasConfiguredBinary = isCommandName(config.cliPath) ? true : existsSync(config.cliPath);

  stdout("apiBaseUrl=" + config.apiBaseUrl);
  stdout("gatewayBaseUrl=" + config.gatewayBaseUrl);
  stdout("defaultSourceProject=" + (config.defaultSourceProject ?? "unset"));
  stdout("cliPath=" + config.cliPath);
  stdout("repoPath=" + config.repoPath);

  if (hasConfiguredBinary === false) {
    stderr("ipfs-cli:missing");
    stderr("Configured IPFS CLI path does not exist: " + config.cliPath);
    return 1;
  }

  const version = spawnSync(config.cliPath, ["--version"], { encoding: "utf8" });
  if (version.status === 0) {
    stdout(version.stdout.trim());
    return 0;
  }

  stderr("ipfs-cli:unusable");
  stderr(version.stderr.trim());
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const exitCode = runPreflight();
  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}
