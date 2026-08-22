#!/usr/bin/env bash
set -euo pipefail

pnpm exec wrangler dev --local --port 8787 > /tmp/career-compass-preview.log 2>&1 &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT

for _ in $(seq 1 30); do
  if curl --fail --silent --show-error --dump-header /tmp/career-compass-health.headers \
    --output /tmp/career-compass-health.body http://127.0.0.1:8787/api/health; then
    break
  fi
  sleep 1
done

grep -qi '^HTTP/1.1 200' /tmp/career-compass-health.headers
grep -qi '^x-request-id:' /tmp/career-compass-health.headers
grep -qi '^content-security-policy:' /tmp/career-compass-health.headers
grep -qi '^x-content-type-options: nosniff' /tmp/career-compass-health.headers
grep -qi '^cache-control: no-store' /tmp/career-compass-health.headers
grep -q '"status":"ok"' /tmp/career-compass-health.body
curl --fail --silent http://127.0.0.1:8787/ | grep -q '準備中'
