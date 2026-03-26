# Node Runtime

## Default Local Assumptions

- IPFS implementation: Kubo
- API endpoint: `http://127.0.0.1:5001`
- Gateway endpoint: `http://127.0.0.1:8080`
- CLI path: `/workspace/tools/kubo/ipfs`
- Persistent repo path: `/workspace/projects/ipfs-evm-system/.local-ipfs`

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

When Kubo is installed:

```bash
cd /workspace/projects/ipfs-evm-system
./scripts/start-node.sh
```
