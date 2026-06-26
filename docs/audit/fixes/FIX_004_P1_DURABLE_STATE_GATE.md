# FIX-004 P1 Durable State Gate

Date: 2026-06-27
Status: FIX APPLIED - SOURCE VERIFIED - PENDING RUNTIME VALIDATION
Phase: Fix-and-Release Hardening

## Scope

Addresses P1 production durable state risk for Ledger and Alert State.

## Problem

Before this change, production or Vercel runtime without Upstash could still use volatile memory fallback for state writes.

That made Ledger and Alert State non-durable across cold starts or redeployments.

## Files Changed

- `lib/state/kv.js`
- `lib/v16-ledger.js`
- `pages/api/v16-status.js`

## Changes

### `lib/state/kv.js`

Added:

- `requiresDurableKv()`
- `getStorageMode()`

Storage mode now reports:

- `upstash_kv`
- `missing_required_upstash_kv`
- `file_or_memory_fallback`

### `lib/v16-ledger.js`

`writeStoreJson()` now throws `missing_required_upstash_kv` when running in production or Vercel without Upstash config.

Local non-production fallback remains available.

### `pages/api/v16-status.js`

Status now reports:

- `storage`
- `durableStateOk`
- `requiresDurableKv`
- `hasKvConfig`
- `releaseBlocked`
- `releaseBlocker`

## Commits

- `d5d11dce56b6f411bd96bd6e5c0f179cfe930d72`
- `b2b26747ace4033d80b1130e174f2b9da487ea08`
- `f00e346b58c37543ca2a96156b19c0b6166f2088`

## Source Verification

Confirmed:

- `requiresDurableKv()` exists.
- `getStorageMode()` exists.
- Production / Vercel without Upstash maps to `missing_required_upstash_kv`.
- Ledger / Alert writes no longer fall through to memory fallback when durable KV is required.
- `v16-status` exposes release blocker fields.

## Regression Required

Still required:

- Local write test.
- Production without Upstash write rejection.
- Production with Upstash write success.
- Alert State write check.
- `/api/v16-status` runtime check.

## Result

P1 durable-state risk is source-level neutralized.

Runtime validation is still required before release.
