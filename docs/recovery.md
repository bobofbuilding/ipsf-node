# Recovery

## Node Unavailable

Symptoms:

- `npm run node:check` returns `ipfs-node:unavailable`
- publish calls fail on `fetch`
- pin or resolve operations fail against the local API

Initial steps:

1. Confirm the configured API and gateway URLs.
2. Confirm the Kubo process is running.
3. Confirm the API port is reachable from the current shell environment.

## Re-Pin Path

If content is still known by CID but pin state is uncertain:

1. restore node availability
2. call `pinCid`
3. call `ensurePinned`
4. verify through `checkCidHealth`

## Backup Recovery Artifacts

First-version backup uses exported recovery artifacts from the primary Kubo repo instead of a second hosted pin provider.

Run:

```bash
cd /workspace/projects/ipfs-evm-system
npm run recovery:export
```

This writes:

- `pin-manifest.json` with recursive pinned CIDs
- `repo-stat.json` with the current repo stats
- `node-id.json` with the node identity snapshot

## Recovery From Exported Artifacts

If the primary node loses content and no secondary hosted pin target exists yet:

1. restore the Kubo repo or reinitialize the node
2. use `pin-manifest.json` to identify the required long-lived CIDs
3. re-pin each CID on the restored primary node
4. verify health from the primary gateway with `npm run node:check` plus CID resolution checks

## Current Gap

The workspace still needs an operator decision on whether the preferred exported recovery artifact should stay as the pin manifest alone or add CAR exports for the most important content sets.
