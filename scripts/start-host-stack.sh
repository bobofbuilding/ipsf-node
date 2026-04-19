#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.runtime-host"
LOG_DIR="$RUNTIME_DIR/logs"
PID_DIR="$RUNTIME_DIR/pids"

mkdir -p "$LOG_DIR" "$PID_DIR"

if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

pid_file() {
  printf '%s/%s.pid\n' "$PID_DIR" "$1"
}

log_file() {
  printf '%s/%s.log\n' "$LOG_DIR" "$1"
}

expected_pattern() {
  case "$1" in
    ipfs-node) printf '%s\n' '/workspace/tools/kubo/ipfs daemon' ;;
    ipfs-api-proxy) printf '%s\n' 'node scripts/start-ipfs-api-proxy.mjs' ;;
    cloudflared) printf '%s\n' '/workspace/tools/cloudflared tunnel run' ;;
    *) return 1 ;;
  esac
}

pid_matches_name() {
  local name="$1"
  local pid="$2"
  local pattern cmdline
  pattern="$(expected_pattern "$name")" || return 1
  [ -r "/proc/$pid/cmdline" ] || return 1
  cmdline="$(tr '\0' ' ' <"/proc/$pid/cmdline" 2>/dev/null || true)"
  [ -n "$cmdline" ] || return 1
  [[ "$cmdline" == *"$pattern"* ]]
}

find_running_pid() {
  local name="$1"
  local pattern pid
  pattern="$(expected_pattern "$name")" || return 1
  pid="$(pgrep -f "$pattern" | tail -n 1 || true)"
  [ -n "$pid" ] || return 1
  printf '%s\n' "$pid"
}

is_running() {
  local name="$1"
  local file="$2"
  local pid=""
  if [ -f "$file" ]; then
    pid="$(cat "$file")"
  fi
  if [ -n "$pid" ] && kill -0 "$pid" >/dev/null 2>&1 && pid_matches_name "$name" "$pid"; then
    return 0
  fi
  pid="$(find_running_pid "$name" || true)"
  [ -n "$pid" ] || return 1
  echo "$pid" >"$file"
  return 0
}

start_service() {
  local name="$1"
  local command="$2"
  local pidf logf
  pidf="$(pid_file "$name")"
  logf="$(log_file "$name")"

  if is_running "$name" "$pidf"; then
    echo "$name already running (pid $(cat "$pidf"))"
    return 0
  fi

  rm -f "$pidf"
  bash -lc "cd '$ROOT_DIR' && nohup $command >>'$logf' 2>&1 < /dev/null & echo \$! > '$pidf'"
  sleep 2
  local pid=""
  pid="$(find_running_pid "$name" || true)"
  [ -n "$pid" ] && echo "$pid" >"$pidf"

  if [ -n "$pid" ] && is_running "$name" "$pidf"; then
    echo "started $name (pid $pid)"
    return 0
  fi

  echo "failed to start $name; inspect $logf" >&2
  return 1
}

start_service "ipfs-node" "./scripts/start-node.sh"
start_service "ipfs-api-proxy" "npm run api:proxy"
start_service "cloudflared" "npm run tunnel:start"

echo
bash "$SCRIPT_DIR/status-host-stack.sh"
