#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="$ROOT_DIR/deployment/state"
STAMP_FILE="$STATE_DIR/last-built-commit"
DIST_FILE="$ROOT_DIR/frontend/dist/index.html"
BACKEND_NODE_MODULES="$ROOT_DIR/backend/node_modules"
FRONTEND_NODE_MODULES="$ROOT_DIR/frontend/node_modules"

mkdir -p "$STATE_DIR"
cd "$ROOT_DIR"

current_commit="$(git rev-parse HEAD)"
needs_build=1

if [[ -f "$STAMP_FILE" ]] \
  && [[ -f "$DIST_FILE" ]] \
  && [[ -d "$BACKEND_NODE_MODULES" ]] \
  && [[ -d "$FRONTEND_NODE_MODULES" ]] \
  && [[ "$(cat "$STAMP_FILE")" == "$current_commit" ]]; then
  needs_build=0
fi

if [[ "$needs_build" -eq 1 ]]; then
  echo "[deploy] installing dependencies"
  npm run install:app

  echo "[deploy] building frontend bundle"
  npm run build

  printf '%s\n' "$current_commit" > "$STAMP_FILE"
else
  echo "[deploy] reusing existing build for commit $current_commit"
fi

exec node deploy-server.js
