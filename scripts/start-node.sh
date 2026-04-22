#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DEFAULT_REPO_PATH="$ROOT_DIR/.local-ipfs"
REPO_LOCAL_CLI_PATH="$ROOT_DIR/.tools/kubo/ipfs"
WORKSPACE_CLI_PATH="/workspace/tools/kubo/ipfs"

resolve_cli_path() {
  if [ -n "${IPFS_CLI_PATH:-}" ]; then
    if [ -x "$IPFS_CLI_PATH" ]; then
      printf '%s\n' "$IPFS_CLI_PATH"
      return 0
    fi
    if command -v "$IPFS_CLI_PATH" >/dev/null 2>&1; then
      command -v "$IPFS_CLI_PATH"
      return 0
    fi
    echo "ERROR: configured IPFS_CLI_PATH is not executable: $IPFS_CLI_PATH" >&2
    return 1
  fi

  if [ -x "$REPO_LOCAL_CLI_PATH" ]; then
    printf '%s\n' "$REPO_LOCAL_CLI_PATH"
    return 0
  fi

  if [ -x "$WORKSPACE_CLI_PATH" ]; then
    printf '%s\n' "$WORKSPACE_CLI_PATH"
    return 0
  fi

  if command -v ipfs >/dev/null 2>&1; then
    command -v ipfs
    return 0
  fi

  echo "ERROR: ipfs CLI not found. Run ./install-ipfs-node.sh or set IPFS_CLI_PATH." >&2
  return 1
}

IPFS_CLI_PATH="$(resolve_cli_path)"
IPFS_REPO_PATH="${IPFS_PATH:-$DEFAULT_REPO_PATH}"

export IPFS_PATH="$IPFS_REPO_PATH"

normalize_truthy_flag() {
  local value
  value="$(echo "${1:-}" | tr '[:upper:]' '[:lower:]')"
  [[ "$value" == "1" || "$value" == "true" || "$value" == "yes" || "$value" == "on" ]]
}

if [ ! -f "$IPFS_REPO_PATH/config" ]; then
  echo "Initializing IPFS repo at $IPFS_REPO_PATH"
  mkdir -p "$IPFS_REPO_PATH"
  "$IPFS_CLI_PATH" init --profile=server
fi

if normalize_truthy_flag "${IPFS_LOCAL_ONLY:-}"; then
  "$IPFS_CLI_PATH" config --json Addresses.Swarm '[]' >/dev/null
  "$IPFS_CLI_PATH" config --json Discovery.MDNS.Enabled 'false' >/dev/null
fi

echo "Starting shared IPFS node from $IPFS_REPO_PATH"
exec "$IPFS_CLI_PATH" daemon
