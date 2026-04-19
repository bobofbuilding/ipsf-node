#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TEMPLATE_DIR="$ROOT_DIR/systemd"
RENDER_DIR="$ROOT_DIR/.systemd-rendered"
USER_UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"

if ! command -v systemctl >/dev/null 2>&1; then
  echo "ERROR: systemctl is not available on this host." >&2
  exit 1
fi

mkdir -p "$RENDER_DIR" "$USER_UNIT_DIR"

render_unit() {
  local source_file="$1"
  local target_file="$2"
  sed "s|__ROOT_DIR__|$ROOT_DIR|g" "$source_file" >"$target_file"
}

render_unit "$TEMPLATE_DIR/ipfs-node.service" "$RENDER_DIR/ipfs-node.service"
render_unit "$TEMPLATE_DIR/ipfs-api-proxy.service" "$RENDER_DIR/ipfs-api-proxy.service"
render_unit "$TEMPLATE_DIR/ipfs-cloudflared.service" "$RENDER_DIR/ipfs-cloudflared.service"

install -m 0644 "$RENDER_DIR/ipfs-node.service" "$USER_UNIT_DIR/ipfs-node.service"
install -m 0644 "$RENDER_DIR/ipfs-api-proxy.service" "$USER_UNIT_DIR/ipfs-api-proxy.service"
install -m 0644 "$RENDER_DIR/ipfs-cloudflared.service" "$USER_UNIT_DIR/ipfs-cloudflared.service"

systemctl --user daemon-reload
systemctl --user enable ipfs-node.service ipfs-api-proxy.service ipfs-cloudflared.service

cat <<EOF
Installed user units:
  $USER_UNIT_DIR/ipfs-node.service
  $USER_UNIT_DIR/ipfs-api-proxy.service
  $USER_UNIT_DIR/ipfs-cloudflared.service

Next commands:
  systemctl --user start ipfs-node.service
  systemctl --user start ipfs-api-proxy.service
  systemctl --user start ipfs-cloudflared.service
  systemctl --user status ipfs-node.service ipfs-api-proxy.service ipfs-cloudflared.service
EOF
