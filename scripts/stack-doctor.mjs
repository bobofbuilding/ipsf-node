import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { getIpfsApiProxyAuthMode } from "../src/api-proxy.js";
import { IpfsStorageClient } from "../src/client.js";
import { getIpfsStorageConfig } from "../src/config.js";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const runtimeDir = path.join(rootDir, ".runtime");
const pidDir = path.join(runtimeDir, "pids");
const logDir = path.join(runtimeDir, "logs");


/**
 * @param {string} contents
 */
function parseDotEnv(contents) {
  const values = {};

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const normalized = trimmed.startsWith("export ") ? trimmed.slice("export ".length).trim() : trimmed;
    const separator = normalized.indexOf("=");
    if (separator <= 0) {
      continue;
    }

    const key = normalized.slice(0, separator).trim();
    let value = normalized.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }

  return values;
}

/**
 * @param {NodeJS.ProcessEnv} baseEnv
 * @param {{ readFileImpl: typeof fs.readFile }} deps
 */
async function loadProjectEnv(baseEnv, deps) {
  try {
    const contents = await deps.readFileImpl(path.join(rootDir, ".env"), "utf8");
    return { ...parseDotEnv(contents), ...baseEnv };
  } catch (_error) {
    return { ...baseEnv };
  }
}

const services = [
  { name: "ipfs-node", required: true },
  { name: "ipfs-api-proxy", required: false },
  { name: "cloudflared", required: false },
];

/**
 * @param {string} serviceName
 */
function pidFileFor(serviceName) {
  return path.join(pidDir, `${serviceName}.pid`);
}

/**
 * @param {string} serviceName
 */
function logFileFor(serviceName) {
  return path.join(logDir, `${serviceName}.log`);
}

/**
 * @param {string} serviceName
 */
function expectedPattern(serviceName) {
  if (serviceName === "ipfs-node") {
    return /(?:\/workspace\/tools\/kubo\/ipfs|\/\.tools\/kubo\/ipfs|(?:^| )ipfs) daemon/;
  }

  if (serviceName === "ipfs-api-proxy") {
    return /start-ipfs-api-proxy[.]mjs/;
  }

  if (serviceName === "cloudflared") {
    return /cloudflared.* tunnel/;
  }

  return /$a/;
}

/**
 * @param {string} pid
 * @param {{ readFileImpl: typeof fs.readFile }} deps
 */
async function processState(pid, deps) {
  if (!pid) {
    return { running: false, reason: "missing-pid" };
  }

  try {
    const stat = await deps.readFileImpl(`/proc/${pid}/stat`, "utf8");
    const fields = stat.trim().split(/\s+/);
    if (fields[2] === "Z") {
      return { running: false, reason: "zombie" };
    }

    const cmdline = String(await deps.readFileImpl(`/proc/${pid}/cmdline`, "utf8"))
      .replace(/\0/g, " ")
      .trim();

    return { running: Boolean(cmdline), cmdline };
  } catch (error) {
    return {
      running: false,
      reason: error && typeof error === "object" && "code" in error ? error.code : "unreadable-proc",
    };
  }
}

/**
 * @param {string} serviceName
 * @param {{ readFileImpl: typeof fs.readFile, processStateImpl?: typeof processState }} deps
 */
async function inspectService(serviceName, deps) {
  const pidPath = pidFileFor(serviceName);
  let pid = null;

  try {
    pid = String(await deps.readFileImpl(pidPath, "utf8")).trim() || null;
  } catch (_error) {
    pid = null;
  }

  const state = pid ? await (deps.processStateImpl ?? processState)(pid, deps) : { running: false, reason: "missing-pid" };
  const pattern = expectedPattern(serviceName);
  const matches = state.running && typeof state.cmdline === "string" && pattern.test(state.cmdline);

  return {
    name: serviceName,
    pid,
    running: Boolean(matches),
    reason: matches ? null : state.reason ?? "cmdline-mismatch",
    logFile: logFileFor(serviceName),
  };
}

/**
 * @param {{ gatewayBaseUrl: string, fetchImpl: typeof fetch }} input
 */
