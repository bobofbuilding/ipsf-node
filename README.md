# IPFS Storage System

## Workspace Role

`projects/ipfs-evm-system` is the shared IPFS storage project for the workspace.

Its job is simple:

- run an IPFS node
- pin and serve content
- expose a shared library for other projects

It is infrastructure for the other projects, not a separate product.

## Active Bittrees Customers

- `projects/crypto-directory`
- `projects/skillmesh`
- `projects/bitlogic`
- `projects/nftfactory`
- future Bittrees and workspace projects that need content storage

## Related Artifacts

- Plan: `docs/processes/plan.md`
- Design: `docs/processes/design.md`
- Tasks: `docs/processes/tasks.md`

## Package Surface

Current package exports:

- `IpfsStorageClient`
- `detectPublishTarget`
- `getIpfsStorageConfig`
- `buildGatewayUrl`
- `normalizeIpfsCid`
- `resolveJsonFromGateway`
- `createArtifactMetadata`
- `publishProjectPath`
- `publishJsonArtifact`

Current client operations:

- `publishFile`
- `publishDirectory`
- `publishBlob`
- `publishJson`
- `pinCid`
- `unpinCid`
- `resolveCid`
- `checkCidHealth`
- `checkNodeHealth`
- `ensurePinned`

The package is ESM-first and now ships TypeScript declarations at `src/index.d.ts` for downstream consumers.

## Build and Verification

- `npm run check`
- `npm run test`
- `npm run build`
- `bash -n ./install-ipfs-node.sh`
- `bash -n ./scripts/start-node.sh`
- `npm run release:prepare`
- `npm run release:validate`
- `npm run release:validate -- --json --report-file <path>`
  verifies `release-validation-report.json` too when that file exists beside the bundle
- `npm run release:verify-download -- --tag <version>`
- `npm run release:verify-download -- --json`

`npm run build` is the baseline repository verification path and currently runs syntax checks plus gateway-helper, CLI-script, and client-transport tests.

GitHub Actions runs the same verification on every push to `main` and every pull request via `.github/workflows/ci.yml`.

## Environment

Copy values from `.env.example` into the environment used by the consuming project or shell:

- `IPFS_API_BASE_URL`
- `IPFS_GATEWAY_BASE_URL`
- `IPFS_API_BEARER_TOKEN`
- `IPFS_API_BASIC_AUTH_USERNAME`
- `IPFS_API_BASIC_AUTH_PASSWORD`
- `IPFS_DEFAULT_SOURCE_PROJECT`

Defaults assume a local Kubo node:

- API: `http://127.0.0.1:5001`
- Gateway: `http://127.0.0.1:8080`

For protected API endpoints, prefer `IPFS_API_BEARER_TOKEN`. Basic auth is also supported when both `IPFS_API_BASIC_AUTH_USERNAME` and `IPFS_API_BASIC_AUTH_PASSWORD` are set.

For zero-downtime bearer token rotation, the proxy also accepts `IPFS_API_BEARER_TOKEN_SECONDARY`. During rotation, keep the current token in `IPFS_API_BEARER_TOKEN`, place the next token in `IPFS_API_BEARER_TOKEN_SECONDARY`, redeploy the app with the next token, verify uploads, then promote the next token into `IPFS_API_BEARER_TOKEN` and remove the secondary value.

When exposing the writable Kubo API through a public ingress such as Cloudflare Tunnel, do not point the public hostname at raw Kubo on `127.0.0.1:5001`. Run `npm run api:proxy` and route the tunnel to `http://127.0.0.1:${IPFS_API_PROXY_PORT:-5002}` instead so auth is enforced locally before requests reach Kubo.

An example Cloudflare Tunnel config for that pattern is in `examples/cloudflared-ipfs-api-config.yml`. Replace the tunnel UUID, credentials path, and hostname as needed, then run `cloudflared tunnel --config <that-file> run`.

This repo also includes `npm run tunnel:start`, which accepts any one of:

- `IPFS_CLOUDFLARED_TUNNEL_TOKEN`
- `IPFS_CLOUDFLARED_CONFIG`
- `IPFS_CLOUDFLARED_TUNNEL_ID`

Recommended operator flow on the host:

1. `npm run node:setup`
2. `./scripts/start-node.sh`
3. `npm run api:proxy`
4. `npm run tunnel:start`

For repo-local process management without systemd, use:

- `npm run stack:start`
- `npm run stack:status`
- `npm run stack:stop`

These keep pidfiles and logs under `.runtime/`.

For real host-level detached processes that survive the current shell session and can be controlled from the repo, use:

- `npm run host:stack:start`
- `npm run host:stack:status`
- `npm run host:stack:stop`

These keep pidfiles and logs under `.runtime-host/`. Use the host-level commands for the live Cloudflare-connected stack.

When `systemd` is not available on the host, use the long-running supervisor instead:

- `npm run host:supervisor`

That keeps the Kubo daemon, local auth proxy, and Cloudflare tunnel under one parent process and restarts them if they exit. It also writes runtime state to `.runtime-host/supervisor-state.json`.

For reboot startup on hosts that use cron, the repo also includes:

- `./scripts/start-host-supervisor.sh`

