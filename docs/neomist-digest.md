# NeoMist Digest

Source: https://github.com/stigmergic-org/neomist
Reviewed: 2026-06-07
Reviewed commit: `4eeadb9969b6caffe7f0b0e32443b3b022b0b1d6`

## Summary

NeoMist is a local-first desktop stack for browsing `.eth` and `.wei` sites without centralized gateways. It combines a tray app, embedded dashboard, loopback-only HTTPS server, local DNS integration, Helios light-client sync, ENS and `.wei` contenthash resolution, and Kubo-backed IPFS serving.

This is useful reference material for `ipfs-evm-system`, but it should not redefine this project. `ipfs-evm-system` remains shared storage infrastructure and a small JavaScript library for workspace projects.

## Reusable Patterns

- Prefer local-first operation: detect and use an existing local Kubo API before managing a repo-local node.
- Keep writable APIs loopback-only by default, and put authentication/proxying at the edge when exposing access beyond the host.
- Treat contenthash resolution as a separate layer from CID publishing and pinning.
- Make gateway URL construction explicit for path-style `/ipfs/<cid>` and subdomain-style `<cid>.ipfs.localhost` forms.
- Record enough runtime version data for operators to know which Kubo and resolver stack are active.
- Cache resolved content targets and support graceful fallback when a resolver backend is temporarily unavailable.
- Use deterministic install and release verification steps for operator-facing bootstrap scripts.
- Keep runtime state outside git and make recovery/export artifacts explicit.

## Useful But Deferred

- Local DNS and trusted TLS integration for `.eth`, `.wei`, and `*.ipfs.localhost`.
- Helios-backed trust-minimized ENS/contenthash reads.
- Desktop tray and embedded dashboard packaging.
- Managed Kubo binary downloads with hardcoded checksums.
- Local website snapshot caching through Kubo MFS.

These are strong ideas, but they are not first-order requirements for the shared storage library.

## Non-Goals For This Project

- Do not turn `ipfs-evm-system` into a browser, desktop app, or tray daemon.
- Do not import NeoMist GPL-3.0-only source code into this repository without an explicit licensing review and project decision.
- Do not make IPFS-EVM own ENS update flows, wallet UX, or consumer product workflows.
- Do not add a large EVM control plane just because NeoMist includes light-client and name-resolution pieces.

## Recommended Intake Tasks

1. Add a small design spike for contenthash resolution helpers that return IPFS/IPNS targets without changing the existing publish API.
2. Add gateway helper tests for both path-style and subdomain-style local gateway URLs.
3. Extend node health output to include Kubo mode, detected gateway port, and whether the node is managed or external.
4. Compare current host supervisor behavior with NeoMist's managed-Kubo pattern and only adopt missing checks that improve reliability.
5. Add a release/install checklist item that verifies installer checksum, runtime state paths, and no local node artifacts in git.

## Boundary Decision

The immediate integration should be documentation and tasks only. Implementation should wait until a consumer needs contenthash resolution or subdomain gateway support. That keeps the project lean while preserving the best lessons from NeoMist.
