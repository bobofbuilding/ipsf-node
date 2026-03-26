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
- Linux service unit: `$HOME/.local/share/bittrees-ipfs/ipfs-node.service`
- macOS launchd plist: `$HOME/.local/share/bittrees-ipfs/com.bittrees.ipfs-node.plist`
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

## Auto-Start

The installer writes service definitions for both supported OS families.

Linux `systemd` user service:

```bash
mkdir -p ~/.config/systemd/user
cp ~/.local/share/bittrees-ipfs/ipfs-node.service ~/.config/systemd/user/ipfs-node.service
systemctl --user daemon-reload
systemctl --user enable --now ipfs-node.service
```

macOS `launchd` agent:

```bash
mkdir -p ~/Library/LaunchAgents
cp ~/.local/share/bittrees-ipfs/com.bittrees.ipfs-node.plist ~/Library/LaunchAgents/com.bittrees.ipfs-node.plist
launchctl unload ~/Library/LaunchAgents/com.bittrees.ipfs-node.plist 2>/dev/null || true
launchctl load ~/Library/LaunchAgents/com.bittrees.ipfs-node.plist
```

## Stable Releases

For operators who want a stable installer instead of tracking `main`, use the latest GitHub release assets:

```bash
curl -fsSL https://github.com/bobofbuilding/ipsf-node/releases/latest/download/install-ipfs-node.sh -o install-ipfs-node.sh
curl -fsSL https://github.com/bobofbuilding/ipsf-node/releases/latest/download/install-ipfs-node.sh.sha256 -o install-ipfs-node.sh.sha256
curl -fsSL https://github.com/bobofbuilding/ipsf-node/releases/latest/download/release-manifest.json -o release-manifest.json
shasum -a 256 -c install-ipfs-node.sh.sha256
bash install-ipfs-node.sh
```

The repository now prepares and validates these files with:

```bash
cd /workspace/projects/ipfs-evm-system
npm run release:prepare
npm run release:validate
```

Tagged pushes matching `v*` publish the installer and checksum through `.github/workflows/release.yml`.

The release manifest includes the package version, release tag, commit SHA, installer SHA-256, and pinned Kubo version.