async function checkGateway(input) {
  try {
    const response = await input.fetchImpl(input.gatewayBaseUrl, { method: "GET" });
    return { reachable: true, status: response.status ?? null };
  } catch (error) {
    return {
      reachable: false,
      status: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}


/**
 * @param {string[]} argv
 */
function parseDoctorArgs(argv = []) {
  return {
    json: argv.includes("--json"),
  };
}

function lineForService(service) {
  const status = service.running ? "running" : "stopped";
  const pid = service.pid ? ` pid=${service.pid}` : "";
  const reason = service.reason && !service.running ? ` reason=${service.reason}` : "";
  return `process.${service.name}=${status}${pid}${reason} log=${service.logFile}`;
}

/**
 * @param {{
 *   env?: NodeJS.ProcessEnv,
 *   config?: ReturnType<typeof getIpfsStorageConfig>,
 *   client?: IpfsStorageClient,
 *   fetchImpl?: typeof fetch,
 *   readFileImpl?: typeof fs.readFile,
 *   processStateImpl?: typeof processState,
 *   argv?: string[],
 *   stdout?: (line: string) => void,
 *   stderr?: (line: string) => void,
 * }} [options]
 */
export async function runStackDoctor(options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const readFileImpl = options.readFileImpl ?? fs.readFile;
  const env = options.env ?? await loadProjectEnv(process.env, { readFileImpl });
  const config = options.config ?? getIpfsStorageConfig(env);
  const stdout = options.stdout ?? console.log;
  const stderr = options.stderr ?? console.error;
  const client = options.client ?? new IpfsStorageClient(config);
  const authMode = getIpfsApiProxyAuthMode(env);
  const args = parseDoctorArgs(options.argv ?? []);

  const processChecks = await Promise.all(
    services.map((service) => inspectService(service.name, { readFileImpl, processStateImpl: options.processStateImpl })),
  );
  const nodeHealth = await client.checkNodeHealth();
  const gateway = await checkGateway({ gatewayBaseUrl: config.gatewayBaseUrl, fetchImpl });

  const failures = [];
  const warnings = [];

  for (const service of processChecks) {
    const required = services.find((entry) => entry.name === service.name)?.required;
    if (!service.running && required) {
      failures.push(`${service.name}-stopped`);
    } else if (!service.running) {
      warnings.push(`${service.name}-stopped`);
    }
  }

  if (!nodeHealth.available) {
    failures.push("node-unavailable");
  }

  if (!gateway.reachable) {
    failures.push("gateway-unreachable");
  }

  if (authMode === "none") {
    failures.push("proxy-auth-missing");
  }

  const overall = failures.length > 0 ? "fail" : warnings.length > 0 ? "warn" : "ok";
  const report = {
    ok: failures.length === 0,
    status: overall,
    failures,
    warnings,
    processes: processChecks,
    node: {
      available: Boolean(nodeHealth.available),
      version: nodeHealth.version ?? null,
      id: nodeHealth.id ?? null,
      mode: nodeHealth.nodeMode ?? "unknown",
      apiBaseUrl: nodeHealth.apiBaseUrl ?? config.apiBaseUrl ?? null,
      gatewayBaseUrl: nodeHealth.gatewayBaseUrl ?? config.gatewayBaseUrl ?? null,
      configuredApiAddress: nodeHealth.configuredApiAddress ?? null,
      configuredGatewayAddress: nodeHealth.configuredGatewayAddress ?? null,
      configuredApiPort: nodeHealth.configuredApiPort ?? null,
      configuredGatewayPort: nodeHealth.configuredGatewayPort ?? null,
      localOnly: Boolean(nodeHealth.localOnly),
      repoPath: nodeHealth.repoPath ?? config.repoPath ?? null,
    },
    gateway: {
      reachable: Boolean(gateway.reachable),
      status: gateway.status ?? null,
      url: config.gatewayBaseUrl,
      error: gateway.error ?? null,
    },
    proxy: {
      authMode,
      port: config.apiProxyPort,
      upstreamUrl: config.apiProxyUpstreamUrl ?? null,
    },
  };

  if (args.json) {
    stdout(JSON.stringify(report));
    return failures.length > 0 ? 1 : 0;
  }

  stdout(`stack-doctor:${overall}`);

  for (const service of processChecks) {
    stdout(lineForService(service));
  }

  stdout(`node=${nodeHealth.available ? "available" : "unavailable"} version=${nodeHealth.version ?? "unknown"} mode=${nodeHealth.nodeMode ?? "unknown"}`);
  stdout(`gateway=${gateway.reachable ? "reachable" : "unreachable"} status=${gateway.status ?? "unknown"} url=${config.gatewayBaseUrl}`);
  stdout(`proxyAuth=${authMode} port=${config.apiProxyPort}`);

  if (warnings.length > 0) {
    stdout(`warnings=${warnings.join(",")}`);
  }

  if (failures.length > 0) {
    stderr(`failures=${failures.join(",")}`);
    return 1;
  }

  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const exitCode = await runStackDoctor({ argv: process.argv.slice(2) });
  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}
