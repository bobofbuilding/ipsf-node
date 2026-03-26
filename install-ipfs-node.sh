#!/usr/bin/env bash
set -euo pipefail

KUBO_VERSION="${KUBO_VERSION:-0.33.2}"
INSTALL_BIN_DIR="${INSTALL_BIN_DIR:-$HOME/.local/bin}"
INSTALL_ROOT="${INSTALL_ROOT:-$HOME/.local/share/bittrees-ipfs}"
IPFS_REPO_PATH="${IPFS_REPO_PATH:-$HOME/.bittrees/ipfs-node}"
API_PORT="${API_PORT:-5001}"
GATEWAY_PORT="${GATEWAY_PORT:-8080}"
PROFILE="${PROFILE:-server}"

log() {
  printf '%s\n' "$1"
}

fail() {
  printf 'ERROR: %s\n' "$1" >&2
  exit 1
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "Required command not found: $1"
  fi
}

parse_args() {
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --kubo-version)
        KUBO_VERSION="$2"
        shift 2
        ;;
      --kubo-version=*)
        KUBO_VERSION="${1#*=}"
        shift
        ;;
      --install-bin-dir)
        INSTALL_BIN_DIR="$2"
        shift 2
        ;;
      --install-bin-dir=*)
        INSTALL_BIN_DIR="${1#*=}"
        shift
        ;;
      --install-root)
        INSTALL_ROOT="$2"
        shift 2
        ;;
      --install-root=*)
        INSTALL_ROOT="${1#*=}"
        shift
        ;;
      --repo-path)
        IPFS_REPO_PATH="$2"
        shift 2
        ;;
      --repo-path=*)
        IPFS_REPO_PATH="${1#*=}"
        shift
        ;;
      --api-port)
        API_PORT="$2"
        shift 2
        ;;
      --api-port=*)
        API_PORT="${1#*=}"
        shift
        ;;
      --gateway-port)
        GATEWAY_PORT="$2"
        shift 2
        ;;
      --gateway-port=*)
        GATEWAY_PORT="${1#*=}"
        shift
        ;;
      --profile)
        PROFILE="$2"
        shift 2
        ;;
      --profile=*)
        PROFILE="${1#*=}"
        shift
        ;;
      -h|--help)
        cat <<USAGE
Usage: ./install-ipfs-node.sh [options]

Options:
  --kubo-version <version>      Kubo version to install (default: ${KUBO_VERSION})
  --install-bin-dir <dir>       Where to place the ipfs binary (default: ${INSTALL_BIN_DIR})
  --install-root <dir>          Where to write helper files (default: ${INSTALL_ROOT})
  --repo-path <dir>             IPFS repo path to initialize (default: ${IPFS_REPO_PATH})
  --api-port <port>             API port (default: ${API_PORT})
  --gateway-port <port>         Gateway port (default: ${GATEWAY_PORT})
  --profile <name>              ipfs init profile (default: ${PROFILE})
USAGE
        exit 0
        ;;
      *)
        fail "Unknown option: $1"
        ;;
    esac
  done
}

detect_platform() {
  local os arch
  os="$(uname -s)"
  arch="$(uname -m)"

  case "$os" in
    Linux) os="linux" ;;
    Darwin) os="darwin" ;;
    *) fail "Unsupported operating system: $os" ;;
  esac

  case "$arch" in
    x86_64|amd64) arch="amd64" ;;
    arm64|aarch64) arch="arm64" ;;
    *) fail "Unsupported architecture: $arch" ;;
  esac

  PLATFORM_OS="$os"
  PLATFORM_ARCH="$arch"
}

download_file() {
  local url="$1"
  local output="$2"

  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$url" -o "$output"
    return 0
  fi

  if command -v wget >/dev/null 2>&1; then
    wget -qO "$output" "$url"
    return 0
  fi

  fail "curl or wget is required to download Kubo"
}

