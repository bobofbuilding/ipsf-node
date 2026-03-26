/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function getIpfsStorageConfig(env = process.env) {
  return {
    apiBaseUrl: env.IPFS_API_BASE_URL ?? "http://127.0.0.1:5001",
    gatewayBaseUrl: env.IPFS_GATEWAY_BASE_URL ?? "http://127.0.0.1:8080",
    defaultSourceProject: env.IPFS_DEFAULT_SOURCE_PROJECT ?? null,
    cliPath: env.IPFS_CLI_PATH ?? "/workspace/tools/kubo/ipfs",
    repoPath: env.IPFS_PATH ?? "/workspace/projects/ipfs-evm-system/.local-ipfs",
  };
}
