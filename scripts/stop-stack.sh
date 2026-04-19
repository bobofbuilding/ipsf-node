#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib-stack.sh"

stop_bg "cloudflared"
stop_bg "ipfs-api-proxy"
stop_bg "ipfs-node"
