#!/usr/bin/env bash
set -euo pipefail

APP_URL="${APP_URL:-https://zo-order-tracker-shab.zocomputer.io}"
MAX_ATTEMPTS="${MAX_ATTEMPTS:-30}"
SLEEP_SECONDS="${SLEEP_SECONDS:-2}"

for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  if response="$(curl -fsS --max-time 10 "$APP_URL/api/health" 2>/dev/null)"; then
    echo "$response"
    exit 0
  fi

  echo "Waiting for service health ($attempt/$MAX_ATTEMPTS)..."
  sleep "$SLEEP_SECONDS"
done

echo "Service did not become healthy at $APP_URL/api/health"
exit 1
