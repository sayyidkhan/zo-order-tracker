#!/usr/bin/env bash

set -euo pipefail

url="${1:-https://zo-order-tracker-shab.zocomputer.io/api/health}"

curl \
  --fail \
  --silent \
  --show-error \
  --location \
  --max-time 20 \
  --retry 2 \
  --retry-delay 5 \
  --header 'Accept: application/json' \
  "$url" >/dev/null

echo "Ping OK: $url"
