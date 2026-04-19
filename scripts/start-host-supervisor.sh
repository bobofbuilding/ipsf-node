#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.runtime-host"
LOG_DIR="$RUNTIME_DIR/logs"
SUPERVISOR_LOG="$LOG_DIR/ipfs-host-supervisor.log"

mkdir -p "$LOG_DIR"

if pgrep -f "node scripts/run-host-supervisor.mjs" >/dev/null 2>&1; then
  echo "ipfs-host-supervisor already running"
  exit 0
fi

cd "$ROOT_DIR"
nohup npm run host:supervisor >>"$SUPERVISOR_LOG" 2>&1 < /dev/null &
echo $! >"$RUNTIME_DIR/supervisor-launcher.pid"
echo "started ipfs-host-supervisor launcher pid $(cat "$RUNTIME_DIR/supervisor-launcher.pid")"
