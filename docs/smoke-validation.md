# Cross-Project Smoke Validation

Use this guide when you want to confirm the shared IPFS node and customer adapters work across the active Bittrees projects.

## One Command

Run the full Bittrees customer smoke pass from the shared repo:

```bash
cd /workspace/projects/ipfs-evm-system
npm run smoke:bittrees
```

The script runs the four customer publish commands in sequence and prints one summary with CID, pin, and gateway results.

Machine-readable mode:

```bash
cd /workspace/projects/ipfs-evm-system
npm run smoke:bittrees -- --json
```

This prints a single JSON report with node health and one result object per customer.

To keep going after the first failing customer and still collect the full report:

```bash
cd /workspace/projects/ipfs-evm-system
npm run smoke:bittrees -- --continue-on-error
```

## Preconditions

- the shared Kubo node is reachable through the configured API and gateway URLs
- `cd /workspace/projects/ipfs-evm-system && npm run node:check` returns `ipfs-node:available`
- each customer project can resolve the shared package at `../../ipfs-evm-system/src/index.js`

## Customer Smoke Commands

### Crypto Directory

```bash
cd /workspace/projects/crypto-directory
npm run publish:ipfs
```

Expected result:

- prints a release CID
- prints `Pinned: yes`
- prints a gateway URL ending in `/ipfs/<cid>/`

### SkillMesh

```bash
cd /workspace/projects/skillmesh
npm run ipfs:publish:skill-definition
```

Expected result:

- prints a JSON result with a CID and gateway URL
- returns a published `skill-definition` artifact through the shared package

### Bitlogic

```bash
cd /workspace/projects/bitlogic
npm run ipfs:publish -- docs/sepolia-validation-checklist.md audit-evidence-bundle
```

Expected result:

- prints a JSON result with `artifactKind` `audit-evidence-bundle`
- returns `verified: true` when pinning and gateway checks both pass

### NFTFactory

```bash
cd /workspace/projects/nftfactory
npm run ipfs:publish:metadata -- examples/smoke-metadata.json nft-metadata-json
```

Expected result:

- prints a JSON result with `artifactKind` `nft-metadata-json`
- returns metadata that includes `nftName` `Smoke NFT`
- returns `verified: true` when pinning and gateway checks both pass

## Optional Gateway Check

After each publish, confirm the returned gateway URL resolves through the shared gateway base:

```bash
cd /workspace/projects/ipfs-evm-system
npm run publish:path -- README.md ipfs-evm-system
```

Then inspect the returned `gatewayUrl` or resolve the CID through a browser or `curl` against `IPFS_GATEWAY_BASE_URL`.

## Failure Triage

- If every customer fails, start at `cd /workspace/projects/ipfs-evm-system && npm run node:check`.
- If one customer fails before publish, inspect that project's local adapter script and input artifact path.
- If publish succeeds but `verified` is false, inspect gateway reachability and pin state on the shared node.
- If only NFTFactory fails in the web route, validate `IPFS_API_URL` auth and the app-local TypeScript shim at `apps/web/ipfs-storage-shared.d.ts`.
