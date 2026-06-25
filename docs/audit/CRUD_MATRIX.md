# V16 Audit CRUD Matrix

This matrix tracks which modules read or write Ledger, Wallet, Price, Decision, Progress, and State.

## Core APIs

| Module / API | Read Ledger | Write Ledger | Append Buy | Mark Left Zones | Read Wallet | Write Wallet | Price | Decision | Progress | Notes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| `lib/v16-ledger.js` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | Core Ledger + decision helper module |
| `pages/api/buy-ledger.js` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | GET reads; POST appends via `appendBuy()` |
| `pages/api/manual-buy.js` | ✅ indirect | ✅ indirect | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Telegram/manual entry via `appendBuy()` |
| `pages/api/reconcile-tiers.js` | ✅ | ✅ | ❌ | ❌ | ✅ indirect | ❌ | ❌ | ✅ | ❌ | Backfills D1-D4 from wallet holdings and assets |
| `pages/api/reconcile-ledger.js` | ✅ | ✅ | ❌ | ❌ | ✅ indirect | ❌ | ❌ | ✅ | ❌ | Legacy D1-only backfill |
| `pages/api/today-decisions.js` | ✅ | ✅ conditional | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | Hidden write if no posted ledger |
| `pages/api/prices.js` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ initial signal | ❌ | Price API also calculates signal |
| `pages/api/telegram-alerts.js` | ❌ | ❌ | ❌ | ❌ | ✅ via sync-wallet | ❌ | ✅ via prices | ✅ next action | ✅ own engine | Uses wallet totalCost for completedLevel |
| `pages/v16-full.js` | ✅ via API | ❌ direct | ❌ direct | ❌ direct | ✅ via API | ❌ | ✅ via API | ✅ via API | ✅ own engine | Homepage display + reconcile trigger |
| `pages/v16-manual.js` | ✅ via API | ✅ via manual-buy | ✅ via manual-buy | ❌ | ❌ | ❌ | ✅ via API | ✅ via today-decisions | ✅ via today-decisions | Manual decision page |

## Debug APIs

| Module / API | Read Ledger | Write Ledger | Read Wallet / Transfers | Write State | Notes |
|---|---:|---:|---:|---:|---|
| `debug-holdings` | ❌ | ❌ | ✅ direct pipeline | ❌ | Debug-only |
| `debug-rpc-balances` | ❌ | ❌ | ✅ direct RPC/transfers | ❌ | Debug-only |
| `debug-transfers` | ❌ | ❌ | ✅ direct transfers | ❌ | Debug-only |
| `debug-cost-basis` | ❌ | ❌ | ✅ direct cost pipeline | ❌ | Debug-only |
| `debug-ledger` | ❌ | ❌ | ✅ legacy transfers | ❌ | Debug-only |

## Known Hotspots

- `today-decisions` can mutate Ledger through `markLeftBuyZonesForAssets()`.
- `reconcile-ledger` is legacy D1-only.
- Progress logic is duplicated across UI, Telegram, and helper libraries.
- Telegram progress uses Wallet totalCost rather than Ledger completed tiers.
