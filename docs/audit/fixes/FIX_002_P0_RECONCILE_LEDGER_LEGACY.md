# FIX-002 P0 Legacy Reconcile Ledger Disable

Date: 2026-06-26
Status: FIX APPLIED - SOURCE VERIFIED - PENDING FULL REGRESSION
Phase: Fix-and-Release Hardening

## Scope

This fix addresses:

- `P0-002`: `reconcile-ledger` legacy D1-only API still exists

## Problem

Before this fix, `pages/api/reconcile-ledger.js` was a legacy wallet reconcile endpoint that only backfilled D1.

Risk:

- If called accidentally, it could write incomplete Ledger data.
- It did not support D2/D3/D4 or gap-down multi-tier backfill.
- The supported V16 reconcile path is `/api/reconcile-tiers`.

## Fix Applied

File:

- `pages/api/reconcile-ledger.js`

Change:

- Removed legacy Ledger writer behavior from the endpoint.
- Endpoint still exists for compatibility / discoverability.
- POST now returns HTTP `410` with `legacy_endpoint_disabled`.
- Response points callers to `/api/reconcile-tiers`.
- Response explicitly states `writesLedger: false`.

## Commit

- `3b53e118066a50ea512dbbd092f5282b1511da95` - `fix(reconcile-ledger): disable legacy D1 writer`

## Source Verification

Verified after fix:

- `pages/api/reconcile-ledger.js` no longer imports `readLedger`, `writeLedger`, `normalizeSymbol`, or `getTriggeredDipTiers`.
- It does not call `writeLedger()`.
- It does not read or mutate Ledger.
- It returns `410 legacy_endpoint_disabled` for POST.
- It returns `405 method_not_allowed` for non-POST methods.

## Regression Still Required

Full regression should verify:

- `/api/reconcile-ledger` returns 410 on POST.
- Existing supported reconcile flow uses `/api/reconcile-tiers`.
- Dashboard / reconcile page does not depend on `/api/reconcile-ledger`.
- No production task or external caller still points to `/api/reconcile-ledger`.

## Risk / Note

This is a conservative safety fix.

The file is not deleted yet because Repository Cleanup must happen after Fix Phase and Regression Audit. Keeping the endpoint with an explicit 410 response is safer than silent deletion because callers receive a clear migration signal.

## Result

P0 legacy D1-only writer is source-level neutralized.

Final status remains pending until Regression Audit confirms no active flow depends on it.
