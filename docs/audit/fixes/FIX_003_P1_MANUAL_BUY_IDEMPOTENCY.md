# FIX-003 P1 Manual Buy Idempotency

Date: 2026-06-26
Status: FIX APPLIED - SOURCE VERIFIED - PENDING FULL REGRESSION
Phase: Fix-and-Release Hardening

## Scope

This fix addresses:

- `P1-020`: manual-buy / appendBuy does not prevent duplicate same-tier Ledger entries

## Problem

Before this fix, `appendBuy()` performed validation and then directly pushed a new row into Ledger.

Risk:

- Repeated UI clicks could create duplicate rows for the same symbol + tier.
- Repeated Telegram/manual commands could create duplicate rows.
- Duplicate Ledger rows could distort completed tier state, progress, and later reconcile behavior.

## Fix Applied

### 1. Core Ledger writer idempotency

File:

- `lib/v16-ledger.js`

Change:

- `appendBuy()` now checks D1-D4 tiers before writing.
- If the tier already exists and cannot be reopened through the existing `canReopenTier()` rule, it returns a duplicate result and does not call `writeLedger()`.
- `N` tier remains appendable because it represents recurring/manual DCA and should allow multiple entries.
- Reopen behavior remains aligned with existing Ledger rule: a dip tier can reopen only after it has left the buy zone and more than 24 hours have passed.

Duplicate result shape:

```json
{
  "duplicate": true,
  "duplicateReason": "same_tier_already_recorded",
  "storage": "unchanged"
}
```

### 2. Manual buy response text

File:

- `pages/api/manual-buy.js`

Change:

- If `appendBuy()` returns duplicate, the reply text says the record already exists and was not written again.
- Normal successful write behavior remains unchanged.

### 3. buy-ledger POST response

File:

- `pages/api/buy-ledger.js`

Change:

- API now surfaces `duplicate`, `duplicateReason`, and `storage`.
- Message becomes `buy_record_duplicate_skipped` when no new Ledger row is written.

## Commits

- `accf418d49fb0dbb0fff5dae0b05129b97084054` - `fix(ledger): prevent duplicate dip-tier append`
- `43bdefa34f014237dc0320beb68c60647f01defe` - `fix(manual-buy): report duplicate tier without new ledger write`
- `f2cf2916611147131405824e65d39f440fb30c6d` - `fix(buy-ledger): surface duplicate append result`

## Source Verification

Verified after fix:

- `appendBuy()` checks `DIP_TIERS.includes(normalizedTier)`.
- Duplicate D1-D4 rows return `storage: "unchanged"`.
- Duplicate D1-D4 rows return `duplicate: true`.
- Duplicate D1-D4 rows do not call `writeLedger()`.
- `N` tier is not blocked by this duplicate check.
- `manual-buy` response text no longer says "已登帳" for duplicate rows.
- `buy-ledger` POST response surfaces duplicate status.

## Regression Still Required

Full regression should verify:

- First `/api/manual-buy` D1 write succeeds.
- Second `/api/manual-buy` same symbol + D1 returns duplicate and does not add a row.
- First `/api/buy-ledger` POST D1 write succeeds.
- Second `/api/buy-ledger` POST same symbol + D1 returns duplicate and does not add a row.
- `/dca` / `N` tier can still be recorded multiple times.
- Reopened D1-D4 behavior still works when `leftBuyZone === true` and `leftBuyZoneAt` is older than 24 hours.
- v16-manual button behavior handles duplicate response safely.

## Risk / Note

This is intentionally implemented in `appendBuy()` rather than only in `manual-buy`, because `appendBuy()` is the shared formal writer used by multiple entry points.

This fix does not change investment strategy, tier rules, or UI layout.

## Result

P1 duplicate same-tier append risk is source-level neutralized.

Final status remains pending until Regression Audit confirms API and UI behavior.
