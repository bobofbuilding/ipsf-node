#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib-stack.sh"

status_bg "ipfs-node"
status_bg "ipfs-api-proxy"
status_bg "cloudflared"