configure_repo() {
  export IPFS_PATH="$IPFS_REPO_PATH"

  if [ -f "$IPFS_REPO_PATH/config" ]; then
    log "ipfs-repo:existing"
  else
    mkdir -p "$IPFS_REPO_PATH"
    "$INSTALL_BIN_DIR/ipfs" init --profile="$PROFILE"
    log "ipfs-repo:initialized"
  fi

  "$INSTALL_BIN_DIR/ipfs" config Addresses.API "/ip4/127.0.0.1/tcp/$API_PORT"
  "$INSTALL_BIN_DIR/ipfs" config Addresses.Gateway "/ip4/127.0.0.1/tcp/$GATEWAY_PORT"
  "$INSTALL_BIN_DIR/ipfs" config --json API.HTTPHeaders.Access-Control-Allow-Origin '["http://localhost:3000","http://127.0.0.1:3000","http://localhost:4173","http://127.0.0.1:4173","http://localhost:5173","http://127.0.0.1:5173"]'
  "$INSTALL_BIN_DIR/ipfs" config --json API.HTTPHeaders.Access-Control-Allow-Methods '["GET","POST","PUT"]'
  "$INSTALL_BIN_DIR/ipfs" config --json API.HTTPHeaders.Access-Control-Allow-Credentials '["true"]'
}

write_helper_files() {
  mkdir -p "$INSTALL_ROOT"

  cat > "$INSTALL_ROOT/ipfs-node.env" <<ENVFILE
export IPFS_CLI_PATH="$INSTALL_BIN_DIR/ipfs"
export IPFS_PATH="$IPFS_REPO_PATH"
export IPFS_API_BASE_URL="http://127.0.0.1:$API_PORT"
export IPFS_GATEWAY_BASE_URL="http://127.0.0.1:$GATEWAY_PORT"
ENVFILE

  cat > "$INSTALL_ROOT/start-ipfs-node.sh" <<STARTFILE
#!/usr/bin/env bash
set -euo pipefail
export IPFS_PATH="$IPFS_REPO_PATH"
exec "$INSTALL_BIN_DIR/ipfs" daemon
STARTFILE
  chmod +x "$INSTALL_ROOT/start-ipfs-node.sh"
}

main() {
  parse_args "$@"
  detect_platform
  require_command tar
  require_command mktemp
  require_command install
  mkdir -p "$INSTALL_BIN_DIR" "$INSTALL_ROOT"

  local archive_url archive_path temp_dir binary_source
  archive_url="https://dist.ipfs.tech/kubo/v${KUBO_VERSION}/kubo_v${KUBO_VERSION}_${PLATFORM_OS}-${PLATFORM_ARCH}.tar.gz"
  archive_path="$(mktemp -t kubo.XXXXXX.tar.gz)"
  temp_dir="$(mktemp -d -t kubo.XXXXXX)"

  log "Downloading Kubo ${KUBO_VERSION} for ${PLATFORM_OS}-${PLATFORM_ARCH}"
  download_file "$archive_url" "$archive_path"

  tar -xzf "$archive_path" -C "$temp_dir"
  binary_source="$temp_dir/kubo/ipfs"
  [ -x "$binary_source" ] || fail "Downloaded archive did not contain kubo/ipfs"

  install -m 0755 "$binary_source" "$INSTALL_BIN_DIR/ipfs"
  configure_repo
  write_helper_files

  rm -f "$archive_path"
  rm -rf "$temp_dir"

  log ""
  log "ipfs-node:ready"
  log "binary=$INSTALL_BIN_DIR/ipfs"
  log "repoPath=$IPFS_REPO_PATH"
  log "envFile=$INSTALL_ROOT/ipfs-node.env"
  log "startScript=$INSTALL_ROOT/start-ipfs-node.sh"
  log ""
  log "Next steps:"
  log "  1. Add $INSTALL_BIN_DIR to PATH if it is not already present."
  log "  2. source $INSTALL_ROOT/ipfs-node.env"
  log "  3. $INSTALL_ROOT/start-ipfs-node.sh"
}

main "$@"
