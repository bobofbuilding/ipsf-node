import { mkdir as nodeMkdir, writeFile as nodeWriteFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { getIpfsStorageConfig } from "../src/config.js";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

export function timestampUtc(now = new Date()) {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export async function runIpfs(cliPath, repoPath, args, execFileImpl = execFileAsync) {
  const { stdout } = await execFileImpl(cliPath, args, {
    env: {
      ...process.env,
      IPFS_PATH: repoPath,
    },
  });

  return stdout;
}

export async function runRecoveryExport({
  argv = process.argv.slice(2),
  config = getIpfsStorageConfig(),
  now = new Date(),
  mkdirImpl = nodeMkdir,
  writeFileImpl = nodeWriteFile,
  runIpfsImpl = runIpfs,
  stdout = console.log,
  stderr = console.error,
} = {}) {
  const stamp = timestampUtc(now);
  const outputDir = argv[0]
    ? path.resolve(rootDir, argv[0])
    : path.join(rootDir, "recovery", stamp);

  await mkdirImpl(outputDir, { recursive: true });

  let pinLines;
  let repoStatRaw;
  let nodeIdRaw;

  try {
    pinLines = await runIpfsImpl(config.cliPath, config.repoPath, [
      "pin",
      "ls",
      "--type=recursive",
      "--quiet",
    ]);
    repoStatRaw = await runIpfsImpl(config.cliPath, config.repoPath, ["repo", "stat", "--enc=json"]);
    nodeIdRaw = await runIpfsImpl(config.cliPath, config.repoPath, ["id"]);
  } catch (error) {
    stderr("ipfs-recovery-export:failed");
    stderr(error instanceof Error ? error.message : String(error));
    return 1;
  }

  const pins = pinLines
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .sort();

  const manifest = {
    generatedAt: now.toISOString(),
    repoPath: config.repoPath,
    apiBaseUrl: config.apiBaseUrl,
    gatewayBaseUrl: config.gatewayBaseUrl,
    pinCount: pins.length,
    recursivePins: pins,
  };

  await writeFileImpl(path.join(outputDir, "pin-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFileImpl(path.join(outputDir, "repo-stat.json"), `${repoStatRaw.trim()}\n`, "utf8");
  await writeFileImpl(path.join(outputDir, "node-id.json"), `${nodeIdRaw.trim()}\n`, "utf8");

  stdout(`recovery-artifacts=${outputDir}`);
  stdout(`pin-manifest=${path.join(outputDir, "pin-manifest.json")}`);
  stdout(`pin-count=${pins.length}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const exitCode = await runRecoveryExport();
  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}
