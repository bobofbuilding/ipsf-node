# Design: Shared IPFS Storage Library
Source: `plans/ipfs-evm-system.md`
Updated: 2026-03-26

## 1. Purpose

Define `ipfs-evm-system` as the shared IPFS storage project for the workspace. Its job is to run and manage IPFS storage and expose a reusable shared library that other projects can use for immutable files, directories, and content artifacts.

## 2. Design Summary

This project should stay small.

It should provide:

- a managed IPFS node
- a shared JavaScript library for publish, pin, and resolve operations
- TypeScript declarations for consumer projects
- operational monitoring and recovery basics
- simple integration patterns for other projects
- a minimal build and test path so the repo can stand alone on GitHub

It should not become a separate application with its own large product surface.

## 3. Consumers

### Crypto Directory

Uses the shared IPFS library to:

- publish built static site directories
- pin release CIDs
- verify release availability

Keeps local ownership of:

- audit and build flow
- release notes
- ENS update flow

### SkillMesh

Uses the shared IPFS library to:

- publish skill definitions and artifacts
- resolve CIDs for SDK and runtime use
- reuse common pin and availability checks

Keeps local ownership of:

- skill schema
- runtime logic
- onchain skill ownership logic

### Bitlogic

Uses the shared IPFS library to:

- publish reports and exports
- publish audit evidence bundles
- store supporting files when the product requires it

Keeps local ownership of:

- accounting workflows
- product access rules
- any later privacy or encryption rules

## 4. Core System Components

### 4.1 IPFS Node

The system starts with one managed Kubo node.

Responsibilities:

- accept content adds
- pin stored content
- serve content by CID
- expose node health and pin status

### 4.2 Shared Library

This is the main integration surface.

Responsibilities:

- publish files or directories
- resolve content by CID
- inspect pin status
- expose shared error handling and retries
- support basic metadata attachment when helpful
- expose gateway helpers that always build `/ipfs/<cid>` paths correctly

### 4.3 Operations Layer

Responsibilities:

- node startup and configuration
- storage path and persistence configuration
- backup pinning
- health checks
- recovery steps

### 4.4 Package Layer

Responsibilities:

- define stable package exports
- expose `.d.ts` declarations for consumers
- keep git hygiene around local node state and recovery dumps
- provide `npm run build` and `npm run test` as the baseline verification surface

## 5. Library Contract

Every project should be able to rely on the same core operations:

- `publishFile`
- `publishDirectory`
- `pinCid`
- `unpinCid`
- `resolveCid`
- `checkCidHealth`
- `checkNodeHealth`
- `ensurePinned`
- `buildGatewayUrl`
- `normalizeIpfsCid`
- `resolveJsonFromGateway`

Optional:

- `recordMetadata`
- project-specific wrappers built on top of the shared primitives

The first version should stop there unless a real integration need forces expansion.

## 6. Storage Model

The shared IPFS project should think in terms of stored artifacts, not product workflows.

A stored artifact may include:

- cid
- content type
- file or directory flag
- source project
- created time
- optional label or notes

That metadata remains minimal in the first version. It exists to help operations and integrations, not to create a large data model.

## 7. Consumer Integration Boundaries

### 7.1 Crypto Directory Boundary

`crypto-directory` builds the release locally.

Then it hands the built `site/` directory to the shared IPFS library for:

- publishing
- pinning
- CID verification

The IPFS project does not own the release process itself.

### 7.2 SkillMesh Boundary

`skillmesh` prepares the artifact locally.

Then it uses the shared IPFS library for:

- publishing manifests and artifacts
- resolving CIDs
- checking availability

The IPFS project does not own runtime execution or protocol logic.

### 7.3 Bitlogic Boundary

`bitlogic` prepares the export, report, or evidence bundle locally.

Then it uses the shared IPFS library for:

- publishing files or bundles
- pinning important artifacts
- resolving stored CIDs
- checking content availability

The IPFS project does not own Bitlogic document policy or bookkeeping workflows.

## 8. Node Operations

### 8.1 MVP Runtime

Start with:

- one Kubo node
- persistent local storage
- one backup recovery path based on exported pin manifests and repo stats

### 8.2 Health Checks

Track:

- node availability
- add and pin success
- CID retrievability
- disk usage
- recovery export success

### 8.3 Recovery

Document:

- node restart steps
- restore or re-pin process
- backup recovery steps from exported artifacts

## 9. Build and Verification

The repo should verify three things:

- source files parse and package exports are valid
- public gateway helpers build correct gateway URLs
- local runtime artifacts do not leak into git history

Baseline verification surface:

- `npm run check`
- `npm run test`
- `npm run build`

## 10. Deployment Direction

The IPFS project should be deployable as a small infrastructure unit.

Likely needs:

- node config
- env vars
- storage path
- library config for node access
- helper scripts for publish and health checks
- a clean standalone Git repository boundary

## 11. Implementation Recommendation

The first implementation should prioritize simplicity:

- keep the node running
- keep the shared library stable
- keep gateway helpers correct and tested
- wire `crypto-directory`, `skillmesh`, and `bitlogic` into it at the integration level
- keep git state clean by ignoring local node and recovery outputs

Defer:

- broad policy systems
- generic sequencing systems
- contract-heavy design
- large metadata databases
- service-first architecture unless the library proves insufficient

## 12. Summary

`ipfs-evm-system` should be the workspace storage utility for IPFS. It runs the node, exposes a small shared library for publish and resolve operations, includes enough package and test structure for downstream use, and supports `crypto-directory`, `skillmesh`, `bitlogic`, and future projects without taking over their workflows.
