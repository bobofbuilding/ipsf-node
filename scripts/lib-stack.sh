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
  printf '%s/%s.pid\n' "$STACK_PID_DIR" "$1"
}

log_file_for() {
  printf '%s/%s.log\n' "$STACK_LOG_DIR" "$1"
}

is_running() {
  local pid_file="$1"
  if [ ! -f "$pid_file" ]; then
    return 1
  fi

  local pid
  pid="$(cat "$pid_file")"
  if [ -z "$pid" ]; then
    return 1
  fi

  kill -0 "$pid" >/dev/null 2>&1
}

start_bg() {
  local name="$1"
  local command="$2"
  local pid_file log_file
  pid_file="$(pid_file_for "$name")"
  log_file="$(log_file_for "$name")"

  if is_running "$pid_file"; then
    echo "$name already running (pid $(cat "$pid_file"))"
    return 0
  fi

  rm -f "$pid_file"
  nohup bash -lc "$command" >>"$log_file" 2>&1 &
  local pid=$!
  echo "$pid" >"$pid_file"
  sleep 1

  if kill -0 "$pid" >/dev/null 2>&1; then
    echo "started $name (pid $pid)"
    return 0
  fi

  echo "failed to start $name; see $log_file" >&2
  return 1
}

stop_bg() {
  local name="$1"
  local pid_file
  pid_file="$(pid_file_for "$name")"

  if ! is_running "$pid_file"; then
    rm -f "$pid_file"
    echo "$name not running"
    return 0
  fi

  local pid
  pid="$(cat "$pid_file")"
  kill "$pid" >/dev/null 2>&1 || true

  for _ in 1 2 3 4 5; do
    if ! kill -0 "$pid" >/dev/null 2>&1; then
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

  if is_running "$pid_file"; then
    echo "$name: running (pid $(cat "$pid_file")) log=$log_file"
  else
    echo "$name: stopped log=$log_file"
  fi
}
