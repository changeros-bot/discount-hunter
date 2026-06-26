# DCA 折價獵人 V16 Issue Register

Last updated: 2026-06-26

## P0

### P0-001: today-decisions Hidden Write
- Status: Verified
- Evidence: Audit-008 / Audit-009
- Summary: `pages/api/today-decisions.js` calls `markLeftBuyZonesForAssets()` when POST body does not include a ledger. That path can call `writeLedger()` if `leftBuyZone` changes.
- Risk: Query-style API may mutate Ledger state.
- Current decision: Do not modify yet. Keep for Architecture Review.

### P0-002: reconcile-ledger Legacy D1-only API still exists
- Status: Verified
- Evidence: Audit-007
- Summary: `pages/api/reconcile-ledger.js` only backfills D1 and cannot handle D2/D3/D4 or gap-down multi-tier backfill.
- Risk: If used accidentally, Ledger backfill may be incomplete.
- Current decision: Later decide whether to deprecate, disable, or redirect to `reconcile-tiers`.

### P0-003: v16-manual calls today-decisions without Ledger payload
- Status: Verified
- Evidence: Audit-014
- Summary: `pages/v16-manual.js` posts only `{ assets }` to `/api/today-decisions`. Because no explicit Ledger is provided, `today-decisions` uses the store-ledger path and can call `markLeftBuyZonesForAssets()`, which may write Ledger state.
- Risk: A read/decision page can mutate Ledger state unexpectedly.
- Current decision: Fix candidate is to make `v16-manual` fetch `/api/buy-ledger` first and pass `ledger` into `/api/today-decisions`, matching `v16-full`.

## P1

### P1-006: /api/prices mixes price source and initial signal
- Status: Verified
- Evidence: Audit-003
- Summary: `/api/prices` fetches Binance xStocks prices and also computes `discount` and `signal`.
- Risk: Decision logic is partially distributed.

### P1-007: reconcile-tiers writes Ledger directly
- Status: Verified
- Evidence: Audit-006
- Summary: `reconcile-tiers` pushes rows directly into Ledger and calls `writeLedger()` rather than using `appendBuy()`.
- Risk: Acceptable as backfill-specific writer, but must be documented.

### P1-008: Decision and Reconcile use different rule layers
- Status: Verified
- Evidence: Audit-009 / Audit-013
- Summary: `today-decisions` uses `getExecutableTiers()` with reopen logic; `reconcile-tiers` uses `getTriggeredDipTiers()` only.
- Risk: Backfill and actionable decision may not match exactly.

### P1-009: Progress Engine is not unified
- Status: Verified
- Evidence: Audit-010
- Summary: Progress/next-action logic exists in at least four places: `v16-full`, `telegram-alerts`, `lib/discount/progress.js`, and `lib/v16-ledger.js`.
- Risk: UI, Telegram, and manual decision page may show different progress meanings.

### P1-010: telegram-alerts uses Wallet totalCost rather than Ledger
- Status: Verified
- Evidence: Audit-010 / Audit-011
- Summary: Telegram calculates `completedLevel` from Wallet holdings cost, not Ledger completed tiers.
- Risk: Telegram may disagree with manual Ledger state.

### P1-011: v16-manual progress differs from Telegram progress
- Status: Verified
- Evidence: Audit-010 / Audit-014
- Summary: v16-manual displays triggered progress as 100%, while Telegram computes next action progress.
- Risk: Same symbol may appear differently across surfaces.

### P1-012: v16-full ProgressBar does not use Ledger completed state
- Status: Verified
- Evidence: Audit-010 / Audit-013
- Summary: `progressFor(asset)` uses only discount/rules/amounts. Ledger is only displayed as text.
- Risk: Progress bar may show a tier already completed in Ledger.

### P1-013: Telegram has multiple buy-point/progress rule implementations
- Status: Verified
- Evidence: Audit-011
- Summary: `telegram-alerts`, `telegram-daily`, and `daily-summary` each calculate buy-point/progress rows separately.
- Risk: Telegram surfaces may disagree with each other and with UI/Decision Engine.

### P1-014: daily-summary and telegram-daily are highly duplicated
- Status: Verified
- Evidence: Audit-011 / Audit-018
- Summary: Both read `/api/sync-wallet` and `/api/prices`, build a daily Telegram message, and calculate near-buy rows independently.
- Risk: Duplicate maintenance and inconsistent behavior.

### P1-015: wallet-change-alerts writes KV snapshot state
- Status: Verified
- Evidence: Audit-011 / Audit-016
- Summary: `wallet-change-alerts` writes `discount-hunter:v16:wallet-snapshot:{walletKey}` through Upstash KV.
- Risk: Reasonable design, but must be included in State Store Inventory.

### P1-016: Cloudflare Cron Worker code still exists
- Status: Verified in repo; runtime pending
- Evidence: Audit-011
- Summary: `cloudflare/discount-hunter-cron-worker.js` still exists and calls `/api/telegram-alerts` by default.
- Risk: If still deployed with Cron enabled, it may repeatedly trigger Telegram alerts.
- Needs Runtime Verification: Cloudflare deployment and Cron Trigger status.

### P1-017: telegram-alerts has no cooldown/dedup and sends on every call
- Status: Verified
- Evidence: Audit-011 / Audit-012
- Summary: `telegram-alerts` always calls `sendTelegramMessage()`, including the no-alert message path.
- Risk: If scheduled frequently, Telegram can receive repeated messages.

