#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.runtime-host"
LOG_DIR="$RUNTIME_DIR/logs"
PID_DIR="$RUNTIME_DIR/pids"

expected_pattern() {
  case "$1" in
    ipfs-node) printf '%s\n' '/workspace/tools/kubo/ipfs daemon' ;;
    ipfs-api-proxy) printf '%s\n' 'node scripts/start-ipfs-api-proxy.mjs' ;;
    cloudflared) printf '%s\n' '/workspace/tools/cloudflared tunnel run' ;;
    *) return 1 ;;
  esac
}

find_running_pid() {
  local name="$1"
  local pattern pid
  pattern="$(expected_pattern "$name")" || return 1
  pid="$(pgrep -f "$pattern" | tail -n 1 || true)"
  [ -n "$pid" ] || return 1
  printf '%s\n' "$pid"
}

status_service() {
  local name="$1"
  local pidf="$PID_DIR/$name.pid"
  local logf="$LOG_DIR/$name.log"
  local pid=""

  if [ -f "$pidf" ]; then
    pid="$(cat "$pidf")"
  fi

  if [ -n "$pid" ] && kill -0 "$pid" >/dev/null 2>&1 && [ -r "/proc/$pid/cmdline" ] && tr '\0' ' ' <"/proc/$pid/cmdline" | grep -Fq "$(expected_pattern "$name")"; then
    echo "$name: running (pid $pid) log=$logf"
    return 0
  fi

  pid="$(find_running_pid "$name" || true)"
  if [ -n "$pid" ]; then
    echo "$pid" >"$pidf"
    echo "$name: running (pid $pid) log=$logf"
    return 0
  fi

  rm -f "$pidf"
  echo "$name: stopped log=$logf"
}

status_service "ipfs-node"
status_service "ipfs-api-proxy"
status_service "cloudflared"
