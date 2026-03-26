# Tasks: IPFS Storage System
Source: plans/ipfs-evm-system.md
Updated: 2026-03-26

## Status: Complete

Current execution slice: harden `projects/ipfs-evm-system` into a repository-ready shared IPFS package with correct gateway helpers, package typing, baseline tests, and clean git boundaries.
Design-impact review result: the current board now needs to track repository/build readiness, not just scope cleanup.

### Phase 0: Scope Cleanup
- [x] Review the current IPFS plan, design, and task board.
- [x] Review how `crypto-directory`, `skillmesh`, and `bitlogic` relate to IPFS.
- [x] Shrink the IPFS project scope to shared storage infrastructure.
- [x] Set the default integration surface to a shared library.
- [x] Bring Bitlogic into scope as a planned integration consumer.

### Phase 1: Shared Node Setup
- [x] Define how the Kubo node should run.
- [x] Define pinning behavior.
- [x] Define backup pinning.
- [x] Define node health checks.
- [x] Define basic recovery steps.
  - Current node scripts: `scripts/start-node.sh`, `scripts/preflight-node.mjs`, `scripts/wait-for-node.mjs`, `scripts/check-node.mjs`

### Phase 2: Shared Library
- [x] Define the library API.
- [x] Define library config and connection handling.
- [x] Define minimal metadata handling.
- [x] Define error and retry behavior.
- [x] Fix the public gateway helper contract so exported URLs resolve to `/ipfs/<cid>` paths.
  - Result: `src/gateway.js` now normalizes `ipfs://`, `/ipfs/`, and `ipfs/` inputs and always builds `/ipfs/<cid>` gateway URLs.

### Phase 3: Consumer Integrations
- [x] Define how `crypto-directory` hands built site artifacts to the shared library.
- [x] Define how `skillmesh` publishes skill definitions and artifacts through the shared library.
- [x] Define how `bitlogic` publishes artifacts through the shared library.
- [x] Keep durable CID records, release notes, and product policy local to the consuming projects.

### Phase 4: Build and Package Readiness
- [x] Add explicit package entry metadata for standalone consumption.
  - Result: `package.json` now exposes `main`, `types`, `files`, and structured `exports`.
- [x] Add TypeScript declarations for the public package surface.
  - Result: `src/index.d.ts` covers the exported client, config, gateway, and artifact helpers.
- [x] Add baseline automated tests for the public gateway helpers.
  - Result: `test/gateway.test.mjs` verifies CID normalization and `/ipfs/<cid>` gateway URL construction.
- [x] Add a simple build entrypoint that verifies parseability and tests.
  - Result: `npm run build` now runs `npm run check && npm run test`.
- [x] Add git hygiene for local node state and recovery outputs.
  - Result: `.gitignore` now excludes `.local-ipfs`, `recovery/`, `.DS_Store`, and npm debug logs.

### Phase 5: Repository Publication
- [x] Initialize the project as its own git repository.
- [x] Set the remote to `https://github.com/bobofbuilding/ipsf-node.git`.
- [x] Commit the repository-ready IPFS package state.
- [x] Push `main` to GitHub.

## Verification
- [x] `cd /workspace/projects/ipfs-evm-system && npm run check`
- [x] `cd /workspace/projects/ipfs-evm-system && npm run test`
- [x] `cd /workspace/projects/ipfs-evm-system && npm run build`

### Phase 6: Repository Hardening
- [x] Add GitHub Actions CI for push and pull request verification.
  - Result: `.github/workflows/ci.yml` now runs `npm install` and `npm run build` on `main` pushes and pull requests.
- [x] Add standalone package metadata for repository consumers.
  - Result: `package.json` now includes repository, homepage, bugs, keywords, license, and Node engine metadata.

### Phase 7: CLI Test Coverage
- [x] Refactor operator-facing scripts for importable execution and dependency injection.
  - Result: `check-node.mjs`, `preflight-node.mjs`, `publish-path.mjs`, and `export-recovery-artifacts.mjs` now expose testable runner functions while preserving CLI behavior.
- [x] Add CLI-level tests for shipped operator entrypoints.
  - Result: `test/scripts.test.mjs` now covers healthy and failing node checks, preflight behavior, publish-path usage and file publishing, and recovery-export artifact generation.

### Phase 8: Client Transport Coverage
- [x] Add mocked transport tests for the shared IPFS client RPC contract.
  - Result: `test/client.test.mjs` now covers `publishFile`, `publishDirectory`, `publishJson`, `pinCid`, `unpinCid`, `checkCidHealth`, `resolveCid`, `checkNodeHealth`, and `ensurePinned` with mocked fetch responses.

## Blockers
- None currently.

## Publication Result
- GitHub repo: `git@github.com:bobofbuilding/ipsf-node.git`
- Branch: `main`
- Initial publish commit: `4da4bae` (`Bootstrap IPFS storage repo`)

## Open Questions
- Should the package stay ESM-only, or should a later release add dual ESM/CJS packaging?
- Should CAR exports join the recovery manifest flow for the highest-value artifact sets?

## Dependencies
- `projects/crypto-directory` for static-site publishing
- `projects/skillmesh` for artifact publishing and resolution
- `projects/bitlogic` for report, export, and evidence storage integration
- local Kubo availability for runtime validation
- GitHub repository access for repository publication

## Role Ownership
- `planner` owns future shared-library scope changes.
- `builder` owns package surface, tests, and consumer-facing helper correctness.
- `operator` owns backup-pin and recovery-path readiness.
- `task-manager` owns repository-publication follow-through and cross-board cleanup.

## Handoffs
- Next handoff: consumer projects can now reference the standalone repo as the canonical shared-IPFS package source.
