#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_PORT="${ZORDER_BACKEND_PORT:-4001}"
APP_PATTERN='node .*deploy-server\.js'

app_pids="$(pgrep -f "$APP_PATTERN" || true)"
backend_pids="$(lsof -tiTCP:"$BACKEND_PORT" -sTCP:LISTEN || true)"
all_pids="$(printf '%s\n%s\n' "$app_pids" "$backend_pids" | awk 'NF {print}' | sort -u)"

if [[ -z "$all_pids" ]]; then
  echo "No running zo-order-tracker processes found."
  exit 1
fi

echo "Restarting zo-order-tracker processes (pid: $(echo "$all_pids" | tr '\n' ' ' | sed 's/ $//'))"
kill -TERM $all_pids

for _ in $(seq 1 20); do
  remaining=""
  for pid in $all_pids; do
    if kill -0 "$pid" 2>/dev/null; then
      remaining="$remaining $pid"
    fi
  done

  if [[ -z "${remaining// }" ]]; then
    exit 0
  fi

  sleep 1
done

remaining=""
for pid in $all_pids; do
  if kill -0 "$pid" 2>/dev/null; then
    remaining="$remaining $pid"
  fi
done

if [[ -n "${remaining// }" ]]; then
  echo "Processes did not exit after SIGTERM; sending SIGKILL to:${remaining}"
  kill -KILL $remaining
fi