Recommended `@reboot` entry:

```bash
@reboot /workspace/projects/ipfs-evm-system/scripts/start-host-supervisor.sh
```

On hosts with systemd available, install persistent user units with:

- `npm run systemd:install`

That renders service templates from `systemd/` into `~/.config/systemd/user/`, enables:

- `ipfs-node.service`
- `ipfs-api-proxy.service`
- `ipfs-cloudflared.service`

and leaves final service start/stop/status under `systemctl --user`.

When using a config file, point the public hostname at `http://127.0.0.1:5002`, not raw Kubo on `127.0.0.1:5001`.

## Install and Setup

Downloadable bootstrap for macOS and Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/bobofbuilding/ipsf-node/main/install-ipfs-node.sh -o install-ipfs-node.sh
bash install-ipfs-node.sh
```

Stable release download target:

```bash
curl -fsSL https://github.com/bobofbuilding/ipsf-node/releases/latest/download/install-ipfs-node.sh -o install-ipfs-node.sh
curl -fsSL https://github.com/bobofbuilding/ipsf-node/releases/latest/download/install-ipfs-node.sh.sha256 -o install-ipfs-node.sh.sha256
curl -fsSL https://github.com/bobofbuilding/ipsf-node/releases/latest/download/release-manifest.json -o release-manifest.json
curl -fsSL https://github.com/bobofbuilding/ipsf-node/releases/latest/download/release-validation-report.json -o release-validation-report.json
shasum -a 256 -c install-ipfs-node.sh.sha256
bash install-ipfs-node.sh
```

One-command bundle download and validation:

```bash
npm run release:verify-download -- --tag v0.1.0
npm run release:verify-download -- --json
npm run release:verify-download -- --json --report-file dist/release/verify-report.json
```

Manual bundle validation after download:

```bash
mkdir -p dist/release
mv install-ipfs-node.sh install-ipfs-node.sh.sha256 release-manifest.json release-validation-report.json dist/release/
npm run release:validate
# if release-validation-report.json is present, this also verifies that report matches the bundle
```

Tagged releases also generate GitHub Artifact Attestations for the installer bundle through `.github/workflows/release.yml`, and they now publish `release-validation-report.json` alongside the installer assets. When that file is present locally, `npm run release:validate` verifies it as part of the bundle.

Full operator runbook: `docs/release-verification.md`

Repo-local setup when `ipfs` is already installed:

```bash
cd /path/to/ipsf-node
npm run node:setup
./scripts/start-node.sh
```

The installer also writes OS service templates:

- Linux: `ipfs-node.service`
- macOS: `com.bittrees.ipfs-node.plist`

## Runtime Scripts

- `npm run node:setup`
- `npm run node:preflight`
- `npm run node:wait`
- `npm run node:check`
- `npm run recovery:export -- [output-dir]`
- `npm run publish:path -- <path> [source-project]`
- `npm run publish:skillmesh-definition -- <definition-json-path>`
- `npm run smoke:bittrees`
  JSON mode: `npm run smoke:bittrees -- --json`
  Continue on error: `npm run smoke:bittrees -- --continue-on-error`
  Single customer: `npm run smoke:bittrees -- --customer nftfactory`
  Multiple customers: `npm run smoke:bittrees -- --customers skillmesh,nftfactory`

Local startup script:

- `./install-ipfs-node.sh`
- `./scripts/start-node.sh`

## Usage Sketch

```js
import { IpfsStorageClient, buildGatewayUrl } from "@workspace/ipfs-storage";

const client = new IpfsStorageClient({
  apiBaseUrl: process.env.IPFS_API_BASE_URL,
  gatewayBaseUrl: process.env.IPFS_GATEWAY_BASE_URL,
  apiBearerToken: process.env.IPFS_API_BEARER_TOKEN,
  apiBasicAuthUsername: process.env.IPFS_API_BASIC_AUTH_USERNAME,
  apiBasicAuthPassword: process.env.IPFS_API_BASIC_AUTH_PASSWORD,
  defaultSourceProject: "crypto-directory",
});

const release = await client.publishDirectory({
  directoryPath: "/workspace/projects/crypto-directory/site",
});

console.log(release.cid);
console.log(buildGatewayUrl({
  gatewayBaseUrl: process.env.IPFS_GATEWAY_BASE_URL ?? "http://127.0.0.1:8080",
  cid: release.cid,
}));
```

SkillMesh now has a shared adapter in this project: `npm run publish:skillmesh-definition -- <definition-json-path>`.
Other consumer-specific adapters should live in the projects that use this package when they need project-specific metadata or validation.

## Accepted First-Version Policy

- publish calls pin by default
- the shared library stays stateless and only returns optional metadata to the caller
- consuming projects keep their own durable cid, artifact, and timestamp records
- backup recovery starts with `npm run recovery:export` from the primary repo rather than a second hosted pin service

## Current Node Assumptions

- one shared Kubo node
- local persistent storage managed outside this package
- consumer projects connect through env-configured API and gateway URLs
- first-version backup uses exported recovery artifacts from the primary repo instead of a second hosted pin target
- local node state and exported recovery artifacts stay out of git
- Kubo installation is still an environment prerequisite outside this repo
