# IPFS Storage System

## Current Status

- `projects/ipfs-evm-system` now exists as a working shared-library and node-operations package for the workspace.
- The current gap is not core scope definition anymore; it is packaging and repository readiness for standalone ownership on GitHub.
- The next execution slice is to keep the library small, typed, testable, and easy for `crypto-directory`, `skillmesh`, and `bitlogic` to consume.

## Objective

Build `ipfs-evm-system` as the shared IPFS storage project for the workspace:

- run and operate a shared IPFS node
- publish, pin, and resolve content through a reusable shared library
- support `crypto-directory`, `skillmesh`, and `bitlogic` through one small integration surface
- package the project cleanly enough to live as its own GitHub repository without carrying local workspace noise

## Intended Consumers

- `crypto-directory` for static site release publishing
- `skillmesh` for skill-definition and artifact storage
- `bitlogic` for document, export, and audit-evidence storage
- future projects that need immutable file or content storage

## Scope

In scope:

- one shared IPFS node setup
- storage and pinning conventions
- a shared library for publish, pin, and resolve operations
- health checks, backup pinning, and basic operations
- package metadata, export shape, and test coverage for the shared library
- integration notes for `crypto-directory`, `skillmesh`, and `bitlogic`

Out of scope for now:

- a large standalone EVM control plane
- complex approval workflows
- generic sequencing infrastructure
- moving all project logic into the IPFS project
- hosted multi-node orchestration beyond the first local-plus-recovery model

## Project Shape

`projects/ipfs-evm-system` should be treated as infrastructure plus a shared integration library.

It should own:

- IPFS node configuration and operations
- a shared library for publish, pin, resolve, and health checks
- package-level typing and verification for consumers
- minimal metadata conventions where helpful
- health monitoring and recovery notes

It should not own:

- `crypto-directory` build logic
- `skillmesh` runtime logic
- `bitlogic` document-generation logic

Those remain in their own projects and call into the shared IPFS library.

## Shared Library Model

The default integration surface should be a shared JavaScript library with TypeScript declarations used by other projects.

That library should provide a small set of capabilities:

- publish files
- publish directories
- pin CIDs
- unpin CIDs
- resolve CIDs
- check CID health
- expose stable gateway helpers for browser and server consumers

Optional helpers can be added later for:

- lightweight metadata recording
- project-specific wrappers

The first version should stay library-first. A service wrapper can be added later only if operations or deployment needs make it necessary.

## Consumer Fit

### `crypto-directory`

Uses the shared library to:

- publish built `site/` directories
- pin release CIDs
- verify published releases remain available

Keeps local ownership of:

- audit and build flow
- ENS update flow
- release history and release notes

### `skillmesh`

Uses the shared library to:

- publish skill definitions and artifacts
- resolve CIDs for SDK and runtime flows
- reuse pin and availability checks

Keeps local ownership of:

- skill-definition schema
- runtime logic
- onchain protocol behavior

### `bitlogic`

Uses the shared library to:

- publish exported reports
- publish audit evidence bundles
- publish or retrieve supporting documents as Bitlogic grows into that need

Keeps local ownership of:

- accounting workflows
- access rules and product logic
- any later encryption or retrieval rules specific to bookkeeping data

## First Executable Milestone

The first milestone is a repository-ready shared IPFS storage project that includes:

- node runtime assumptions
- a shared library interface
- pinning and health-check operations
- basic tests for the public gateway helpers
- package metadata and types for downstream consumers
- integration notes for `crypto-directory`, `skillmesh`, and `bitlogic`

## Phased Delivery

### Phase 0: Planning Cleanup

- simplify the IPFS docs around the storage-node and shared-library goal
- make the shared library the default implementation path
- include Bitlogic as an in-scope consumer

### Phase 1: Shared Node and Operations

- define how the IPFS node runs
- define storage locations and pinning expectations
- define backup pinning and recovery basics
- define health checks and operational scripts

### Phase 2: Shared Library

- define the library API
- define publish, pin, resolve, and health-check helpers
- define minimal metadata handling
- define error and retry behavior
- keep browser/server gateway helpers consistent with actual Kubo gateway paths

### Phase 3: Consumer Integrations

- map `crypto-directory` site publishing into the shared library
- map `skillmesh` artifact publishing and resolution into the shared library
- map `bitlogic` document and export storage into the shared library

### Phase 4: Repository and Build Readiness

- expose clean package metadata and export declarations
- add basic automated tests around the public helpers
- keep generated local node state and recovery artifacts out of git
- initialize and publish the project as its own GitHub repository

## Open Decisions

- Should the shared library later ship dual ESM and CJS entrypoints, or stay ESM-only?
- What backup pin target should be used after the first local recovery-artifact model?
- Which Bitlogic artifact types should be treated as the first long-lived retention policy use case?

## Deliverables

- a simplified IPFS storage design
- an updated plan aligned to the shared-library goal
- a task board focused on node operations, packaging, and integrations
- a project README that clearly explains the shared-storage role
- a repository-ready package with build and test entrypoints

## Success Criteria

- The IPFS project reads like shared storage infrastructure, not a separate product.
- `crypto-directory`, `skillmesh`, and `bitlogic` can all plug into it through one shared library.
- The public gateway helpers resolve to valid `/ipfs/<cid>` URLs.
- The project can be pushed as a standalone GitHub repo without local node state or recovery dumps in version control.
