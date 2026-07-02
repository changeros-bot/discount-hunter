#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
PROXY_URL="${PROXY_URL:-http://localhost:3001}"

echo "=== Proxy Health ==="
curl -fsS "$PROXY_URL/health"
echo

echo "=== V17 Health ==="
curl -fsS "$BASE_URL/api/v17/health"
echo

echo "=== Prices ==="
curl -fsS "$BASE_URL/api/prices" >/tmp/discount-hunter-prices.json
wc -c /tmp/discount-hunter-prices.json

echo "=== Binance Exchange Position ==="
curl -fsS "$BASE_URL/api/binance-exchange-position"
echo

echo "=== Wallet Sync ==="
curl -fsS "$BASE_URL/api/sync-wallet" >/tmp/discount-hunter-wallet.json
wc -c /tmp/discount-hunter-wallet.json

echo "=== Transfer Debug ==="
curl -fsS "$BASE_URL/api/debug-transfers"
echo

echo "verify-all complete"
