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

## Runtime Scripts

- `npm run node:preflight`
- `npm run node:wait`
- `npm run node:check`
- `npm run recovery:export -- [output-dir]`
- `npm run publish:path -- <path> [source-project]`
- `npm run smoke:bittrees`

Local startup script:

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
