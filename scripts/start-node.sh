#!/usr/bin/env bash
set -euo pipefail

IPFS_CLI_PATH="${IPFS_CLI_PATH:-/workspace/tools/kubo/ipfs}"
IPFS_REPO_PATH="${IPFS_PATH:-/workspace/projects/ipfs-evm-system/.local-ipfs}"

if [ ! -x "$IPFS_CLI_PATH" ]; then
  echo "ERROR: ipfs CLI not found at $IPFS_CLI_PATH"
  exit 1
fi

export IPFS_PATH="$IPFS_REPO_PATH"

if [ ! -d "$IPFS_REPO_PATH" ]; then
  echo "Initializing IPFS repo at $IPFS_REPO_PATH"
  "$IPFS_CLI_PATH" init
fi

echo "Starting shared IPFS node from $IPFS_REPO_PATH"
exec "$IPFS_CLI_PATH" daemon
