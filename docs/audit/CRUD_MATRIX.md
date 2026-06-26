# DCA 折價獵人 V16 CRUD Matrix

Last updated: 2026-06-26

This matrix tracks which modules read or write Ledger, Wallet, Price, Decision, Progress, State, and Runtime Config. It is based on Audit-001 through Audit-017.

## Core APIs and UI

| Module / API | Read Ledger | Write Ledger | Append Buy | Mark Left Zones | Read Wallet | Write Wallet | Price | Decision | Progress | Notes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| `lib/v16-ledger.js` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | Core Ledger, Decision, Progress, and Alert State helpers; uses Upstash/memory/file fallback store |
| `pages/api/buy-ledger.js` | ✅ | ✅ via `appendBuy()` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | GET reads Ledger; POST appends manual rows |
| `pages/api/manual-buy.js` | ✅ indirect | ✅ via `appendBuy()` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Validates symbol/tier/amount but does not dedup same-tier rows |
| `pages/api/reconcile-tiers.js` | ✅ | ✅ direct | ❌ | ❌ | ✅ indirect via posted holdings | ❌ | ❌ | ✅ `getTriggeredDipTiers()` | ❌ | Backfill D1-D4 from holdings and assets; not checked by v16-status |
| `pages/api/reconcile-ledger.js` | ✅ | ✅ direct | ❌ | ❌ | ✅ indirect via posted holdings | ❌ | ❌ | ✅ D1-only | ❌ | Legacy D1-only backfill |
| `pages/api/today-decisions.js` | ✅ | ✅ conditional | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ `getExecutableTiers()` | ✅ triggered 100% | Hidden write when no posted ledger; marked manual_test_required by v16-status |
| `pages/api/prices.js` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Binance xStocks | ✅ initial signal | ❌ | Price API also calculates signal; not checked by v16-status |
| `pages/api/sync-wallet.js` | ❌ | ❌ | ❌ | ❌ | ✅ live RPC + transfer cost basis | ❌ | ✅ token/reference prices | ❌ | ❌ | Critical wallet source API; not checked by v16-status |
| `pages/api/telegram-alerts.js` | ❌ | ❌ | ❌ | ❌ | ✅ via `/api/sync-wallet` | ❌ | ✅ via `/api/prices` | ✅ next action | ✅ own engine | Sends every call; not checked by v16-status |
| `pages/api/telegram-alert-check.js` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ alert cooldown check | ❌ | Uses Alert State; checked by v16-status |
| `pages/api/telegram-daily.js` | ❌ | ❌ | ❌ | ❌ | ✅ via `/api/sync-wallet` | ❌ | ✅ via `/api/prices` | ✅ near-buy rows | ✅ own engine | Daily Telegram report |
| `pages/api/daily-summary.js` | ❌ | ❌ | ❌ | ❌ | ✅ via `/api/sync-wallet` | ❌ | ✅ via `/api/prices` | ✅ near-buy rows | ✅ own engine | Duplicates telegram-daily-like flow |
| `pages/api/daily-position-report.js` | ❌ | ❌ | ❌ | ❌ | ✅ via `/api/sync-wallet` | ❌ | ❌ | ❌ | ❌ | Wallet-only position report; optional Telegram send; checked by v16-status |
| `pages/api/wallet-alerts.js` | ❌ | ❌ | ❌ | ❌ | ✅ via `/api/sync-wallet` | ❌ | ❌ | ✅ wallet health | ❌ | Sends only on anomaly or `notify=1` |
| `pages/api/wallet-change-alerts.js` | ❌ | ❌ | ❌ | ❌ | ✅ via `/api/sync-wallet` | ❌ | ❌ | ✅ wallet diff | ❌ | Writes Upstash-only wallet snapshot state; disabled without Upstash |
| `pages/api/telegram-test.js` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Pure Telegram send test |
| `pages/api/v16-status.js` | ❌ | ❌ | ❌ | ❌ | ❌ direct | ❌ | ❌ direct | ❌ direct | ❌ | Partial smoke-test + static checklist; does not cover critical APIs |
| `lib/state/kv.js` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Low-level Upstash `GET` / `SET` JSON wrapper |
| `lib/telegram/notify.js` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Telegram transport only; skips if env missing |
| `cloudflare/discount-hunter-cron-worker.js` | ❌ | ❌ | ❌ | ❌ | ❌ direct | ❌ | ❌ direct | ❌ direct | ❌ direct | Triggers `/api/telegram-alerts`; runtime deployment pending |
| `pages/v16-full.js` | ✅ via `/api/buy-ledger` | ❌ direct / ✅ indirect via reconcile | ❌ direct | ❌ | ✅ via `/api/sync-wallet` | ❌ | ✅ via `/api/prices` | ✅ via `/api/today-decisions` | ✅ own engine | Main dashboard; triggers `/api/reconcile-tiers`; 5s read refresh |
| `pages/v16-manual.js` | ✅ via `/api/buy-ledger` | ✅ via `/api/manual-buy`; ✅ possible hidden write via `today-decisions` | ✅ via manual-buy | ✅ indirect via `today-decisions` without ledger | ❌ | ❌ | ✅ via `/api/prices` | ✅ via `/api/today-decisions` | ✅ via today-decisions | Manual decision surface; calls `today-decisions` without ledger |

