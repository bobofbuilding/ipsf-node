#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib-stack.sh"

load_env

start_bg "ipfs-node" "cd '$STACK_ROOT_DIR' && ./scripts/start-node.sh"
start_bg "ipfs-api-proxy" "cd '$STACK_ROOT_DIR' && npm run api:proxy"
start_bg "cloudflared" "cd '$STACK_ROOT_DIR' && npm run tunnel:start"

echo
status_bg "ipfs-node"
status_bg "ipfs-api-proxy"
status_bg "cloudflared"
