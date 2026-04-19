import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { getIpfsStorageConfig, IpfsStorageClient } from "../src/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const workspaceDir = path.resolve(rootDir, "..");

const BITTREES_CUSTOMERS = [
  {
    name: "crypto-directory",
    cwd: path.join(workspaceDir, "crypto-directory"),
    command: ["npm", "run", "publish:ipfs"],
  },
  {
    name: "skillmesh",
    cwd: rootDir,
    command: [
      "npm",
      "run",
      "publish:skillmesh-definition",
      "--",
      path.join(workspaceDir, "skillmesh", "examples", "smoke-skill-definition.json"),
    ],
  },
  {
    name: "bitlogic",
    cwd: path.join(workspaceDir, "bitlogic"),
    command: ["npm", "run", "ipfs:publish", "--", "docs/sepolia-validation-checklist.md", "audit-evidence-bundle"],
  },
  {
    name: "nftfactory",
    cwd: path.join(workspaceDir, "nftfactory"),
    command: ["npm", "run", "ipfs:publish:metadata", "--", "examples/smoke-metadata.json", "nft-metadata-json"],
  },
];

function trimLine(value) {
  return String(value ?? "").trim();
}

function parseCustomerNames(value) {
  return String(value ?? "")
    .split(",")
    .map((entry) => trimLine(entry))
    .filter(Boolean);
}

export function parseSmokeArgs(argv = process.argv.slice(2)) {
  const json = argv.includes("--json");
  const continueOnError = argv.includes("--continue-on-error") || json;
  const selectedCustomers = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--customer") {
      selectedCustomers.push(...parseCustomerNames(argv[index + 1] ?? ""));
      index += 1;
      continue;
    }

    if (arg.startsWith("--customer=")) {
      selectedCustomers.push(...parseCustomerNames(arg.slice("--customer=".length)));
      continue;
    }

    if (arg === "--customers") {
      selectedCustomers.push(...parseCustomerNames(argv[index + 1] ?? ""));
      index += 1;
      continue;
    }

    if (arg.startsWith("--customers=")) {
      selectedCustomers.push(...parseCustomerNames(arg.slice("--customers=".length)));
    }
  }

  return {
    json,
    continueOnError,
    selectedCustomers,
  };
}

export function selectCustomers(customers, selectedCustomers) {
  const requested = Array.from(new Set((selectedCustomers ?? []).map((name) => trimLine(name)).filter(Boolean)));

  if (requested.length === 0) {
    return {
      selected: customers,
      invalid: [],
    };
  }

  const selected = customers.filter((customer) => requested.includes(customer.name));
  const invalid = requested.filter((name) => !customers.some((customer) => customer.name === name));

  return {
    selected,
    invalid,
  };
}

export function extractJsonObject(output) {
  for (let index = output.lastIndexOf("{"); index >= 0; index = output.lastIndexOf("{", index - 1)) {
    const candidate = output.slice(index).trim();
    try {
      return JSON.parse(candidate);
    } catch {
    }
  }

  return null;
}

export function summarizeSmokeOutput(customerName, output, exitCode) {
  const normalized = String(output ?? "");
  const json = extractJsonObject(normalized);
  const lines = normalized.split(/\r?\n/).map(trimLine).filter(Boolean);

  if (json) {
    return {
      customer: customerName,
      ok: exitCode === 0,
      exitCode,
      cid: trimLine(json.cid ?? json.metadataUri ?? "") || null,
      pinned:
        typeof json.pinStatus?.pinned === "boolean"
          ? json.pinStatus.pinned
          : typeof json.pinned === "boolean"
            ? json.pinned
            : typeof json.verified === "boolean"
              ? json.verified
              : null,
      gatewayAvailable:
        typeof json.health?.available === "boolean"
          ? json.health.available
          : null,
      gatewayUrl: trimLine(json.gatewayUrl ?? json.metadataGatewayUrl ?? "") || null,
      artifactKind: trimLine(json.artifactKind ?? "") || null,
      rawOutput: normalized,
    };
  }

  const cidLine = lines.find((line) => line.startsWith("CID:"));
  const pinnedLine = lines.find((line) => /^Pinned:/i.test(line));
  const gatewayAvailableLine = lines.find((line) => /^Gateway available:/i.test(line));
  const gatewayIndex = lines.findIndex((line) => /^Gateway URL:?$/i.test(line));
  const gatewayUrl = gatewayIndex >= 0 ? lines[gatewayIndex + 1] ?? null : null;

  return {
    customer: customerName,
    ok: exitCode === 0,
    exitCode,
    cid: cidLine ? trimLine(cidLine.split(":").slice(1).join(":")) : null,
    pinned: pinnedLine ? /yes$/i.test(pinnedLine) : null,
    gatewayAvailable: gatewayAvailableLine ? /yes$/i.test(gatewayAvailableLine) : null,
    gatewayUrl: gatewayUrl && !gatewayUrl.startsWith(">") ? gatewayUrl : null,
    artifactKind: null,
    rawOutput: normalized,
  };
}

