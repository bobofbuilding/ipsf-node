# Integrations

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
- publish artifacts through `publishFile` or `publishDirectory`
- resolve artifacts through `resolveCid`
- keep runtime and protocol logic in `skillmesh`

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
