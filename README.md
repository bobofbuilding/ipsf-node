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
- `npm run release:verify-download -- --tag <version>`
- `npm run release:verify-download -- --json`

`npm run build` is the baseline repository verification path and currently runs syntax checks plus gateway-helper, CLI-script, and client-transport tests.

GitHub Actions runs the same verification on every push to `main` and every pull request via `.github/workflows/ci.yml`.

## Environment

Copy values from `.env.example` into the environment used by the consuming project or shell:

- `IPFS_API_BASE_URL`
- `IPFS_GATEWAY_BASE_URL`
- `IPFS_DEFAULT_SOURCE_PROJECT`

Defaults assume a local Kubo node:

- API: `http://127.0.0.1:5001`
- Gateway: `http://127.0.0.1:8080`

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
shasum -a 256 -c install-ipfs-node.sh.sha256
bash install-ipfs-node.sh
```

One-command bundle download and validation:

```bash
npm run release:verify-download -- --tag v0.1.0
npm run release:verify-download -- --json
```

Manual bundle validation after download:

```bash
mkdir -p dist/release
mv install-ipfs-node.sh install-ipfs-node.sh.sha256 release-manifest.json dist/release/
npm run release:validate
```

Tagged releases also generate GitHub Artifact Attestations for the installer bundle through `.github/workflows/release.yml`.

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

Consumer-specific adapters should live in the projects that use this package.

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
