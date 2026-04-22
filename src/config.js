import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

function resolveDefaultCliPath(existsSync = fs.existsSync) {
  const repoLocalCliPath = path.join(rootDir, ".tools", "kubo", "ipfs");
  const workspaceCliPath = "/workspace/tools/kubo/ipfs";

  if (existsSync(repoLocalCliPath)) {
    return repoLocalCliPath;
  }

  if (existsSync(workspaceCliPath)) {
    return workspaceCliPath;
  }

  return "ipfs";
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @param {{ existsSync?: typeof fs.existsSync }} [deps]
 */
export function getIpfsStorageConfig(env = process.env, { existsSync = fs.existsSync } = {}) {
  return {
    apiBaseUrl: env.IPFS_API_BASE_URL ?? "http://127.0.0.1:5001",
    gatewayBaseUrl: env.IPFS_GATEWAY_BASE_URL ?? "http://127.0.0.1:8080",
    apiBearerToken: env.IPFS_API_BEARER_TOKEN ?? null,
    apiBasicAuthUsername: env.IPFS_API_BASIC_AUTH_USERNAME ?? null,
    apiBasicAuthPassword: env.IPFS_API_BASIC_AUTH_PASSWORD ?? null,
    apiProxyPort: env.IPFS_API_PROXY_PORT ?? "5002",
    apiProxyUpstreamUrl: env.IPFS_API_PROXY_UPSTREAM_URL ?? "http://127.0.0.1:5001",
    defaultSourceProject: env.IPFS_DEFAULT_SOURCE_PROJECT ?? null,
    cliPath: env.IPFS_CLI_PATH ?? resolveDefaultCliPath(existsSync),
    repoPath: env.IPFS_PATH ?? path.join(rootDir, ".local-ipfs"),
    localOnly: ["1", "true", "yes", "on"].includes(String(env.IPFS_LOCAL_ONLY ?? "").trim().toLowerCase()),
  };
}
