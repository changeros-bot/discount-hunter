# DCA 折價獵人 V16 Issue Register

Last updated: 2026-06-25

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
- Evidence: Audit-009
- Summary: `today-decisions` uses `getExecutableTiers()` with reopen logic; `reconcile-tiers` uses `getTriggeredDipTiers()` only.
- Risk: Backfill and actionable decision may not match exactly.

### P1-009: Progress Engine is not unified
- Status: Verified
- Evidence: Audit-010
- Summary: Progress/next-action logic exists in at least four places: `v16-full`, `telegram-alerts`, `lib/discount/progress.js`, and `lib/v16-ledger.js`.
- Risk: UI, Telegram, and manual decision page may show different progress meanings.

### P1-010: telegram-alerts uses Wallet totalCost rather than Ledger
- Status: Verified
- Evidence: Audit-010
- Summary: Telegram calculates `completedLevel` from Wallet holdings cost, not Ledger completed tiers.
- Risk: Telegram may disagree with manual Ledger state.

### P1-011: v16-manual progress differs from Telegram progress
- Status: Verified
- Evidence: Audit-010
- Summary: v16-manual displays triggered progress as 100%, while Telegram computes next action progress.
- Risk: Same symbol may appear differently across surfaces.

### P1-012: v16-full ProgressBar does not use Ledger completed state
- Status: Verified
- Evidence: Audit-010
- Summary: `progressFor(asset)` uses only discount/rules/amounts. Ledger is only displayed as text.
- Risk: Progress bar may show a tier already completed in Ledger.

## P2

### P2-004: Debug APIs bypass sync-wallet and read Wallet pipeline directly
- Status: Verified
- Evidence: Audit-002
- Summary: Debug APIs read transfers/RPC/cost pipeline directly but do not write Ledger, Wallet, or formal state.
- Risk: Documentation issue, not a data pollution issue.

### P2-005: buy-ledger combines GET read and POST append
- Status: Verified
- Evidence: Audit-004
- Summary: `buy-ledger` handles both reading Ledger and appending manual buy records through POST.
- Risk: Acceptable but should be documented clearly.
