# V16 Audit Issue Register

## P0

### P0-001: today-decisions Hidden Write
- Status: Verified
- Evidence: `pages/api/today-decisions.js` calls `markLeftBuyZonesForAssets()` when no posted ledger is provided.
- Impact: A query-like API may mutate Ledger state by marking `leftBuyZone`.
- Action: Do not refactor yet. Revisit in Architecture Review.

### P0-002: reconcile-ledger Legacy D1-only API still exists
- Status: Verified
- Evidence: `pages/api/reconcile-ledger.js` only backfills D1.
- Impact: If used accidentally, D2/D3/D4 or gap-down backfills may be incomplete.
- Action: Consider deprecating, disabling, or redirecting to `reconcile-tiers`.

## P1

### P1-006: /api/prices includes initial signal logic
- Status: Verified
- Evidence: `pages/api/prices.js` calculates discount and signal fields.
- Impact: Price source is not a pure price API; decision logic is partly distributed.

### P1-007: reconcile-tiers directly writes Ledger
- Status: Verified
- Evidence: `pages/api/reconcile-tiers.js` pushes rows and calls `writeLedger()` directly.
- Impact: Acceptable for reconciliation, but must be documented as a legal write entry.

### P1-008: Decision and Reconcile use different rule layers
- Status: Verified
- Evidence: `today-decisions` uses `getExecutableTiers()`, while `reconcile-tiers` uses `getTriggeredDipTiers()`.
- Impact: Decision considers reopen rules; reconcile only considers triggered tiers.

### P1-009: Progress Engine is not unified
- Status: Verified
- Evidence: Progress logic exists in `v16-full`, `telegram-alerts`, `lib/discount/progress.js`, and `lib/v16-ledger.js`.
- Impact: Different surfaces can display different progress meanings.

### P1-010: telegram-alerts uses Wallet totalCost to infer completedLevel
- Status: Verified
- Impact: Telegram completed level may diverge from Ledger completed tiers.

### P1-011: v16-manual progress differs from Telegram progress
- Status: Verified
- Impact: UI can show triggered 100%, while Telegram may show next-action progress.

### P1-012: v16-full ProgressBar does not use Ledger completed state
- Status: Verified
- Impact: Homepage card progress may not reflect Ledger-completed tiers.

## P2

### P2-004: Debug APIs bypass sync-wallet and read wallet pipeline directly
- Status: Verified
- Impact: Non-polluting, but must be documented as debug-only.

### P2-005: buy-ledger handles both GET and POST
- Status: Verified
- Impact: Acceptable, but documentation should state GET is read and POST is append via `appendBuy()`.
