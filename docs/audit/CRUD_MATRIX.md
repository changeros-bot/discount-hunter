# DCA 折價獵人 V16 CRUD Matrix

Last updated: 2026-06-25

This matrix tracks which modules read or write Ledger, Wallet, Price, Decision, Progress, and State. It is based on Audit-001 through Audit-010.

## Core APIs and UI

| Module / API | Read Ledger | Write Ledger | Append Buy | Mark Left Zones | Read Wallet | Write Wallet | Price | Decision | Progress | Notes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| `lib/v16-ledger.js` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | Core Ledger helpers, Decision helpers, Progress helper |
| `pages/api/buy-ledger.js` | ✅ | ✅ via `appendBuy()` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | GET reads Ledger; POST appends manual rows |
| `pages/api/manual-buy.js` | ✅ indirect | ✅ via `appendBuy()` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Manual / Telegram text command entry |
| `pages/api/reconcile-tiers.js` | ✅ | ✅ direct | ❌ | ❌ | ✅ indirect via posted holdings | ❌ | ❌ | ✅ `getTriggeredDipTiers()` | ❌ | Backfill D1-D4 from holdings and assets |
| `pages/api/reconcile-ledger.js` | ✅ | ✅ direct | ❌ | ❌ | ✅ indirect via posted holdings | ❌ | ❌ | ✅ D1-only | ❌ | Legacy D1-only backfill |
| `pages/api/today-decisions.js` | ✅ | ✅ conditional | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ `getExecutableTiers()` | ✅ triggered 100% | Hidden write when no posted ledger |
| `pages/api/prices.js` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Binance xStocks | ✅ initial signal | ❌ | Price API also calculates signal |
| `pages/api/telegram-alerts.js` | ❌ | ❌ | ❌ | ❌ | ✅ via `/api/sync-wallet` | ❌ | ✅ via `/api/prices` | ✅ next action | ✅ own engine | Uses Wallet totalCost, not Ledger |
| `pages/v16-full.js` | ✅ via API | ❌ direct | ❌ direct | ❌ direct | ✅ via API | ❌ | ✅ via API | ✅ via API | ✅ own engine | Homepage, reconcile trigger, Ledger text display |
| `pages/v16-manual.js` | ✅ via API | ✅ via `/api/manual-buy` | ✅ via manual-buy | ❌ | ❌ | ❌ | ✅ via API | ✅ via today-decisions | ✅ via today-decisions | Manual decision surface |

## Debug APIs

| Module / API | Read Ledger | Write Ledger | Read Wallet / Transfers | Write State | Notes |
|---|---:|---:|---:|---:|---|
| `pages/api/debug-holdings.js` | ❌ | ❌ | ✅ direct pipeline | ❌ | Debug only; bypasses `/api/sync-wallet` |
| `pages/api/debug-rpc-balances.js` | ❌ | ❌ | ✅ direct RPC / transfers | ❌ | Debug only; no formal state mutation |
| `pages/api/debug-transfers.js` | ❌ | ❌ | ✅ direct transfers | ❌ | Debug only; returns transfer samples |
| `pages/api/debug-cost-basis.js` | ❌ | ❌ | ✅ direct transfers / cost basis | ❌ | Debug only; cost basis inspection |
| `pages/api/debug-ledger.js` | ❌ | ❌ | ✅ legacy transfers | ❌ | Debug only; builds buyRecords sample |

## Confirmed Writer Inventory

| Writer | Writes | Mechanism | Status |
|---|---|---|---|
| `appendBuy()` | Ledger | `readLedger()` → push row → `writeLedger()` | Verified |
| `markLeftBuyZonesForAssets()` | Ledger | `readLedger()` → mutate row leftBuyZone → `writeLedger()` if changed | Verified |
| `reconcile-tiers` | Ledger | Direct push into `ledger[symbol][tier]` → `writeLedger()` | Verified |
| `reconcile-ledger` | Ledger | Direct D1 push → `writeLedger()` | Verified legacy |
| `writeAlerts()` / `markAlertSent()` | Alerts state | `writeStoreJson()` | Verified in `lib/v16-ledger.js`; full alert flow pending later audit |

## Confirmed Non-Writers

| Module | Non-write confirmation |
|---|---|
| `/api/prices` | Does not read/write Ledger or Wallet |
| `telegram-alerts` | Sends Telegram and reads prices/wallet; does not write Ledger or Wallet |
| Debug APIs audited in Audit-002 | Read direct Wallet pipelines but do not write Ledger, Wallet, or formal state |
