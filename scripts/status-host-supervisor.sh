#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.runtime-host"
STATE_FILE="$RUNTIME_DIR/supervisor-state.json"
PID_FILE="$RUNTIME_DIR/supervisor.pid"

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
  echo "$pid" >"$PID_FILE"
  echo "ipfs-host-supervisor: running (pid $pid) state=$STATE_FILE"
else
  rm -f "$PID_FILE"
  echo "ipfs-host-supervisor: stopped state=$STATE_FILE"
fi

bash "$SCRIPT_DIR/status-host-stack.sh"
