# Install

## Required Runtime

The shared IPFS project expects a local Kubo installation.

Required binary:

- `ipfs`

## Current Environment Status

At the time of this update, the workspace did not have a global `ipfs` binary on `PATH`, so Kubo was installed locally at:

- `/workspace/tools/kubo/ipfs`

The shared IPFS project is now configured to use that path by default.

## Preflight

Run:

```bash
cd /workspace/projects/ipfs-evm-system
npm run node:preflight
```

This checks:

- configured API URL
- configured gateway URL
- whether the configured IPFS CLI path is available

## Local Start

After installing Kubo:

```bash
cd /workspace/projects/ipfs-evm-system
./scripts/start-node.sh
```

Then in another shell:

```bash
cd /workspace/projects/ipfs-evm-system
npm run node:wait
npm run node:check
```
