# AI_HANDOFF.md

> 給下一位 GPT / AI / 工程師的交接文件。請先讀本檔，再操作 DCA 折價獵人。

## 1. Project Identity

Project name:

```text
DCA 折價獵人 / Discount Hunter V17
```

Primary goal:

```text
建立一個可長期執行的 Financial OS，用於監控 BTC + xStocks 折價買點、持倉、成本、PnL、今日決策與狀態機。
```

Current production URL:

```text
http://158.179.185.67:3000/v17
```

Oracle Binance Proxy:

```text
http://158.179.185.67:3001
```

Repo:

```text
https://github.com/changeros-bot/discount-hunter
```

## 2. Current Architecture

```text
Mobile Browser / Android shortcut
  -> Oracle VPS 158.179.185.67:3000
  -> Next.js Discount Hunter
  -> Upstash Redis REST for durable V17 state
  -> Oracle Binance Proxy 158.179.185.67:3001
  -> Binance API
  -> BSC RPC balanceOf for xStocks wallet holdings
```

## 3. Server State

```text
SSH user: ubuntu
Project path: ~/discount-hunter
Proxy path: ~/binance-proxy
PM2 services:
  - discount-hunter
  - oracle-binance-proxy
```

Check:

```bash
pm2 status
```

## 4. Environment Variables

Real secrets are in:

```bash
~/discount-hunter/.env.local
```

Template is in:

```text
docs/ENV_TEMPLATE.md
```

Required:

```env
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
BINANCE_REST_BASE_URL=http://158.179.185.67:3001
BINANCE_API_KEY=
BINANCE_API_SECRET=
WALLET_ADDRESS=0x657f5cbBC1FBE274299a6be52b5e46C3C6a9AD76
```

Never commit real secrets.

## 5. Known Current Status

Completed:

```text
Oracle VPS: working
Node.js 22: installed
PM2: working
Next.js production build: working
Upstash KV: working
Binance Proxy: working
Binance signed API: working
BTC quantity/cost/PnL: working
BSC wallet address: configured
xStocks live balanceOf: working
xStocks live prices: working
```

Known gap:

```text
xStocks cost basis is still fallback 5U because transfer history provider is not configured.
Need Moralis / NodeReal / MegaNode to make xStocks cost real.
```

Known V17 self-test failures:

```text
btc_uses_dedicated_model
d2_reenters_after_d1_complete
missing_price_suspect
deeper_layer_reenters_after_skip
```

These are action queue / state machine logic issues, not infrastructure issues.

## 6. Do Not Break These Rules

1. Do not commit `.env.local`.
2. Do not expose Binance API Secret.
3. Do not replace live wallet address unless user confirms.
4. Do not remove Upstash requirement for production mutable state.
5. Do not mix Investment Engine and Tactical Engine cost basis.
6. Do not treat xStocks fallback cost as final truth.
7. Do not assume Cloudflare Worker can call Binance; it failed with 451.
8. Do not use runtime file writes for production V17 mutable state.

## 7. Fast Health Check

Run:

```bash
curl http://158.179.185.67:3001/health
curl http://158.179.185.67:3001/api/v3/ticker/price?symbol=BTCUSDT
curl http://158.179.185.67:3000/api/v17/health
curl http://158.179.185.67:3000/api/binance-exchange-position
curl http://158.179.185.67:3000/api/sync-wallet
```

Expected:

```text
Proxy health ok
BTC price > 0
Upstash durable true
Binance configured true
BSC wallet configured true
BTC marketPrice > 0
xStocks holdingsCount > 0
```

## 8. Next Recommended Work

Priority 1:

```text
Rotate exposed Binance API key and Upstash token.
Update .env.local.
pm2 restart discount-hunter --update-env
```

Priority 2:

```text
Connect Moralis / NodeReal / MegaNode for xStocks transfer history.
Goal: totalTransfers > 0, buyRecordCount > 0, costBasisEstimated false.
```

Priority 3:

```text
Fix 4 V17 self-test failures.
```

Priority 4:

```text
Add HTTPS / domain name.
```

## 9. Common Commands

```bash
cd ~/discount-hunter
git pull
npm install
npm run build
pm2 restart discount-hunter --update-env
pm2 save
```

Proxy:

```bash
cd ~/binance-proxy
pm2 restart oracle-binance-proxy
pm2 save
```

Logs:

```bash
pm2 logs discount-hunter --lines 50
pm2 logs oracle-binance-proxy --lines 50
```

## 10. Human Context

User works mostly from Android phone. Avoid requiring desktop-only workflows. Prefer:

```text
copy/paste shell commands
short terminal outputs
no long screenshot dependency
no nano unless necessary
cat > file <<EOF pattern is preferred
```

User wants this project to be stable, repeatable, and transferable. Treat docs as production assets, not optional notes.
