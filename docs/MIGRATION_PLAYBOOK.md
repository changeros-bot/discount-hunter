# Discount Hunter Migration Playbook

This document is the canonical migration guide.

## Current Architecture
- Oracle VPS
- PM2 services: discount-hunter, oracle-binance-proxy
- Upstash Redis
- Binance read-only API
- BSC wallet sync

## Required environment variables
- UPSTASH_REDIS_REST_URL
- UPSTASH_REDIS_REST_TOKEN
- BINANCE_REST_BASE_URL
- BINANCE_API_KEY
- BINANCE_API_SECRET
- WALLET_ADDRESS

## Migration checklist
1. Provision new VPS.
2. Install Node.js and PM2.
3. Clone repository.
4. Restore .env.local.
5. npm install
6. npm run build
7. pm2 start npm --name discount-hunter -- start
8. Start oracle-binance-proxy.
9. Verify /api/v17/health.
10. Verify /api/binance-exchange-position.
11. Verify /api/sync-wallet.
12. Verify UI.

## Notes
- Upstash stores durable state.
- Do not rely on runtime files for mutable state.
- Cost basis requires a transfer-history provider (Moralis, MegaNode, or NodeReal).