#!/usr/bin/env bash

set -euo pipefail

base_url="${1:-https://zo-order-tracker-shab.zocomputer.io}"

page_endpoints=(
  "/"
  "/user"
  "/user/login"
  "/login?role=user"
  "/login?role=admin"
  "/admin"
  "/intro"
  "/tech-stack"
  "/why-zo-computer"
)

api_endpoints=(
  "/api/health"
  "/health"
  "/auth/demo-credentials"
  "/config/shop"
  "/menu/preview"
)

sleep_with_jitter() {
  local min_seconds="$1"
  local max_seconds="$2"
  local duration="$min_seconds"

  if (( max_seconds > min_seconds )); then
    duration=$(( RANDOM % (max_seconds - min_seconds + 1) + min_seconds ))
  fi

  sleep "$duration"
}

ping_endpoint() {
  local path="$1"
  local accept_header="$2"
  local full_url="${base_url%/}${path}"

  curl \
    --fail \
    --silent \
    --show-error \
    --location \
    --max-time 20 \
    --retry 2 \
    --retry-delay 3 \
    --header "Accept: ${accept_header}" \
    --header 'Cache-Control: no-cache' \
    --header "User-Agent: zo-order-tracker-keepalive/1.0" \
    "$full_url" >/dev/null

  echo "Ping OK: $full_url"
}

echo "Starting paced keepalive sweep against ${base_url%/}"

for path in "${page_endpoints[@]}"; do
  ping_endpoint "$path" "text/html,application/xhtml+xml"
  sleep_with_jitter 2 6
done

sleep_with_jitter 8 15

for path in "${api_endpoints[@]}"; do
  ping_endpoint "$path" "application/json"
  sleep_with_jitter 1 4
done

echo "Keepalive sweep complete."
