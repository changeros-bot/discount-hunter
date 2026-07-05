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
https://discount-hunter-sigma.vercel.app/v17
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
  -> Vercel Production /v17
  -> Next.js Discount Hunter
  -> Upstash Redis REST for durable V17 state
  -> Oracle Binance Proxy 158.179.185.67:3001
  -> Binance API for BTC quantity / BTC trades / BTC cost basis
  -> BSC RPC balanceOf for xStocks wallet quantities
  -> NodeReal / MegaNode standard BSC RPC eth_getLogs for xStocks transfer history and cost basis
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

Required for xStocks real cost basis:

```env
NODEREAL_API_KEY=
```

Accepted aliases are also supported by the code:

```env
NODE_REAL_API_KEY=
NODEREAL_KEY=
NODEREAL_BSC_API_KEY=
NODEREAL_BSC_MAINNET_API_KEY=
MEGANODE_API_KEY=
MEGA_NODE_API_KEY=
MEGANODE_KEY=
NODEREAL_ENDPOINT=
NODE_REAL_ENDPOINT=
NODEREAL_BSC_ENDPOINT=
NODEREAL_BSC_MAINNET_ENDPOINT=
MEGANODE_ENDPOINT=
MEGA_NODE_ENDPOINT=
```

Never commit real secrets.

## 5. Current Stable Status

Stable baseline after 2026-07-05 recovery:

```text
Real Position Audit: PASS
BTC quantity: PASS_API_SYNCED
BTC cost basis: PASS_API_SYNCED
xStocks quantity: PASS
xStocks cost basis: PASS
NodeReal / MegaNode source: PASS via standard BSC RPC eth_getLogs
State Machine: PASS
Universe: U10
Today decisions: D0
Holding zone: H6
Watch zone: W4
```

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
xStocks real cost basis: working via NodeReal / MegaNode eth_getLogs
```

Previous known gap, now resolved:

```text
Old gap: xStocks cost basis used fallback 5U because transfer history provider was not configured.
Resolution: NodeReal / MegaNode is now used as the primary transfer-history provider through standard BSC RPC eth_getLogs.
Cost basis rule: stablecoin OUT + xStock IN in the same tx hash = BUY.
No fake 5U cost is allowed after this fix.
```

Known V17 self-test failures from older handoff:

```text
btc_uses_dedicated_model
d2_reenters_after_d1_complete
missing_price_suspect
deeper_layer_reenters_after_skip
```

These are action queue / state machine logic issues, not infrastructure issues. Do not confuse them with cost basis.

## 6. 2026-07-05 Incident Postmortem: Cost Basis / Fallback Accident

### What happened

A V17.1 sealed system was modified too aggressively on main. The previous xStocks cost basis gap was documented, but not read first. The old system looked normal because fallback / temporary cost logic was still supporting xStocks cost display. When fallback was removed before the real transfer-history source was verified, the UI exposed missing xStocks cost basis and briefly showed misleading PnL behavior.

### Actual root cause

```text
Root cause was process failure, not wallet failure.
The xStocks wallet balances were correct.
BSC balanceOf was correct.
The old handoff already said xStocks cost basis was fallback 5U and needed Moralis / NodeReal / MegaNode.
The mistake was removing fallback and touching main before verifying the real cost source.
```

### Concrete mistakes

```text
1. Did not read AI_HANDOFF Known Gap before editing.
2. Removed fallback before real NodeReal / MegaNode transfer history was verified.
3. Edited main repeatedly instead of using branch -> audit page -> verify -> merge.
4. Briefly mixed known-cost BTC with missing-cost xStocks in total PnL, producing a misleading +805% style result.
5. Created one broken deployment due to an incomplete JSX file in the audit page.
6. Initially assumed NodeReal key was missing, but the real issue was method compatibility: nr_getAssetTransfers was not supported on the available endpoint.
```

### Recovery steps

```text
1. Added Real Position Audit to show BTC quantity/cost and xStocks quantity/cost independently.
2. Corrected PnL logic: only holdings with real cost basis can enter PnL / return calculations.
3. Added /v17-cost-basis-audit and /api/v17/xstocks-cost-basis-audit.
4. Diagnosed providers:
   - Moralis: ZERO transfer history
   - MegaNode / NodeReal: key detected but enhanced method failed
   - BscScan / Etherscan V2: not usable as primary source in current free/API setup
