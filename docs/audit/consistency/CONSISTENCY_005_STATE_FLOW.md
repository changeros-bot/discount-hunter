# Consistency-005 State Flow Check

Date: 2026-06-26
Status: PASS WITH NOTES
Phase: Audit Consistency Check

## Purpose

Verify that all major V16 state flows are documented and that no untracked state source, circular dependency, or unverified production state assumption remains hidden before Fix Phase.

This check focuses on:

1. Ledger State
2. Wallet live data flow
3. Price data flow
4. Alert State
5. Wallet Snapshot State
6. Runtime Config / Env dependencies

## Scope

Repository source and audit documentation only.

This check does not verify live Vercel environment variables, real Upstash durability, real Telegram delivery, Cloudflare Cron deployment, or real wallet/RPC behavior.

## Method

Repository searches were performed for state and config flow keywords:

- `readStoreJson`
- `writeStoreJson`
- `hasKvConfig`
- `readLedger`
- `writeLedger`
- `readAlerts`
- `writeAlerts`
- `getJson`
- `setJson`
- `wallet-snapshot`
- `WALLET_ADDRESS`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Results were cross-checked against:

- `docs/audit/CRUD_MATRIX.md`
- `docs/audit/ISSUE_REGISTER.md`
- `docs/audit/AUDIT_INDEX.md`
- `docs/audit/AUDIT_021_FINAL_RISK_CLOSURE.md`
- `docs/audit/AUDIT_022_DEPLOYMENT_READINESS_GATE.md`

## State Flow Inventory

### 1. Ledger State

Canonical state:

- Store key: `discount-hunter:v16:buy-ledger`
- Local fallback file: `data/buy-ledger.json`
- Core helper module: `lib/v16-ledger.js`

Known readers:

- `readLedger()`
- `/api/buy-ledger`
- `/api/reconcile-tiers`
- `/api/reconcile-ledger`
- `/api/today-decisions`
- `v16-full` through `/api/buy-ledger`
- `v16-manual` through `/api/buy-ledger`

Known writers:

- `writeLedger()`
- `appendBuy()`
- `markLeftBuyZonesForAssets()`
- `/api/buy-ledger` POST
- `/api/manual-buy`
- `/api/reconcile-tiers`
- `/api/reconcile-ledger`
- `/api/today-decisions` conditional hidden-write path

Flow conclusion:

Ledger State is documented, but it still has known writer risks:

1. hidden write from `today-decisions`,
2. non-idempotent manual same-tier append,
3. legacy D1-only reconcile writer,
4. production durability depends on Upstash.

### 2. Wallet Live Data Flow

Canonical source:

- `/api/sync-wallet`

Supporting sources:

- RPC balance readers
- transfer / cost-basis sources
- configured wallet address from request, query, or `WALLET_ADDRESS`

Important distinction:

Wallet data is live/read-derived data, not a durable application state like Ledger.

Known consumers:

- `v16-full`
- `/api/telegram-alerts`
- `/api/telegram-daily`
- `/api/daily-summary`
- `/api/daily-position-report`
- `/api/wallet-alerts`
- `/api/wallet-change-alerts`
- `/reconcile`
- `/api/reconcile-tiers` through posted holdings

Flow conclusion:

Wallet flow is documented as a high-impact upstream dependency. It must be release-gated because failure can degrade dashboard, Telegram, reports, wallet alerts, and reconcile.

### 3. Price Data Flow

Canonical source:

- `/api/prices`

Known consumers:

- `v16-full`
- `v16-manual`
- `/api/today-decisions`
- `/api/telegram-alerts`
- `/api/telegram-daily`
- `/api/daily-summary`
- `BuyPointAlertPortal`
- `/reconcile`

Important distinction:

`/api/prices` provides both price data and initial signal calculation. This is already tracked as distributed decision/signal logic risk.

Flow conclusion:

Price flow is documented as a high-impact upstream dependency. It should be included in a stricter status/health gate before release.

### 4. Alert State

Canonical state:

- Store key: `discount-hunter:v16:telegram-alerts`
- Local fallback file: `data/alerts.json`
- Core helper module: `lib/v16-ledger.js`

Known readers/writers:

- `readAlerts()`
- `writeAlerts()`
- `canSendAlert()`
- `markAlertSent()`
- `/api/telegram-alert-check`

Known gap:

Main Telegram sending flows do not fully integrate Alert State cooldown/dedup. This is already tracked in the issue register.

Flow conclusion:

Alert State is documented, but the actual send flows can bypass it. Treat this as a release safety gate, especially if scheduled sends or Cloudflare Cron are active.

### 5. Wallet Snapshot State

Canonical state:

- Store key pattern: `discount-hunter:v16:wallet-snapshot:{walletKey}`
- Writer/reader: `/api/wallet-change-alerts`
- Store layer: Upstash KV through `getJson()` / `setJson()`

Fallback behavior:

Wallet Snapshot State is Upstash-only. If Upstash is missing, wallet-change alerts return disabled instead of using memory or file fallback.

Flow conclusion:

This design is explicit and safer than volatile fallback, but production monitoring requires Upstash runtime verification.

### 6. Runtime Config / Env Flow

Critical runtime inputs:

- `WALLET_ADDRESS`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- RPC / transfer source env vars such as BSC RPC, Moralis, MegaNode, and NodeReal options

Known gap:

Runtime config is documented, but there is no fully automated env validation or production health gate yet.

Flow conclusion:

Runtime config must remain a release blocker until checked by a stricter status/health endpoint or deployment checklist.

## Dependency / Cycle Check

No fatal circular state dependency was found in repository-level state flow documentation.

However, these high-impact chains remain risk-sensitive:

1. `/reconcile` depends on `/api/prices` and `/api/sync-wallet`, then posts to `/api/reconcile-tiers`.
2. Telegram alert/report flows depend on `/api/prices` and/or `/api/sync-wallet`, then send external Telegram messages.
3. `v16-full` reads prices, wallet, ledger, and decisions, and can trigger reconcile write-back.
4. `v16-manual` reads prices and ledger, then calls `today-decisions` in a way that can trigger hidden Ledger writes.

These are not new issues; they confirm the existing P0/P1/P2 fix queue.

## Result

PASS WITH NOTES.

The major V16 state flows are documented and no new state category was found.

Known unresolved state-flow risks remain:

1. Ledger production durability depends on Upstash.
2. Alert State exists but is not the single enforced gate for all Telegram sends.
3. Wallet Snapshot State is Upstash-only and requires production verification.
4. Price and wallet upstream failures are not fully gated before reconcile.
5. `v16-status` is not a complete production health gate.

## Impact on Fix Phase

No new Audit ID should be created.

Fix Phase should continue using the existing blockers:

1. P0 hidden write neutralization.
2. P0 legacy reconcile-ledger handling.
3. P1 manual-buy idempotency.
4. P1 production durable state requirement.
5. P1/P2 price/wallet/reconcile failure gating.
6. P1/P2 Telegram cooldown/dedup release gate.

## Next Consistency Check

Proceed to Consistency-006 Release Gates Check.
