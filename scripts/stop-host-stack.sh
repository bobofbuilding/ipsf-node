#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PID_DIR="$ROOT_DIR/.runtime-host/pids"

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

stop_service() {
  local name="$1"
  local pidf="$PID_DIR/$name.pid"
  local pid=""

  if [ -f "$pidf" ]; then
    pid="$(cat "$pidf")"
  fi

  if ! { [ -n "$pid" ] && kill -0 "$pid" >/dev/null 2>&1 && [ -r "/proc/$pid/cmdline" ] && tr '\0' ' ' <"/proc/$pid/cmdline" | grep -Fq "$(expected_pattern "$name")"; }; then
    pid="$(find_running_pid "$name" || true)"
  fi

  if [ -n "$pid" ]; then
    kill "$pid" >/dev/null 2>&1 || true
    sleep 1
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill -9 "$pid" >/dev/null 2>&1 || true
      echo "force-stopped $name"
    else
      echo "stopped $name"
    fi
  else
    echo "$name not running"
  fi

  rm -f "$pidf"
}

stop_service "cloudflared"
stop_service "ipfs-api-proxy"
stop_service "ipfs-node"
