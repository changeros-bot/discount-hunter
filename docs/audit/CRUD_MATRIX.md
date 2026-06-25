# DCA 折價獵人 V16 CRUD Matrix

Last updated: 2026-06-25

This matrix tracks which modules read or write Ledger, Wallet, Price, Decision, Progress, and State. It is based on Audit-001 through Audit-011.

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
| `pages/api/telegram-alerts.js` | ❌ | ❌ | ❌ | ❌ | ✅ via `/api/sync-wallet` | ❌ | ✅ via `/api/prices` | ✅ next action | ✅ own engine | Sends every call; no cooldown/dedup |
| `pages/api/telegram-daily.js` | ❌ | ❌ | ❌ | ❌ | ✅ via `/api/sync-wallet` | ❌ | ✅ via `/api/prices` | ✅ near-buy rows | ✅ own engine | Daily Telegram report |
| `pages/api/daily-summary.js` | ❌ | ❌ | ❌ | ❌ | ✅ via `/api/sync-wallet` | ❌ | ✅ via `/api/prices` | ✅ near-buy rows | ✅ own engine | Duplicates telegram-daily-like flow |
| `pages/api/daily-position-report.js` | ❌ | ❌ | ❌ | ❌ | ✅ via `/api/sync-wallet` | ❌ | ❌ | ❌ | ❌ | Wallet-only position report; optional Telegram send |
| `pages/api/wallet-alerts.js` | ❌ | ❌ | ❌ | ❌ | ✅ via `/api/sync-wallet` | ❌ | ❌ | ✅ wallet health | ❌ | Sends only on anomaly or `notify=1` |
| `pages/api/wallet-change-alerts.js` | ❌ | ❌ | ❌ | ❌ | ✅ via `/api/sync-wallet` | ❌ | ❌ | ✅ wallet diff | ❌ | Writes KV wallet snapshot state |
| `pages/api/telegram-test.js` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Pure Telegram send test |
| `lib/telegram/notify.js` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Telegram transport only |
| `cloudflare/discount-hunter-cron-worker.js` | ❌ | ❌ | ❌ | ❌ | ❌ direct | ❌ | ❌ direct | ❌ direct | ❌ direct | Triggers `/api/telegram-alerts`; runtime deployment pending |
| `pages/v16-full.js` | ✅ via API | ❌ direct | ❌ direct | ❌ direct | ✅ via API | ❌ | ✅ via API | ✅ via API | ✅ own engine | Homepage, reconcile trigger, Ledger text display |
| `pages/v16-manual.js` | ✅ via API | ✅ via `/api/manual-buy` | ✅ via manual-buy | ❌ | ❌ | ❌ | ✅ via API | ✅ via today-decisions | ✅ via today-decisions | Manual decision surface |

## State Store / KV Writers

| Module / Function | State Read | State Write | Key / Store | Notes |
|---|---:|---:|---|---|
| `wallet-change-alerts` | ✅ | ✅ | `discount-hunter:v16:wallet-snapshot:{walletKey}` | Baseline and diff snapshot |
| `writeAlerts()` / `markAlertSent()` | ✅ | ✅ | Alert store JSON | Verified in `lib/v16-ledger.js`; full alert flow pending later audit |

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
| `wallet-change-alerts` | KV state | `getJson()` → diff → `setJson()` | Verified |
| `writeAlerts()` / `markAlertSent()` | Alerts state | `writeStoreJson()` | Verified in `lib/v16-ledger.js`; full alert flow pending later audit |

## Confirmed Non-Writers

| Module | Non-write confirmation |
|---|---|
| `/api/prices` | Does not read/write Ledger or Wallet |
| `telegram-alerts` | Sends Telegram and reads prices/wallet; does not write Ledger, Wallet, or KV state |
| `telegram-daily` / `daily-summary` | Send Telegram daily reports; do not write Ledger, Wallet, or KV state |
| `daily-position-report` | Wallet-only report; does not write Ledger, Wallet, or KV state |
| `wallet-alerts` | Wallet health checker; does not write Ledger, Wallet, or KV state |
| `telegram-test` | Pure Telegram send test |
| Debug APIs audited in Audit-002 | Read direct Wallet pipelines but do not write Ledger, Wallet, or formal state |
