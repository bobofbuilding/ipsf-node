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

### Phase 3: Customer Integrations
- [x] Define how `crypto-directory` hands built site artifacts to the shared library.
- [x] Define how `skillmesh` publishes skill definitions and artifacts through the shared library.
- [x] Define how `bitlogic` publishes artifacts through the shared library.
- [x] Define how `nftfactory` publishes metadata and prepared assets through the shared library.
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

### Phase 9: Bittrees Customer Expansion
- [x] Add `nftfactory` to the active Bittrees customer list for the shared IPFS package.
  - Result: the plan, design, README, integration docs, and task boards now treat `crypto-directory`, `skillmesh`, `bitlogic`, and `nftfactory` as the active Bittrees customer set.
- [x] Wire `nftfactory` into the shared package with project-level adapter scripts and shared gateway URL construction.
  - Result: `projects/nftfactory/package.json` now exposes `ipfs:publish` and `ipfs:publish:metadata`; the new scripts use `projects/ipfs-evm-system`, and the web metadata route now builds gateway URLs through the shared helper.

### Phase 10: Cross-Project Smoke Documentation
- [x] Add one shared smoke-validation guide for the active Bittrees customers.
  - Result: `docs/smoke-validation.md` now documents publish commands and expected outcomes for `crypto-directory`, `skillmesh`, `bitlogic`, and `nftfactory`.
- [x] Add a concrete NFTFactory sample metadata artifact for the smoke path.
  - Result: `projects/nftfactory/examples/smoke-metadata.json` can be published through `npm run ipfs:publish:metadata`.

### Phase 11: Smoke Orchestration Script
- [x] Turn the cross-project smoke guide into one executable shared-repo command.
  - Result: `npm run smoke:bittrees` now runs the four customer commands in sequence and prints a summarized CID/pin/gateway report.
- [x] Add parser tests for smoke output normalization.
  - Result: `test/smoke-bittrees.test.mjs` now covers JSON-style and line-oriented customer output parsing.

### Phase 12: Smoke JSON Output
- [x] Add a machine-readable `--json` mode to `smoke:bittrees`.
  - Result: the smoke runner can now emit one JSON report with node health and customer results for CI or ops tooling.

### Phase 13: Smoke Continue-On-Error
- [x] Add `--continue-on-error` support to the smoke runner.
  - Result: operators can now collect a full four-customer smoke report even when one customer fails.

### Phase 14: Smoke Customer Selection
- [x] Add customer filtering support to the smoke runner.
  - Result: operators can now target one customer with `--customer` or a subset with `--customers` instead of always running all four publish paths.

### Phase 15: Installer and Node Setup
- [x] Add a downloadable macOS/Linux node installer.
  - Result: `install-ipfs-node.sh` can be downloaded directly from GitHub to install Kubo, initialize a repo, and write helper start/env files.
- [x] Add a repo-local node setup command.
  - Result: `npm run node:setup` configures a local repo, API port, gateway port, and default CORS headers when Kubo is already installed.

### Phase 16: Auto-Start Service Files
- [x] Add generated service files for Linux and macOS installs.
  - Result: the installer now writes a `systemd` unit and a `launchd` plist so operators can register the IPFS node for auto-start.

### Phase 17: Release Packaging
- [x] Add release-packaging artifacts for the downloadable installer.
  - Result: `npm run release:prepare` now generates `dist/release/install-ipfs-node.sh` and a matching SHA-256 file.
- [x] Add tagged GitHub release publication for installer assets.
  - Result: pushes matching `v*` now publish the installer and checksum through `.github/workflows/release.yml`.

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
- `projects/nftfactory` for NFT metadata and media storage integration
- local Kubo availability for runtime validation
- GitHub repository access for repository publication

## Role Ownership
- `planner` owns future shared-library scope changes.
- `builder` owns package surface, tests, and consumer-facing helper correctness.
- `operator` owns backup-pin and recovery-path readiness.
- `task-manager` owns repository-publication follow-through and cross-board cleanup.

## Handoffs
- Next handoff: consumer projects can now reference the standalone repo as the canonical shared-IPFS package source.
