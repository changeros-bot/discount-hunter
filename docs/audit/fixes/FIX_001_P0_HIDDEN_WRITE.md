# FIX-001 P0 Hidden Write Neutralization

Date: 2026-06-26
Status: FIX APPLIED - SOURCE VERIFIED - PENDING FULL REGRESSION
Phase: Fix-and-Release Hardening

## Scope

This fix addresses:

- `P0-001`: `today-decisions` Hidden Write
- `P0-003`: `v16-manual` calls `today-decisions` without Ledger payload

## Problem

Before this fix, `pages/api/today-decisions.js` imported and called `markLeftBuyZonesForAssets()` when POST body did not include an explicit Ledger payload.

That helper can call `writeLedger()` when `leftBuyZone` changes.

Result:

A read-style decision API could mutate Ledger state.

## Fix Applied

### 1. `/api/today-decisions` made read-only

File:

- `pages/api/today-decisions.js`

Change:

- Removed dependency on `markLeftBuyZonesForAssets()`.
- Imported `readLedger()` instead.
- When no posted Ledger exists, the endpoint now reads Ledger only and marks the source as `store-ledger-readonly`.
- Response always returns `ledgerUpdatedForLeftBuyZone: false`.

This neutralizes the hidden write path inside the decision API.

### 2. `v16-manual` now passes explicit Ledger payload

File:

- `pages/v16-manual.js`

Change:

- Loads `/api/buy-ledger` before calling `/api/today-decisions`.
- Posts `{ assets, ledger }` to `/api/today-decisions`.

This matches the safer pattern used by `v16-full` and prevents the manual decision page from relying on store-ledger mutation behavior.

## Commits

- `a3b4d6cafe46a83b3ccfe03374c2112b00e7505e` - `fix(today-decisions): make decision API read-only`
- `1d3b6981690539a209ecdaa2513be0635c9bf1b2` - `fix(v16-manual): pass ledger to today decisions`

## Source Verification

Verified after fix:

- `pages/api/today-decisions.js` imports `readLedger`, `getExecutableTiers`, and `normalizeLedger`.
- It no longer imports `markLeftBuyZonesForAssets`.
- No `writeLedger()` path remains in `today-decisions`.
- Fallback source is now `store-ledger-readonly`.
- `v16-manual` posts Ledger explicitly to `/api/today-decisions`.

## Regression Still Required

Full runtime regression is still required for:

- `/api/today-decisions` POST with posted Ledger.
- `/api/today-decisions` POST without posted Ledger.
- `v16-manual` load path.
- `v16-full` load path.
- Manual buy flow after decision load.
- Ledger left-buy-zone/reopen behavior after this change.

## Risk / Note

This fix intentionally stops `today-decisions` from updating `leftBuyZone` as a side effect.

That is the correct safety tradeoff for P0: decision/read surfaces must not mutate Ledger.

If left-buy-zone marking is still required, it should be moved to an explicit mutation endpoint or controlled reconciliation flow in a later fix, not hidden inside the decision endpoint.

## Result

P0 hidden write is source-level neutralized.

Final status remains pending until Regression Audit confirms no breakage in Ledger, Decision, Manual, and Dashboard flows.
