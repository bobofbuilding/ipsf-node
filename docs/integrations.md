# Integrations

See also: `docs/smoke-validation.md` and `npm run smoke:bittrees` for the cross-project publish flow.


## Crypto Directory

Expected usage:

- build the static site locally
- publish the built `site/` directory through `publishDirectory`
- capture the returned CID in the project-local release flow
- keep ENS updates and `releases.md` in `crypto-directory`

Current entrypoint:

- `cd /workspace/projects/crypto-directory && npm run publish:ipfs`

## SkillMesh

Expected usage:

- prepare skill manifests and artifact payloads locally
- publish skill definitions through `npm run publish:skillmesh-definition -- <definition-json-path>` in `ipfs-evm-system`
- resolve artifacts through `resolveCid`
- keep runtime and protocol logic in `skillmesh`

Current entrypoints:

- `cd /workspace/projects/ipfs-evm-system && npm run publish:skillmesh-definition -- /workspace/projects/skillmesh/examples/smoke-skill-definition.json`
- `cd /workspace/projects/skillmesh && npm run ipfs:publish:skill-definition`
  delegates to the shared adapter in `ipfs-evm-system`

## Bitlogic

Expected first storage targets:

- generated reports
- exported data bundles
- audit evidence bundles

Expected usage:

- generate the artifact locally inside Bitlogic
- publish it through the shared library
- store the returned CID in Bitlogic-owned state or records
- keep access rules and document semantics in Bitlogic

Current entrypoint:

- `cd /workspace/projects/bitlogic && npm run ipfs:publish -- <path> [artifact-kind]`


## NFTFactory

Expected usage:

- prepare NFT metadata JSON or drop-supporting assets locally
- publish prepared files through the shared library or the project adapter scripts
- build gateway URLs through the shared gateway helper for consistent `/ipfs/<cid>` resolution
- keep upload auth, mint flow, and storefront behavior in `nftfactory`

Current entrypoints:

- `cd /workspace/projects/nftfactory && npm run ipfs:publish -- <path> [artifact-kind]`
- `cd /workspace/projects/nftfactory && npm run ipfs:publish:metadata -- <metadata-json-path> [artifact-kind]`
- `projects/nftfactory/apps/web/app/api/ipfs/metadata/route.ts` now uses the shared gateway helper for returned gateway URLs
