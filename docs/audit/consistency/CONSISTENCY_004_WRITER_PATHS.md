# Consistency-004 Writer Path Check

Date: 2026-06-26
Status: PASS WITH NOTES
Phase: Audit Consistency Check

## Purpose

Verify that all state-changing paths are known before entering Fix Phase.

This check focuses on mutation and external side-effect paths:

1. Ledger writes
2. Alert State writes
3. Wallet Snapshot writes
4. Telegram send paths
5. Hidden or indirect writers

## Scope

Repository source and audit documentation only. This does not verify live production delivery, Vercel runtime configuration, Cloudflare Cron deployment, or Upstash durability.

## Method

Repository searches were performed for the following writer and side-effect keywords:

- `writeLedger`
- `appendBuy`
- `markLeftBuyZonesForAssets`
- `writeAlerts`
- `markAlertSent`
- `setJson`
- `wallet-snapshot`
- `sendTelegramMessage`

Results were cross-checked against `docs/audit/CRUD_MATRIX.md` and `docs/audit/ISSUE_REGISTER.md`.

## Evidence Summary

### Ledger Writers

Confirmed Ledger writer paths:

| Writer | Path | Type | Notes |
|---|---|---|---|
| `writeLedger()` | `lib/v16-ledger.js` | Core writer | Used by ledger helpers and direct writer APIs |
| `appendBuy()` | `lib/v16-ledger.js` | Formal append writer | Used by manual buy flows; no same-tier idempotency yet |
| `/api/buy-ledger` | `pages/api/buy-ledger.js` | API append writer | POST appends through `appendBuy()` |
| `/api/manual-buy` | `pages/api/manual-buy.js` | API append writer | Calls `appendBuy()`; duplicate same-tier risk remains |
| `/api/reconcile-tiers` | `pages/api/reconcile-tiers.js` | Direct backfill writer | Direct Ledger push/write for D1-D4 backfill |
| `/api/reconcile-ledger` | `pages/api/reconcile-ledger.js` | Legacy direct writer | D1-only legacy writer |
| `markLeftBuyZonesForAssets()` | `lib/v16-ledger.js` | Conditional Ledger mutator | Used by `today-decisions` hidden-write path |
| `/api/today-decisions` | `pages/api/today-decisions.js` | Conditional indirect writer | Hidden write when no explicit Ledger payload is provided |

### State / KV Writers

Confirmed non-Ledger state writers:

| Writer | Path | State | Notes |
|---|---|---|---|
| `writeAlerts()` / `markAlertSent()` | `lib/v16-ledger.js` | Alert State | Used by alert-state flow, not fully integrated into main Telegram sends |
| `/api/telegram-alert-check` | `pages/api/telegram-alert-check.js` | Alert State | Uses alert cooldown/check state |
| `setJson()` wallet snapshot path | `pages/api/wallet-change-alerts.js` | Wallet Snapshot State | Upstash-only snapshot writer |

### Telegram Send Side Effects

Confirmed Telegram send paths using `sendTelegramMessage()`:

| Path | Side Effect | Notes |
|---|---|---|
| `pages/api/telegram-alerts.js` | Sends Telegram | Main alert path; no cooldown/dedup integration yet |
| `pages/api/telegram-daily.js` | Sends Telegram | Daily report path |
| `pages/api/daily-summary.js` | Sends Telegram | Duplicate daily-report-like path |
| `pages/api/daily-position-report.js` | Optional Telegram send | Wallet-only position report |
| `pages/api/wallet-alerts.js` | Conditional Telegram send | Sends anomaly or forced notification |
| `pages/api/wallet-change-alerts.js` | Conditional Telegram send | Also writes wallet snapshot state |
| `pages/api/telegram-test.js` | Test Telegram send | Test-only side effect |

Telegram sends are external side effects, not Ledger writes. They still require release gating because repeated calls can spam the user.

## Hidden Writers

Confirmed hidden / indirect writer:

- `/api/today-decisions` can call `markLeftBuyZonesForAssets()` when the request does not include an explicit Ledger payload.
- `pages/v16-manual.js` calls `/api/today-decisions` without posting Ledger, so it can trigger this path.

This is already tracked as P0-001 and P0-003.

## Debug API Review

Current audit documentation states debug APIs are read-only diagnostics and do not write Ledger, Wallet, or formal state. They remain cleanup candidates, not immediate Fix Phase targets.

## Result

PASS WITH NOTES.

No new Ledger writer category was found beyond the already documented writer inventory.

Known writer risks remain:

1. `today-decisions` hidden Ledger write path.
2. `manual-buy` / `appendBuy()` duplicate same-tier risk.
3. `reconcile-ledger` legacy D1-only writer still exists.
4. Main Telegram send flows are not dedup/cooldown-gated.
5. `wallet-change-alerts` writes Upstash-only wallet snapshot state and requires runtime verification.

## Impact on Fix Phase

Fix Phase may start after remaining consistency checks, but the first fixes must target the known writer risks in this order:

1. P0 hidden write neutralization.
2. P0 legacy reconcile-ledger deprecation/disable/redirect decision.
3. P1 manual-buy same-tier idempotency.
4. P1/P2 Telegram cooldown/dedup release gate.
5. P1/P2 runtime state durability gate.

## Next Consistency Check

Proceed to Consistency-005 State Flow Check.
