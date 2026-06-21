#!/usr/bin/env bash
set -euo pipefail

pattern='node .*deploy-server\.js'
pids="$(pgrep -f "$pattern" || true)"

if [[ -z "$pids" ]]; then
  echo "No running zo-order-tracker service process found."
  exit 1
fi

echo "Restarting zo-order-tracker service (pid: $(echo "$pids" | tr '\n' ' ' | sed 's/ $//'))"
kill -TERM $pids
