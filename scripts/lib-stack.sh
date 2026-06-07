#!/usr/bin/env bash
set -euo pipefail

STACK_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STACK_ROOT_DIR="$(cd "$STACK_SCRIPT_DIR/.." && pwd)"
STACK_RUNTIME_DIR="$STACK_ROOT_DIR/.runtime"
STACK_LOG_DIR="$STACK_RUNTIME_DIR/logs"
STACK_PID_DIR="$STACK_RUNTIME_DIR/pids"

mkdir -p "$STACK_LOG_DIR" "$STACK_PID_DIR"

load_env() {
  local env_file="$STACK_ROOT_DIR/.env"
  if [ -f "$env_file" ]; then
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
  fi
}

pid_file_for() {
  printf '%s/%s.pid
' "$STACK_PID_DIR" "$1"
}

log_file_for() {
  printf '%s/%s.log
' "$STACK_LOG_DIR" "$1"
}

expected_pattern() {
  case "$1" in
    ipfs-node) printf '%s
' '(/workspace/tools/kubo/ipfs|/\.tools/kubo/ipfs|(^| )ipfs) daemon' ;;
    ipfs-api-proxy) printf '%s
' 'start-ipfs-api-proxy[.]mjs' ;;
    cloudflared) printf '%s
' 'cloudflared.* tunnel' ;;
    *) return 1 ;;
  esac
}

process_is_alive() {
  local pid="$1"
  if [ -z "$pid" ]; then
    return 1
  fi

  if ! kill -0 "$pid" >/dev/null 2>&1; then
    return 1
  fi

  local state
  state="$(ps -p "$pid" -o stat= 2>/dev/null | tr -d '[:space:]')"
  if [ -z "$state" ] || [[ "$state" == Z* ]]; then
    return 1
  fi

  return 0
}

pid_matches_name() {
  local name="$1"
  local pid="$2"
  local pattern cmdline
  pattern="$(expected_pattern "$name")" || return 1
  process_is_alive "$pid" || return 1
  [ -r "/proc/$pid/cmdline" ] || return 1
  cmdline="$(tr '\0' ' ' <"/proc/$pid/cmdline" 2>/dev/null || true)"
  [ -n "$cmdline" ] || return 1
  printf '%s
' "$cmdline" | grep -Eq "$pattern"
}

find_running_pid() {
  local name="$1"
  local pattern pid
  pattern="$(expected_pattern "$name")" || return 1
  while read -r pid; do
    if [ -n "$pid" ] && pid_matches_name "$name" "$pid"; then
      printf '%s
' "$pid"
      return 0
    fi
  done < <(pgrep -f "$pattern" || true)
  return 1
}

is_running() {
  local name="$1"
  local pid_file="$2"
  local pid=""

  if [ -f "$pid_file" ]; then
    pid="$(cat "$pid_file")"
  fi

  if [ -n "$pid" ] && pid_matches_name "$name" "$pid"; then
    return 0
  fi

  pid="$(find_running_pid "$name" || true)"
  [ -n "$pid" ] || return 1
  echo "$pid" >"$pid_file"
  return 0
}

start_bg() {
  local name="$1"
  shift
  local pid_file log_file launcher_pid service_pid
  pid_file="$(pid_file_for "$name")"
  log_file="$(log_file_for "$name")"

  if is_running "$name" "$pid_file"; then
    echo "$name already running (pid $(cat "$pid_file"))"
    return 0
  fi

  rm -f "$pid_file"
  launcher_pid="$(bash "$STACK_SCRIPT_DIR/launch-detached.sh" "$STACK_ROOT_DIR" "$log_file" "$@")"
  echo "$launcher_pid" >"$pid_file"
  sleep 2

  service_pid="$(find_running_pid "$name" || true)"
  if [ -n "$service_pid" ]; then
    echo "$service_pid" >"$pid_file"
  fi

  if is_running "$name" "$pid_file"; then
    echo "started $name (pid $(cat "$pid_file"))"
    return 0
  fi

  echo "failed to start $name; see $log_file" >&2
  return 1
}

stop_bg() {
  local name="$1"
  local pid_file pid
  pid_file="$(pid_file_for "$name")"
  pid=""

  if [ -f "$pid_file" ]; then
    pid="$(cat "$pid_file")"
  fi

  if ! { [ -n "$pid" ] && pid_matches_name "$name" "$pid"; }; then
    pid="$(find_running_pid "$name" || true)"
  fi

  if [ -z "$pid" ]; then
    rm -f "$pid_file"
    echo "$name not running"
    return 0
  fi

  kill "$pid" >/dev/null 2>&1 || true
  for _ in 1 2 3 4 5; do
    if ! process_is_alive "$pid"; then
      rm -f "$pid_file"
      echo "stopped $name"
      return 0
    fi
    sleep 1
  done

  kill -9 "$pid" >/dev/null 2>&1 || true
  rm -f "$pid_file"
  echo "force-stopped $name"
}

status_bg() {
  local name="$1"
  local pid_file log_file
  pid_file="$(pid_file_for "$name")"
  log_file="$(log_file_for "$name")"

  if is_running "$name" "$pid_file"; then
    echo "$name: running (pid $(cat "$pid_file")) log=$log_file"
  else
    rm -f "$pid_file"
    echo "$name: stopped log=$log_file"
  fi
}