export function buildSmokeReport(nodeHealth, results) {
  return {
    ok: results.every((result) => result.ok),
    checkedAt: new Date().toISOString(),
    node: {
      available: nodeHealth.available,
      version: nodeHealth.version ?? null,
      id: nodeHealth.id ?? null,
      error: nodeHealth.error ?? null,
    },
    customers: results,
  };
}

function printSummary(results, stdout = console.log) {
  stdout("");
  stdout("Bittrees smoke summary:");

  for (const result of results) {
    const status = result.ok ? "ok" : "failed";
    stdout(`- ${result.customer}: ${status}`);
    stdout(`  cid: ${result.cid ?? "n/a"}`);
    stdout(`  pinned: ${result.pinned === null ? "n/a" : result.pinned ? "yes" : "no"}`);
    stdout(`  gateway: ${result.gatewayAvailable === null ? "n/a" : result.gatewayAvailable ? "yes" : "no"}`);
    stdout(`  gatewayUrl: ${result.gatewayUrl ?? "n/a"}`);
    if (result.artifactKind) {
      stdout(`  artifactKind: ${result.artifactKind}`);
    }
  }
}

export async function runCustomerCommand(customer, {
  stdout = console.log,
  stderr = console.error,
  streamOutput = true,
} = {}) {
  stdout("");
  stdout(`==> ${customer.name}`);
  stdout(`cwd: ${customer.cwd}`);
  stdout(`cmd: ${customer.command.join(" ")}`);

  return new Promise((resolve) => {
    const child = spawn(customer.command[0], customer.command.slice(1), {
      cwd: customer.cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let combined = "";

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      combined += text;
      if (streamOutput) {
        process.stdout.write(text);
      }
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      combined += text;
      if (streamOutput) {
        process.stderr.write(text);
      }
    });

    child.on("close", (code) => {
      resolve(summarizeSmokeOutput(customer.name, combined, code ?? 1));
    });

    child.on("error", (error) => {
      stderr(`${customer.name}: failed to start command: ${error.message}`);
      resolve({
        customer: customer.name,
        ok: false,
        exitCode: 1,
        cid: null,
        pinned: null,
        gatewayAvailable: null,
        gatewayUrl: null,
        artifactKind: null,
        rawOutput: error.message,
      });
    });
  });
}

export async function runSmokeBittrees({
  stdout = console.log,
  stderr = console.error,
  json = false,
  continueOnError = json,
  selectedCustomers = [],
  client = new IpfsStorageClient(getIpfsStorageConfig()),
  customers = BITTREES_CUSTOMERS,
  runCustomer = runCustomerCommand,
} = {}) {
  const { selected, invalid } = selectCustomers(customers, selectedCustomers);

  if (invalid.length > 0) {
    const message = `unknown customers: ${invalid.join(", ")}`;
    if (json) {
      stdout(JSON.stringify({
        ok: false,
        checkedAt: new Date().toISOString(),
        node: {
          available: null,
          version: null,
          id: null,
          error: message,
        },
        customers: [],
      }, null, 2));
    } else {
      stderr(message);
    }
    return 1;
  }

  const nodeHealth = await client.checkNodeHealth();

  if (!nodeHealth.available) {
    if (json) {
      const report = buildSmokeReport(nodeHealth, []);
      stdout(JSON.stringify(report, null, 2));
    } else {
      stderr("ipfs-node:unavailable");
      if (nodeHealth.error) {
        stderr(nodeHealth.error);
      }
    }
    return 1;
  }

  if (!json) {
    stdout("ipfs-node:available");
    stdout(`version=${nodeHealth.version ?? "unknown"}`);
    stdout(`id=${nodeHealth.id ?? "unknown"}`);
  }

  const results = [];
  for (const customer of selected) {
    const result = await runCustomer(customer, {
      stdout,
      stderr,
      streamOutput: !json,
    });

    results.push(result);

    if (!result.ok && !continueOnError) {
      break;
    }
  }

  const report = buildSmokeReport(nodeHealth, results);

  if (json) {
    stdout(JSON.stringify(report, null, 2));
  } else {
    printSummary(results, stdout);
  }

  return report.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = parseSmokeArgs();
  const exitCode = await runSmokeBittrees(options);
  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}
