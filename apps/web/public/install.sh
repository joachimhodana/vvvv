#!/usr/bin/env bash
set -euo pipefail

REPO="joachimhodana/vvvv"
BINARY="vvvv-core"
INSTALL_DIR="/usr/local/bin"

get_os() {
  case "$(uname -s)" in
    Linux*)  echo "linux" ;;
    Darwin*) echo "darwin" ;;
    *)       echo "unsupported"; return 1 ;;
  esac
}

get_arch() {
  case "$(uname -m)" in
    x86_64|amd64)  echo "amd64" ;;
    arm64|aarch64) echo "arm64" ;;
    *)             echo "unsupported"; return 1 ;;
  esac
}

main() {
  local os arch tag url tmp

  os="$(get_os)"
  arch="$(get_arch)"

  echo "→ Detected ${os}/${arch}"

  tag="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
    | grep '"tag_name"' | head -1 | cut -d'"' -f4)"

  if [ -z "${tag}" ]; then
    echo "✗ Could not determine latest release" >&2
    exit 1
  fi

  echo "→ Latest release: ${tag}"

  url="https://github.com/${REPO}/releases/download/${tag}/${BINARY}_${os}_${arch}"

  tmp="$(mktemp)"
  echo "→ Downloading ${url}"
  curl -fSL -o "${tmp}" "${url}"
  chmod +x "${tmp}"

  if [ -w "${INSTALL_DIR}" ]; then
    mv "${tmp}" "${INSTALL_DIR}/${BINARY}"
  else
    echo "→ Installing to ${INSTALL_DIR} (requires sudo)"
    sudo mv "${tmp}" "${INSTALL_DIR}/${BINARY}"
  fi

  echo "✓ Installed ${BINARY} to ${INSTALL_DIR}/${BINARY}"
  echo "  Run:  ${BINARY} listen"
}

main
