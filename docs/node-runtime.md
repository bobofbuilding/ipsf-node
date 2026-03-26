# Node Runtime

## Default Local Assumptions

- IPFS implementation: Kubo
- API endpoint: `http://127.0.0.1:5001`
- Gateway endpoint: `http://127.0.0.1:8080`
- CLI path: repo-local `.tools/kubo/ipfs`, workspace-local `/workspace/tools/kubo/ipfs`, or `ipfs` on `PATH`
- Persistent repo path: repo-local `.local-ipfs` unless `IPFS_PATH` overrides it

## Expected Runtime Shape

- one shared node for workspace consumers
- persistent storage enabled
- API enabled for local trusted callers
- gateway enabled for CID resolution and health checks

## Startup Expectations

The shared library assumes:

- the node is already running before publish or pin operations begin
- the API endpoint accepts `api/v0` RPC calls
- the gateway endpoint can serve `ipfs/<cid>` content

## First Operational Check

Run:

```bash
cd /workspace/projects/ipfs-evm-system
npm run node:preflight
npm run node:wait
npm run node:check
```

Expected result when the node is healthy:

- `ipfs-node:available`
- node version
- node id

## Start Command

Fresh machine bootstrap:

```bash
curl -fsSL https://raw.githubusercontent.com/bobofbuilding/ipsf-node/main/install-ipfs-node.sh -o install-ipfs-node.sh
bash install-ipfs-node.sh
```

Repo-local setup when Kubo is already installed:

```bash
cd /workspace/projects/ipfs-evm-system
npm run node:setup
./scripts/start-node.sh
```


## Auto-Start Options

After running the installer, operators can either:

- run `~/.local/share/bittrees-ipfs/start-ipfs-node.sh` manually
- install `~/.local/share/bittrees-ipfs/ipfs-node.service` as a `systemd` user unit on Linux
- install `~/.local/share/bittrees-ipfs/com.bittrees.ipfs-node.plist` as a `launchd` agent on macOS
