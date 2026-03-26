import { spawnSync as nodeSpawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { getIpfsStorageConfig } from "../src/config.js";

const DEFAULT_CORS_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

function isCommandName(value) {
  const normalized = String(value);
  return normalized.length > 0 && normalized.includes("/") === false && normalized.includes("\\") === false;
}

function parsePort(value, flagName) {
  const port = Number.parseInt(String(value), 10);
  if (Number.isInteger(port) === false || port < 1 || port > 65535) {
    throw new Error(flagName + " must be a valid TCP port");
  }
  return port;
}

export function parseSetupArgs(argv = process.argv.slice(2), config = getIpfsStorageConfig()) {
  const defaultApiPort = new URL(config.apiBaseUrl).port || "5001";
  const defaultGatewayPort = new URL(config.gatewayBaseUrl).port || "8080";

  const options = {
    cliPath: config.cliPath,
    repoPath: config.repoPath,
    apiPort: parsePort(defaultApiPort, "apiPort"),
    gatewayPort: parsePort(defaultGatewayPort, "gatewayPort"),
    profile: "server",
    corsOrigins: [...DEFAULT_CORS_ORIGINS],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--cli-path") {
      options.cliPath = next;
      index += 1;
      continue;
    }

    if (arg.startsWith("--cli-path=")) {
      options.cliPath = arg.slice("--cli-path=".length);
      continue;
    }

    if (arg === "--repo-path") {
      options.repoPath = next;
      index += 1;
      continue;
    }

    if (arg.startsWith("--repo-path=")) {
      options.repoPath = arg.slice("--repo-path=".length);
      continue;
    }

    if (arg === "--api-port") {
      options.apiPort = parsePort(next, "--api-port");
      index += 1;
      continue;
    }

    if (arg.startsWith("--api-port=")) {
      options.apiPort = parsePort(arg.slice("--api-port=".length), "--api-port");
      continue;
    }

    if (arg === "--gateway-port") {
      options.gatewayPort = parsePort(next, "--gateway-port");
      index += 1;
      continue;
    }

    if (arg.startsWith("--gateway-port=")) {
      options.gatewayPort = parsePort(arg.slice("--gateway-port=".length), "--gateway-port");
      continue;
    }

    if (arg === "--profile") {
      options.profile = next;
      index += 1;
      continue;
    }

    if (arg.startsWith("--profile=")) {
      options.profile = arg.slice("--profile=".length);
      continue;
    }

    if (arg === "--cors-origin") {
      options.corsOrigins.push(next);
      index += 1;
      continue;
    }

    if (arg.startsWith("--cors-origin=")) {
      options.corsOrigins.push(arg.slice("--cors-origin=".length));
      continue;
    }

    if (arg === "--no-default-cors") {
      options.corsOrigins = [];
    }
  }

  options.corsOrigins = Array.from(new Set(options.corsOrigins.filter(Boolean)));
  return options;
}

function runIpfs(spawnSync, cliPath, repoPath, args) {
  const result = spawnSync(cliPath, args, {
    encoding: "utf8",
    env: {
      ...process.env,
      IPFS_PATH: repoPath,
    },
  });

  if (result.status === 0) {
    return result.stdout.trim();
  }

  const command = [cliPath, ...args].join(" ");
  const message = result.stderr?.trim() || result.stdout?.trim() || ("Command failed: " + command);
  throw new Error(message);
}

export function runNodeSetup({
  argv = process.argv.slice(2),
  config = getIpfsStorageConfig(),
  existsSync = fs.existsSync,
  mkdirSync = fs.mkdirSync,
  spawnSync = nodeSpawnSync,
  stdout = console.log,
  stderr = console.error,
} = {}) {
  let options;
  try {
    options = parseSetupArgs(argv, config);
  } catch (error) {
    stderr(error.message);
    return 1;
  }

  const hasConfiguredBinary = isCommandName(options.cliPath) ? true : existsSync(options.cliPath);
  if (hasConfiguredBinary === false) {
    stderr("ipfs-cli:missing");
    stderr("Configured IPFS CLI path does not exist: " + options.cliPath);
    return 1;
  }

  mkdirSync(options.repoPath, { recursive: true });
  const repoConfigPath = path.join(options.repoPath, "config");
  const repoAlreadyInitialized = existsSync(repoConfigPath);

  try {
    if (repoAlreadyInitialized) {
      stdout("ipfs-repo:existing");
    } else {
      runIpfs(spawnSync, options.cliPath, options.repoPath, ["init", "--profile=" + options.profile]);
      stdout("ipfs-repo:initialized");
    }

    runIpfs(spawnSync, options.cliPath, options.repoPath, ["config", "Addresses.API", "/ip4/127.0.0.1/tcp/" + options.apiPort]);
    runIpfs(spawnSync, options.cliPath, options.repoPath, ["config", "Addresses.Gateway", "/ip4/127.0.0.1/tcp/" + options.gatewayPort]);
    runIpfs(spawnSync, options.cliPath, options.repoPath, ["config", "--json", "API.HTTPHeaders.Access-Control-Allow-Origin", JSON.stringify(options.corsOrigins)]);
    runIpfs(spawnSync, options.cliPath, options.repoPath, ["config", "--json", "API.HTTPHeaders.Access-Control-Allow-Methods", JSON.stringify(["GET", "POST", "PUT"])]);
    runIpfs(spawnSync, options.cliPath, options.repoPath, ["config", "--json", "API.HTTPHeaders.Access-Control-Allow-Credentials", JSON.stringify(["true"])]);
  } catch (error) {
    stderr("ipfs-node:setup-failed");
    stderr(error.message);
    return 1;
  }

  stdout("ipfs-node:configured");
  stdout("cliPath=" + options.cliPath);
  stdout("repoPath=" + options.repoPath);
  stdout("apiBaseUrl=http://127.0.0.1:" + options.apiPort);
  stdout("gatewayBaseUrl=http://127.0.0.1:" + options.gatewayPort);
  stdout("startCommand=IPFS_PATH=" + options.repoPath + " " + options.cliPath + " daemon");
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const exitCode = runNodeSetup();
  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}
