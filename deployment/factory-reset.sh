#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKIP_RESTART=0
NODE_ARGS=()

usage() {
  cat <<USAGE
Usage: bash deployment/factory-reset.sh [--dry-run] [--yes] [--skip-restart]

Options:
  --dry-run       Show what would be reset without changing data.
  --yes           Confirm the destructive reset.
  --skip-restart  Do not restart the Zo service after resetting data.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-restart)
      SKIP_RESTART=1
      ;;
    --dry-run|--yes)
      NODE_ARGS+=("$1")
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

node backend/scripts/factory-reset.js "${NODE_ARGS[@]}"

if [[ " ${NODE_ARGS[*]} " == *" --dry-run "* ]]; then
  exit 0
fi

if [[ "$SKIP_RESTART" -eq 1 ]]; then
  echo "Factory reset finished without restarting the service."
  exit 0
fi

if pgrep -f 'node .*deploy-server\.js' >/dev/null 2>&1; then
  echo "Restarting live service after factory reset"
  bash deployment/restart-service.sh
  bash deployment/health-check.sh
else
  echo "Factory reset finished. No running zo-order-tracker service process was found, so restart was skipped."
fi
