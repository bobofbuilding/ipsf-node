import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { getIpfsStorageConfig } from "../src/config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const runtimeDir = path.join(rootDir, ".runtime-host");
const stateFile = path.join(runtimeDir, "supervisor-state.json");
const envFile = path.join(rootDir, ".env");

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const env = {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/u);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }

  return env;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHttp(url, { method = "POST", timeoutMs = 15000, validate } = {}) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, {
        method,
        signal: AbortSignal.timeout(2000),
      });

      if (!validate || validate(response)) {
        return true;
      }
    } catch {
      // Retry until timeout.
    }

    await sleep(500);
  }

  return false;
}

function ensureRuntimeDir() {
  fs.mkdirSync(runtimeDir, { recursive: true });
}

class Supervisor {
  constructor({ env }) {
    this.env = env;
    this.config = getIpfsStorageConfig(env);
    this.children = new Map();
    this.stopping = false;
    this.startedAt = new Date().toISOString();
    this.specs = [
      {
        name: "ipfs-node",
        command: this.config.cliPath,
        args: ["daemon", "--init"],
        env: {
          ...env,
          IPFS_PATH: this.config.repoPath,
        },
        ready: () =>
          waitForHttp(`${this.config.apiProxyUpstreamUrl}/api/v0/version`, {
            validate: (response) => response.ok,
          }),
      },
      {
        name: "ipfs-api-proxy",
        command: process.execPath,
        args: [path.join(rootDir, "scripts/start-ipfs-api-proxy.mjs")],
        env,
        ready: () =>
          waitForHttp(`http://127.0.0.1:${this.config.apiProxyPort}/api/v0/version`, {
            validate: (response) => response.status === 401 || response.status === 403,
          }),
      },
      {
        name: "cloudflared",
        command: "bash",
        args: [path.join(rootDir, "scripts/start-cloudflared.sh")],
        env,
      },
    ];
  }

  log(message) {
    process.stdout.write(`[ipfs-supervisor] ${message}\n`);
  }

  updateState() {
    const state = {
      startedAt: this.startedAt,
      updatedAt: new Date().toISOString(),
      stopping: this.stopping,
      services: Object.fromEntries(
        [...this.children.entries()].map(([name, child]) => [
          name,
          {
            pid: child.process.pid,
            restarts: child.restarts,
            startedAt: child.startedAt,
          },
        ])
      ),
    };
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
  }

  pipeLogs(name, stream, target = process.stdout) {
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      for (const line of chunk.split(/\r?\n/u)) {
        if (!line) {
          continue;
        }
        target.write(`[${name}] ${line}\n`);
      }
    });
  }

  async startService(spec) {
    if (this.stopping) {
      return;
    }

    this.log(`starting ${spec.name}`);
    const child = spawn(spec.command, spec.args, {
      cwd: rootDir,
      env: spec.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const childState = {
      process: child,
      restarts: (this.children.get(spec.name)?.restarts ?? 0),
      startedAt: new Date().toISOString(),
    };
    this.children.set(spec.name, childState);
    this.updateState();

    this.pipeLogs(spec.name, child.stdout, process.stdout);
    this.pipeLogs(spec.name, child.stderr, process.stderr);

    child.on("exit", async (code, signal) => {
      if (this.children.get(spec.name)?.process !== child) {
        return;
      }

      this.children.delete(spec.name);
      this.updateState();

      if (this.stopping) {
        this.log(`${spec.name} stopped`);
        return;
      }

      this.log(`${spec.name} exited code=${code ?? "null"} signal=${signal ?? "null"}; restarting`);
      await sleep(3000);
      childState.restarts += 1;
      this.children.set(spec.name, childState);
      this.children.delete(spec.name);
      await this.startService(spec);
    });

    if (spec.ready) {
      const ready = await spec.ready();
      if (!ready) {
        this.log(`${spec.name} failed readiness check`);
        child.kill("SIGTERM");
        return;
      }
      this.log(`${spec.name} ready`);
    }
  }

  async start() {
    ensureRuntimeDir();
    this.updateState();
    for (const spec of this.specs) {
      // Start in dependency order and wait for readiness where applicable.
      // The proxy depends on the local API, and the tunnel depends on the proxy.
      await this.startService(spec);
    }
  }

  async stop() {
    this.stopping = true;
    this.updateState();

    const children = [...this.children.values()].map((entry) => entry.process);
    for (const child of children.reverse()) {
      child.kill("SIGTERM");
    }

    await sleep(1000);
    for (const child of children.reverse()) {
      if (!child.killed) {
        child.kill("SIGKILL");
      }
    }
  }
}

const env = {
  ...process.env,
  ...parseEnvFile(envFile),
};

const supervisor = new Supervisor({ env });

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    await supervisor.stop();
    process.exit(0);
  });
}

await supervisor.start();
await new Promise(() => {});