5. Replaced NodeReal enhanced method nr_getAssetTransfers with standard BSC RPC eth_getLogs.
6. Rebuilt xStocks cost basis from ERC20 Transfer events:
   - xStock contract Transfer IN to wallet
   - stablecoin Transfer OUT from wallet
   - same transaction hash
7. Verified final state:
   - Transfer Count > 0
   - BUY Pattern Hash > 0
   - Official BUY Records > 0
   - 8 xStocks cost basis PASS
   - Real Position Audit PASS
```

### Final data source truth after recovery

```text
BTC quantity: Binance read-only /api/v3/account
BTC cost: Binance /api/v3/myTrades derived weighted average
xStocks quantity: BSC balanceOf
xStocks cost: NodeReal / MegaNode standard BSC RPC eth_getLogs
xStocks price: Binance xStocks live/reference price source
PnL eligibility: only assets with real cost basis
```

### Permanent lesson

```text
A sealed Financial OS must not be made more honest by first breaking the UI.
First verify the real source in an audit page, then replace fallback, then merge into production.
```

## 7. Do Not Break These Rules

1. Do not commit `.env.local`.
2. Do not expose Binance API Secret.
3. Do not replace live wallet address unless user confirms.
4. Do not remove Upstash requirement for production mutable state.
5. Do not mix Investment Engine and Tactical Engine cost basis.
6. Do not treat fallback cost as final truth.
7. Do not reintroduce 5U fallback as real xStocks cost.
8. Do not calculate PnL / return for assets with missing cost basis.
9. Do not assume a provider key is missing before checking env aliases, Production scope, and latest deployment.
10. Do not use NodeReal enhanced methods as the only transfer-history method. Standard BSC RPC `eth_getLogs` is the stable fallback.
11. Do not assume Cloudflare Worker can call Binance; it failed with 451.
12. Do not use runtime file writes for production V17 mutable state.
13. Do not edit Wallet / Decision Engine / Snapshot / Classifier / Cost Basis directly on main unless the user explicitly approves emergency production repair.

## 8. Required Change Process After This Incident

For any future core change:

```text
1. Read AI_HANDOFF.md and docs/V17_CONSTITUTION.md first.
2. Identify whether the issue is data source, parser, UI, state machine, or deployment.
3. Create / use an audit page first.
4. Prove source PASS in audit page.
5. Only then connect to /v17.
6. Do not remove fallback until replacement source is verified.
7. After merge, record a stable baseline.
```

Do not skip these steps even if the fix looks obvious.

## 9. Fast Health Check

Run:

```bash
curl http://158.179.185.67:3001/health
curl http://158.179.185.67:3001/api/v3/ticker/price?symbol=BTCUSDT
curl https://discount-hunter-sigma.vercel.app/api/v17/xstocks-cost-basis-audit
curl https://discount-hunter-sigma.vercel.app/v17
```

Expected:

```text
Proxy health ok
BTC price > 0
Binance configured true
BSC wallet configured true
BTC marketPrice > 0
xStocks holdingsCount > 0
Real Position Audit PASS
NodeReal / MegaNode PASS or selected source MegaNode / NodeReal
xStocks cost basis PASS
State Machine PASS
```

## 10. Next Recommended Work

Priority 1:

```text
Do not modify V17 core. Freeze current stable baseline.
```

Priority 2:

```text
Add a read-only reconciliation table:
Binance/wallet quantity vs system quantity vs difference.
This must be read-only and must not alter Wallet / Cost Basis / Decision Engine.
```

Priority 3:

```text
Rotate exposed Binance API key and Upstash token if they were exposed in any logs or screenshots.
Update .env.local.
pm2 restart discount-hunter --update-env
```

Priority 4:

```text
Fix old V17 self-test failures only after branching and audit.
```

Priority 5:

```text
Add HTTPS / domain name for VPS paths if still needed.
```

## 11. Common Commands

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

## 12. Human Context

User works mostly from Android phone. Avoid requiring desktop-only workflows. Prefer:

```text
copy/paste shell commands
short terminal outputs
no long screenshot dependency
no nano unless necessary
cat > file <<EOF pattern is preferred
```

User wants this project to be stable, repeatable, and transferable. Treat docs as production assets, not optional notes.

After the 2026-07-05 incident, be extra careful with language. If a broken state was caused by our code change, say so directly. Do not blame the user for environment variables until the diagnostics prove it.