### P1-018: Alert State Engine and Telegram sending flows are not integrated
- Status: Verified
- Evidence: Audit-012
- Summary: Alert State Core (`readAlerts`, `writeAlerts`, `canSendAlert`, `markAlertSent`) exists, but only `/api/telegram-alert-check` uses it. Main sending flows such as `/api/telegram-alerts` do not call it.
- Risk: Dedup/cooldown logic exists but is bypassed by actual Telegram sending APIs.

### P1-019: v16-full Buy Zone uses price signal, not Ledger actionable state
- Status: Verified
- Evidence: Audit-013
- Summary: `v16-full` groups buy-zone rows by `/api/prices` `asset.signal.level`, which is based only on price discount/rules/amounts and does not consider Ledger completed tiers.
- Risk: Buy-zone section can include assets whose current tier is already recorded in Ledger; user must rely on decision panel and Ledger text to know whether it is truly actionable.

### P1-020: manual-buy / appendBuy does not prevent duplicate same-tier Ledger entries
- Status: Verified
- Evidence: Audit-014
- Summary: `/api/manual-buy` calls `appendBuy()`, which validates symbol, tier, and amount but then pushes a new row into Ledger without checking whether that symbol+tier has already been recorded.
- Risk: Repeated UI clicks or repeated Telegram/manual commands can create duplicate entries for the same symbol+tier.

### P1-021: Production without Upstash KV falls back to volatile memory store
- Status: Verified
- Evidence: Audit-016
- Summary: Ledger State and Alert State use `readStoreJson()` / `writeStoreJson()`. If Upstash is not configured, production/Vercel skips local file fallback and stores state only in `globalThis.__V16_MEMORY_STORE__`.
- Risk: Ledger and Alert State can be lost after serverless cold start, process restart, or deployment if `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are missing.

## P2

### P2-004: Debug APIs bypass sync-wallet and read Wallet pipeline directly
- Status: Verified
- Evidence: Audit-002 / Audit-018
- Summary: Debug APIs read transfers/RPC/cost pipeline directly but do not write Ledger, Wallet, or formal state.
- Risk: Documentation issue, not a data pollution issue.

### P2-005: buy-ledger combines GET read and POST append
- Status: Verified
- Evidence: Audit-004
- Summary: `buy-ledger` handles both reading Ledger and appending manual buy records through POST.
- Risk: Acceptable but should be documented clearly.

### P2-006: Alert State Engine lacks reset/delete/expire API
- Status: Verified
- Evidence: Audit-012
- Summary: Current Alert State Engine supports read, cooldown check, and mark sent. No reset key, delete key, or expiration cleanup API was found.
- Risk: Old alert keys can remain indefinitely unless manually cleared from store.

### P2-007: v16-full loadAll refresh every 5s may be aggressive
- Status: Verified
- Evidence: Audit-013
- Summary: `v16-full` calls `loadAll()` every 5 seconds, which reads `/api/prices`, `/api/buy-ledger`, and `/api/today-decisions`.
- Risk: This is not a Ledger pollution risk, but may increase Binance public API, Vercel, and KV read pressure.

### P2-008: v16-status checklist may overstate verified safety
- Status: Verified
- Evidence: Audit-014 / Audit-015
- Summary: `/api/v16-status` returns checklist booleans such as `sameTier24hReset`, `telegramCooldown`, and `frontEndIntegrated`, but these are static status claims rather than proof of full safety integration.
- Risk: Status endpoint may imply protection that is incomplete or not wired into the actual production flow.

### P2-009: v16-status runtime checks do not cover critical APIs
- Status: Verified
- Evidence: Audit-015
- Summary: `/api/v16-status` runtime checks cover only a limited set of endpoints and mark manual-write APIs as `manual_test_required`. It does not check critical APIs such as `/api/sync-wallet`, `/api/prices`, `/api/reconcile-tiers`, or `/api/telegram-alerts`.
- Risk: `v16-status` may report ok while price, wallet sync, reconcile, or Telegram main alert flows are broken.

### P2-010: wallet-change-alerts disabled without Upstash KV
- Status: Verified
- Evidence: Audit-016
- Summary: `/api/wallet-change-alerts` checks `hasKvConfig()` at startup. If Upstash KV is missing, it returns `enabled:false` with `reason: missing_upstash_env` and does not create a snapshot, diff holdings, or send Telegram.
- Risk: Wallet change monitoring will not work without Upstash. This is explicit and safe, but should be visible in deployment checklist.

### P2-011: No automated deployment environment validation
- Status: Verified
- Evidence: Audit-017
- Summary: `package.json` only defines `dev`, `build`, and `start`. No lint/test/typecheck/env-check/predeploy script or health gate was found.
- Risk: Missing Wallet, Telegram, Upstash, or RPC-related env vars may only be discovered at runtime.

### P2-012: Runtime env docs do not list all supported env vars
- Status: Verified
- Evidence: Audit-017
- Summary: README/CONFIG list the main env vars, but runtime code also supports `MORALIS_API_KEY`, `MORALIS_KEY`, `MORALIS_LIMIT`, `MORALIS_MAX_PAGES`, `MEGANODE_API_KEY`, `NODEREAL_API_KEY`, `MEGANODE_ENDPOINT`, `NODEREAL_ENDPOINT`, and `NEXT_PUBLIC_BSC_RPC_URL`.
- Risk: Deployment handoff may miss optional but important data-source configuration and fallback behavior.

### P2-013: Repository cleanup backlog should be handled after architecture audit
- Status: Verified
- Evidence: Audit-018
- Summary: Repo contains many debug endpoints, legacy utilities, duplicate daily Telegram endpoints, and historical docs. They are cleanup candidates, but should not be deleted before the full audit and reference check are complete.
- Risk: Premature deletion could remove useful diagnostics or historical context. Recommended action is a post-audit cleanup phase with explicit archive/delete commits.
