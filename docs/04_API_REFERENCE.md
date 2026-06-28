# DCA 折價獵人 API Reference

Last updated: 2026-06-29
Production base URL: https://discount-hunter-sigma.vercel.app

---

## `/api/prices`

Method: GET

Purpose: return xStocks price rows, high values, discount values, and signal layers.

Expected result:

- `ok: true`
- `status: PASS`
- `data` array with tracked symbols

Used by:

- Homepage
- Today Decisions
- Telegram alerts
- V16 status

---

## `/api/sync-wallet`

Methods: GET, POST

Purpose: sync live wallet holdings from BNB Chain RPC and combine with cost basis and prices.

Expected result:

- `ok: true`
- `holdings`
- `debugCounts.liveBalanceHoldingsCount`
- `debugCounts.selectedLiveBalanceHoldingsCount`

Important fields:

- `quantitySource = bsc_rpc_balanceOf_live`
- `costBasisSource`
- `costBasisEstimated`
- `currentValue`
- `unrealizedPnL`

Used by:

- Homepage
- Daily position report
- Telegram alerts
- V16 status
- Reconcile flow

---

## `/api/buy-ledger`

Method: GET

Purpose: return ledger state.

Expected result:

- `ok: true`
- `ledger`

Used by:

- Homepage
- Today Decisions
- V16 status

---

## `/api/today-decisions`

Method: POST

Purpose: calculate current actionable decisions from price rows and ledger.

Input:

- `assets`
- `ledger`

Expected result:

- `ok: true`
- `decisions`
- `updatedAt`

GET behavior:

- informational only; not the real decision path.

---

## `/api/reconcile-tiers`

Method: POST

Purpose: reconcile live wallet holdings into ledger tiers.

Input:

- `assets`
- `holdings`
- optional `dryRun`

Safety rules:

- holdings must come from live wallet sync.
- live holdings must have `quantitySource = bsc_rpc_balanceOf_live`.
- dry run must be supported for health checks.

---

## `/api/telegram-alerts`

Methods: GET, POST

Purpose: evaluate notification events and send Telegram messages when eligible.

Event types:

- near
- trigger
- retreat
- new_high
- system/wallet error

Expected result:

- `ok: true` when healthy
- `version`
- `eventCount`
- `sendableCount`
- `events`
- `sentEvents`

Must use:

- `lib/v16-health.js`
- `lib/v16-ledger.js` alert state

---

## `/api/daily-position-report`

Methods: GET, POST

Purpose: generate daily position report from live wallet holdings.

GET:

- preview only.

POST or `?send=1`:

- sends Telegram daily report subject to cooldown.

---

## `/api/daily-position`

Methods: GET, POST

Purpose: alias for `/api/daily-position-report`.

Reason:

- avoids 404 from shorter route usage.

---

## `/api/v16-status`

Method: GET

Purpose: release health gate.

Checks:

- durable state
- prices
- sync wallet
- reconcile dry run
- buy ledger
- Telegram cooldown
- daily position report

Expected result:

- `ok: true`
- `version`
- `pricesOk: true`
- `walletOk: true`
- `releaseBlocked: false`

---

## Deprecated or manual-only routes

- `/api/telegram-test` — manual Telegram transport test only.
- `/api/telegram-alert-check` — alert cooldown / state check.
- `/api/wallet-change-alerts` — manual only until explicitly promoted.

These routes must not be treated as primary production workflows unless documented in Audit and SOP.
