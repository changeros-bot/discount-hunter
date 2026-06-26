# FIX-005 P1 Reconcile Upstream Gating

Date: 2026-06-27
Status: FIX APPLIED - SOURCE VERIFIED - PENDING FULL REGRESSION
Phase: Fix-and-Release Hardening

## Scope

Addresses price and wallet upstream failure gating before reconcile write-back.

## Problem

Before this change, `pages/reconcile.js` could continue to call `/api/reconcile-tiers` using fallback empty arrays when `/api/prices` or `/api/sync-wallet` failed or returned incomplete data.

Risk:

- Reconcile could proceed with incomplete inputs.
- The result could be misleading.
- Future write behavior could be unsafe if validation was bypassed.

## Files Changed

- `pages/reconcile.js`
- `pages/api/reconcile-tiers.js`

## Changes

### `pages/reconcile.js`

Added frontend gating:

- Checks HTTP status.
- Checks `ok === false` responses.
- Requires non-empty `prices.data`.
- Requires non-empty `wallet.holdings`.
- Stops before POSTing to `/api/reconcile-tiers` if upstream data is invalid.

### `pages/api/reconcile-tiers.js`

Added server-side validation:

- Rejects missing or invalid assets with `400 missing_or_invalid_assets`.
- Rejects missing or invalid holdings with `400 missing_or_invalid_holdings`.

## Commits

- `ad2f0ee6e9b7a573472583cdaf8b3e771e04244a`
- `d9c40d4c1b7bbefce15880b3d79c367d04a80d45`

## Source Verification

Confirmed:

- `pages/reconcile.js` no longer posts `prices.data || []` or `wallet.holdings || []` blindly.
- `pages/reconcile.js` throws before reconcile when price or wallet upstream fails.
- `/api/reconcile-tiers` rejects empty or invalid assets.
- `/api/reconcile-tiers` rejects empty or invalid holdings.

## Regression Required

Still required:

- Price API success + wallet success + reconcile success.
- Price API failure blocks reconcile.
- Wallet sync failure blocks reconcile.
- Empty price data blocks reconcile.
- Empty wallet holdings blocks reconcile.
- Direct POST to `/api/reconcile-tiers` with empty assets returns 400.
- Direct POST to `/api/reconcile-tiers` with empty holdings returns 400.

## Result

Reconcile upstream failure risk is source-level neutralized.

Runtime and regression validation remain required before release.
