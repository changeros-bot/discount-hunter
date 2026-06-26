# FIX-006 P1 V16 Health Gate Expansion

Date: 2026-06-27
Status: FIX APPLIED - SOURCE VERIFIED - PENDING RUNTIME VALIDATION
Phase: Fix-and-Release Hardening

## Scope

Addresses v16-status health gate coverage gap.

## Problem

Before this change, `/api/v16-status` was a partial smoke test. It did not directly verify critical release paths:

- `/api/prices`
- `/api/sync-wallet`
- `/api/reconcile-tiers`

It also could not safely call reconcile because reconcile previously had no dry-run mode.

## Files Changed

- `pages/api/reconcile-tiers.js`
- `pages/api/v16-status.js`

## Changes

### `pages/api/reconcile-tiers.js`

Added dry-run support:

- Accepts `dryRun: true` in request body.
- Accepts `?dryRun=true` query string.
- Uses a cloned working Ledger for calculation.
- Does not call `writeLedger()` in dry-run mode.
- Returns `storage: dry_run_no_write`.

### `pages/api/v16-status.js`

Expanded health gate:

Critical checks now include:

- durable state gate
- prices check
- sync-wallet check
- reconcile-tiers dry-run check

Passive checks remain:

- buy-ledger
- telegram-alert-check
- wallet-change-alerts
- daily-position-report

Manual checks remain manual to avoid write/spam side effects:

- manual-buy
- today-decisions
- telegram transport test

## Commits

- `2376d9592370e0013a5b9232a37fd2a1866a8c62`
- `a8e3cb8ee0c04138c0f5db725d76d3800f5f75cd`

## Source Verification

Confirmed:

- `reconcile-tiers` supports dry-run.
- dry-run returns original Ledger and does not write.
- `v16-status` calls `/api/prices`.
- `v16-status` calls `/api/sync-wallet` by POST.
- `v16-status` calls `/api/reconcile-tiers` with `dryRun: true` only after price and wallet checks pass.
- `v16-status` sets `ok: false` when any critical check fails.
- `v16-status` returns `releaseBlockers` for failed critical checks.

## Regression Required

Still required:

- Runtime `/api/v16-status` with working prices/wallet.
- Runtime `/api/v16-status` with missing wallet config.
- Runtime `/api/v16-status` with missing Upstash in production.
- Confirm reconcile dry-run does not mutate Ledger.
- Confirm manual checks remain manual.

## Result

V16 health gate coverage is source-level expanded.

Runtime validation is still required before release.
