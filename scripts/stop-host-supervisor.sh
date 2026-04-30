#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.runtime-host"
PID_FILE="$RUNTIME_DIR/supervisor.pid"
LAUNCHER_PID_FILE="$RUNTIME_DIR/supervisor-launcher.pid"

find_supervisor_pid() {
  pgrep -f "node scripts/[r]un-host-supervisor.mjs" | tail -n 1 || true
}

pid=""
if [ -f "$PID_FILE" ]; then
  pid="$(cat "$PID_FILE")"
fi

if ! { [ -n "$pid" ] && kill -0 "$pid" >/dev/null 2>&1 && [ -r "/proc/$pid/cmdline" ] && tr '\0' ' ' <"/proc/$pid/cmdline" | grep -Eq 'node scripts/[r]un-host-supervisor.mjs'; }; then
  pid="$(find_supervisor_pid)"
fi

if [ -n "$pid" ]; then
  kill "$pid" >/dev/null 2>&1 || true
  sleep 3
  if kill -0 "$pid" >/dev/null 2>&1; then
    kill -9 "$pid" >/dev/null 2>&1 || true
    echo "force-stopped ipfs-host-supervisor"
  else
    echo "stopped ipfs-host-supervisor"
  fi
else
  echo "ipfs-host-supervisor not running"
fi

bash "$SCRIPT_DIR/stop-host-stack.sh" >/dev/null 2>&1 || true
rm -f "$PID_FILE" "$LAUNCHER_PID_FILE"
