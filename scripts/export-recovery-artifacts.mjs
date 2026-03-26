import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { getIpfsStorageConfig } from "../src/config.js";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

function timestampUtc() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

async function runIpfs(cliPath, repoPath, args) {
  const { stdout } = await execFileAsync(cliPath, args, {
    env: {
      ...process.env,
      IPFS_PATH: repoPath,
    },
  });

  return stdout;
}

async function main() {
  const config = getIpfsStorageConfig();
  const stamp = timestampUtc();
  const outputDir = process.argv[2]
    ? path.resolve(rootDir, process.argv[2])
    : path.join(rootDir, "recovery", stamp);

  await mkdir(outputDir, { recursive: true });

  let pinLines;
  let repoStatRaw;
  let nodeIdRaw;

  try {
    pinLines = await runIpfs(config.cliPath, config.repoPath, [
      "pin",
      "ls",
      "--type=recursive",
      "--quiet",
    ]);
    repoStatRaw = await runIpfs(config.cliPath, config.repoPath, ["repo", "stat", "--enc=json"]);
    nodeIdRaw = await runIpfs(config.cliPath, config.repoPath, ["id"]);
  } catch (error) {
    console.error("ipfs-recovery-export:failed");
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
    return;
  }

  const pins = pinLines
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .sort();

  const manifest = {
    generatedAt: new Date().toISOString(),
    repoPath: config.repoPath,
    apiBaseUrl: config.apiBaseUrl,
    gatewayBaseUrl: config.gatewayBaseUrl,
    pinCount: pins.length,
    recursivePins: pins,
  };

  await writeFile(path.join(outputDir, "pin-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFile(path.join(outputDir, "repo-stat.json"), `${repoStatRaw.trim()}\n`, "utf8");
  await writeFile(path.join(outputDir, "node-id.json"), `${nodeIdRaw.trim()}\n`, "utf8");

  console.log(`recovery-artifacts=${outputDir}`);
  console.log(`pin-manifest=${path.join(outputDir, "pin-manifest.json")}`);
  console.log(`pin-count=${pins.length}`);
}

await main();