## State Store / KV Writers

| State | Reader(s) | Writer(s) | Key / Store | Fallback Behavior | Notes |
|---|---|---|---|---|---|
| Ledger State | `readLedger()` | `writeLedger()`, `appendBuy()`, `markLeftBuyZonesForAssets()`, `reconcile-tiers`, `reconcile-ledger` | `discount-hunter:v16:buy-ledger` / `data/buy-ledger.json` | Upstash → memory → local file only in non-production/non-Vercel | Production without Upstash uses volatile memory |
| Alert State | `readAlerts()`, `telegram-alert-check` | `writeAlerts()`, `markAlertSent()`, `telegram-alert-check` with commit | `discount-hunter:v16:telegram-alerts` / `data/alerts.json` | Upstash → memory → local file only in non-production/non-Vercel | Main Telegram send flow does not use it yet |
| Wallet Snapshot State | `wallet-change-alerts` | `wallet-change-alerts` | `discount-hunter:v16:wallet-snapshot:{walletKey}` | Upstash only; disabled without Upstash | No memory/file fallback; returns `enabled:false` if missing config |

## Runtime Env Inventory

| Env Var | Used By | Required Level | Behavior If Missing |
|---|---|---|---|
| `WALLET_ADDRESS` | `/api/sync-wallet` | Required for default wallet sync | API returns invalid/missing wallet error if no body/query address |
| `BSC_RPC_URL` | `lib/xstocks/rpcBalances.js` | Optional but recommended | Falls back to public BSC RPC URLs |
| `NEXT_PUBLIC_BSC_RPC_URL` | `lib/xstocks/rpcBalances.js` | Optional | Alternative custom RPC fallback source |
| `TELEGRAM_BOT_TOKEN` | `lib/telegram/notify.js` | Required for Telegram send | Telegram send returns `ok:false`, `skipped:true` |
| `TELEGRAM_CHAT_ID` | `lib/telegram/notify.js` | Required for Telegram send | Telegram send returns `ok:false`, `skipped:true` |
| `UPSTASH_REDIS_REST_URL` | `lib/state/kv.js` | Required for durable Ledger/Alert/Snapshot state | Ledger/Alert fall back to memory/file rules; wallet snapshot disabled |
| `UPSTASH_REDIS_REST_TOKEN` | `lib/state/kv.js` | Required for durable Ledger/Alert/Snapshot state | Ledger/Alert fall back to memory/file rules; wallet snapshot disabled |
| `MORALIS_API_KEY` / `MORALIS_KEY` | `lib/xstocks/moralis.js`, transfer source | Optional transfer source | Transfer source falls through to MegaNode/legacy/empty transfers |
| `MORALIS_LIMIT` | `lib/xstocks/moralis.js` | Optional tuning | Defaults to internal Moralis limit |
| `MORALIS_MAX_PAGES` | `lib/xstocks/moralis.js` | Optional tuning | Defaults to 20 pages |
| `MEGANODE_API_KEY` / `NODEREAL_API_KEY` | `lib/xstocks/transfer-source.js`, MegaNode/NodeReal path | Optional transfer source | Transfer source falls through to legacy/empty transfers |
| `MEGANODE_ENDPOINT` / `NODEREAL_ENDPOINT` | `lib/xstocks/transfer-source.js`, MegaNode/NodeReal path | Optional transfer source | Transfer source falls through to legacy/empty transfers |

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
| `appendBuy()` | Ledger | `readLedger()` → push row → `writeLedger()` | Verified; no idempotency/dedup |
| `markLeftBuyZonesForAssets()` | Ledger | `readLedger()` → mutate row leftBuyZone → `writeLedger()` if changed | Verified |
| `reconcile-tiers` | Ledger | Direct push into `ledger[symbol][tier]` → `writeLedger()` | Verified |
| `reconcile-ledger` | Ledger | Direct D1 push → `writeLedger()` | Verified legacy |
| `wallet-change-alerts` | KV wallet snapshot state | `getJson()` → diff → `setJson()` | Verified; Upstash-only |
| `writeAlerts()` / `markAlertSent()` | Alerts state | `readAlerts()` → mutate key → `writeAlerts()` | Verified |

## Confirmed Non-Writers

| Module | Non-write confirmation |
|---|---|
| `/api/prices` | Does not read/write Ledger or Wallet |
| `/api/sync-wallet` | Reads wallet and prices; does not write Ledger, Wallet, or formal state |
| `telegram-alerts` | Sends Telegram and reads prices/wallet; does not write Ledger, Wallet, or KV state |
| `telegram-daily` / `daily-summary` | Send Telegram daily reports; do not write Ledger, Wallet, or KV state |
| `daily-position-report` | Wallet-only report; does not write Ledger, Wallet, or KV state |
| `wallet-alerts` | Wallet health checker; does not write Ledger, Wallet, or KV state |
| `telegram-test` | Pure Telegram send test |
| `v16-full loadAll()` | Read-only path; passes explicit Ledger to `today-decisions`, avoiding hidden write |
| `v16-status` | Does not POST to manual-write APIs; marks them manual_test_required; partial coverage only |
| Debug APIs audited in Audit-002 | Read direct Wallet pipelines but do not write Ledger, Wallet, or formal state |
