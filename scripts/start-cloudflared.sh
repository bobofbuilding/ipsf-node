#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DEFAULT_BIN="/workspace/tools/cloudflared"
DEFAULT_CONFIG="$ROOT_DIR/.cloudflared/config.yml"

CLOUDFLARED_BIN="${IPFS_CLOUDFLARED_BIN:-$DEFAULT_BIN}"
CLOUDFLARED_CONFIG="${IPFS_CLOUDFLARED_CONFIG:-$DEFAULT_CONFIG}"
TUNNEL_TOKEN="${IPFS_CLOUDFLARED_TUNNEL_TOKEN:-}"
TUNNEL_ID="${IPFS_CLOUDFLARED_TUNNEL_ID:-}"

if [ ! -x "$CLOUDFLARED_BIN" ]; then
  echo "ERROR: cloudflared binary not found or not executable: $CLOUDFLARED_BIN" >&2
  exit 1
fi

if [ -n "$TUNNEL_TOKEN" ]; then
  echo "Starting cloudflared with tunnel token"
  exec "$CLOUDFLARED_BIN" tunnel run --token "$TUNNEL_TOKEN"
fi

if [ -f "$CLOUDFLARED_CONFIG" ]; then
  echo "Starting cloudflared with config: $CLOUDFLARED_CONFIG"
  exec "$CLOUDFLARED_BIN" tunnel --config "$CLOUDFLARED_CONFIG" run
fi

if [ -n "$TUNNEL_ID" ]; then
  echo "Starting cloudflared with named tunnel: $TUNNEL_ID"
  exec "$CLOUDFLARED_BIN" tunnel run "$TUNNEL_ID"
fi

cat >&2 <<'EOF'
ERROR: missing cloudflared tunnel configuration.

Provide one of:
  1. IPFS_CLOUDFLARED_TUNNEL_TOKEN
  2. IPFS_CLOUDFLARED_CONFIG pointing to a config.yml with tunnel + credentials-file
  3. IPFS_CLOUDFLARED_TUNNEL_ID with preexisting local credentials

Recommended local config target:
  service: http://127.0.0.1:5002
EOF
exit 1
