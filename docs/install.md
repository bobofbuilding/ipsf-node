# Install

## Downloadable Bootstrap

macOS and Linux operators can install Kubo and initialize a local node directly from GitHub with one downloadable script:

```bash
curl -fsSL https://raw.githubusercontent.com/bobofbuilding/ipsf-node/main/install-ipfs-node.sh -o install-ipfs-node.sh
bash install-ipfs-node.sh
```

Default install targets:

- binary: `$HOME/.local/bin/ipfs`
- helper env file: `$HOME/.local/share/bittrees-ipfs/ipfs-node.env`
- helper start script: `$HOME/.local/share/bittrees-ipfs/start-ipfs-node.sh`
- repo path: `$HOME/.bittrees/ipfs-node`

The installer currently supports:

- Linux amd64
- Linux arm64
- macOS amd64
- macOS arm64

## Repo-Local Setup

If Kubo is already available on `PATH` or through `IPFS_CLI_PATH`, configure the repo-managed node with:

```bash
cd /workspace/projects/ipfs-evm-system
npm run node:setup
```

Supported setup flags:

- `--cli-path <path-or-command>`
- `--repo-path <dir>`
- `--api-port <port>`
- `--gateway-port <port>`
- `--profile <name>`
- `--cors-origin <origin>`
- `--no-default-cors`

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

After install or setup:

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
