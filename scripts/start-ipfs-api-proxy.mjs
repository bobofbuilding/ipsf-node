import { pathToFileURL } from "node:url";

import { createIpfsApiProxyServer, getIpfsApiProxyAuthMode } from "../src/api-proxy.js";
import { getIpfsStorageConfig } from "../src/config.js";

export async function runIpfsApiProxy({
  env = process.env,
  stdout = console.log,
  stderr = console.error,
} = {}) {
  const config = getIpfsStorageConfig(env);
  const authMode = getIpfsApiProxyAuthMode(env);

  if (authMode === "none") {
    stderr(
      "ipfs-api-proxy:auth-missing Set IPFS_API_BEARER_TOKEN, both IPFS_API_BASIC_AUTH variables, or ALLOW_PUBLIC_IPFS_API_WITHOUT_AUTH=1."
    );
    return 1;
  }

  const proxy = createIpfsApiProxyServer({
    env,
    upstreamBaseUrl: config.apiProxyUpstreamUrl,
    port: Number.parseInt(config.apiProxyPort, 10) || 5002,
    stdout,
    stderr,
  });

  await proxy.listen();
  stdout(`ipfs-api-proxy:auth-mode=${authMode}`);
  return new Promise(() => {});
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await runIpfsApiProxy();
  if (typeof result === "number" && result !== 0) {
    process.exitCode = result;
  }
}
