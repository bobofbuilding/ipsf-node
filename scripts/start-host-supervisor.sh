#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.runtime-host"
LOG_DIR="$RUNTIME_DIR/logs"
SUPERVISOR_LOG="$LOG_DIR/ipfs-host-supervisor.log"
SUPERVISOR_PID_FILE="$RUNTIME_DIR/supervisor.pid"

mkdir -p "$LOG_DIR"

find_supervisor_pid() {
  pgrep -f "node scripts/[r]un-host-supervisor.mjs" | tail -n 1 || true
}

SUPERVISOR_PID="$(find_supervisor_pid)"
if [ -n "$SUPERVISOR_PID" ]; then
  echo "$SUPERVISOR_PID" >"$SUPERVISOR_PID_FILE"
  echo "ipfs-host-supervisor already running (pid $SUPERVISOR_PID)"
  exit 0
fi

LAUNCHER_PID="$(bash "$SCRIPT_DIR/launch-detached.sh" "$ROOT_DIR" "$SUPERVISOR_LOG" npm run host:supervisor)"
echo "$LAUNCHER_PID" >"$RUNTIME_DIR/supervisor-launcher.pid"
sleep 2

SUPERVISOR_PID="$(find_supervisor_pid)"
if [ -n "$SUPERVISOR_PID" ]; then
  echo "$SUPERVISOR_PID" >"$SUPERVISOR_PID_FILE"
  echo "started ipfs-host-supervisor pid $SUPERVISOR_PID"
  exit 0
fi

echo "started ipfs-host-supervisor launcher pid $LAUNCHER_PID"
