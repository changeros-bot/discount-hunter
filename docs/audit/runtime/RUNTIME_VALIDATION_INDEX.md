# V16 Runtime Validation Index

Date: 2026-06-27
Status: STARTED - LIVE ACCESS PENDING

## Purpose

Runtime Validation verifies deployed behavior after source-level Regression fixes.

This phase must be completed before Cleanup and Release.

## Important Status

Source-level Regression is not enough for release.

The following remain required:

- Live deployed site validation.
- Real API response validation.
- Real Telegram behavior validation.
- Real Upstash cooldown persistence validation.
- Real Wallet sync validation.

## Access Note

The assistant could not directly open the live Vercel URLs from the current tool session due to URL access restrictions.

Therefore live runtime validation is not complete.

Do not mark V16 as release-ready until these checks are executed against the deployed site.

## Validation Modules

| ID | File | Status | Scope |
|---|---|---|---|
| RUNTIME-001 | `RUNTIME_001_CORE_API.md` | Pending | `/api/v16-status`, `/api/prices`, `/api/buy-ledger` |
| RUNTIME-002 | `RUNTIME_002_WALLET_RECONCILE.md` | Pending | `/api/sync-wallet`, `/api/reconcile-tiers` dry-run and write gate |
| RUNTIME-003 | `RUNTIME_003_MANUAL_BUY.md` | Pending | D1-D4 duplicate and N recurring write behavior |
| RUNTIME-004 | `RUNTIME_004_TELEGRAM.md` | Pending | GET preview-only, POST send, cooldown/dedup |
| RUNTIME-005 | `RUNTIME_005_DASHBOARD.md` | Pending | `/`, `/v16-full`, `/v16-manual` user-facing behavior |
| RUNTIME-006 | `RUNTIME_006_ENV_RELEASE_GATE.md` | Pending | Vercel env, Upstash, Telegram, wallet address, release blockers |

## Required Live Checks

### Core API

```text
GET /api/v16-status
GET /api/prices
GET /api/buy-ledger
```

Expected:

- HTTP 200 for healthy read endpoints.
- `v16-status.releaseBlocked` reflects real blockers.
- `prices.data` is non-empty.
- `buy-ledger` is read-only on GET.

### Wallet / Reconcile

```text
POST /api/sync-wallet
POST /api/reconcile-tiers { dryRun: true }
```

Expected:

- Wallet returns live holdings.
- Dry-run does not write Ledger.
- Empty assets/holdings are rejected.

### Manual Buy

Expected:

- First D1 write succeeds.
- Same D1 duplicate returns duplicate/unchanged.
- N tier can write repeatedly.

### Telegram

Expected:

- GET preview endpoints do not send Telegram.
- POST or explicit send flag is required for send.
- Cooldown works and persists.
- Missing Upstash blocks cooldown-gated sends in production.

### Dashboard

Expected:

- `/` loads V16 full dashboard.
- `/v16-full` shows prices, wallet, decisions, release gate warnings.
- `/v16-manual` shows executable decision entries as `筆`.
- Empty upstream data surfaces an error instead of pretending no buy point exists.

## Current Progress

```text
Architecture Audit       100%
Fix Phase                100%
Regression Source Review about 95%
Runtime Validation         0% started, live pending
Cleanup                    0%
Release                    0%
```

## Next Rule

If any runtime check fails:

```text
Runtime Validation failure
↓
Document issue
↓
Minimal fix
↓
Source verification
↓
Runtime re-test
```

Do not proceed to Cleanup until Runtime Validation is complete.
