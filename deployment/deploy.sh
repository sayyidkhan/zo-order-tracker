#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ALLOW_DIRTY=0
SKIP_PULL=0
REMOTE="${REMOTE:-origin}"
BRANCH="${BRANCH:-$(git -C "$ROOT_DIR" branch --show-current)}"

usage() {
  cat <<USAGE
Usage: bash deployment/deploy.sh [--allow-dirty] [--skip-pull]

Options:
  --allow-dirty  Deploy the current working tree without requiring a clean git state.
  --skip-pull    Skip git fetch/pull and deploy the current checkout as-is.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --allow-dirty)
      ALLOW_DIRTY=1
      ;;
    --skip-pull)
      SKIP_PULL=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1"
      usage
      exit 1
      ;;
  esac
  shift
done

cd "$ROOT_DIR"

if [[ "$ALLOW_DIRTY" -ne 1 ]] && [[ -n "$(git status --porcelain)" ]]; then
  echo "Refusing to deploy with uncommitted changes. Commit or stash them first, or rerun with --allow-dirty."
  exit 1
fi

if [[ "$SKIP_PULL" -ne 1 ]]; then
  echo "[deploy] fetching $REMOTE/$BRANCH"
  git fetch "$REMOTE" "$BRANCH"

  local_sha="$(git rev-parse HEAD)"
  remote_sha="$(git rev-parse "$REMOTE/$BRANCH")"

  if [[ "$local_sha" != "$remote_sha" ]]; then
    echo "[deploy] pulling latest code"
    git pull --ff-only "$REMOTE" "$BRANCH"
  else
    echo "[deploy] already at latest commit"
  fi
fi

echo "[deploy] running preflight build"
npm run install:app
npm run build
mkdir -p deployment/state
git rev-parse HEAD > deployment/state/last-built-commit

echo "[deploy] restarting service"
bash deployment/restart-service.sh

echo "[deploy] waiting for health check"
bash deployment/health-check.sh
