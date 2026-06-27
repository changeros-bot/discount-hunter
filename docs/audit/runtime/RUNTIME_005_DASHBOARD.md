# RUNTIME-005 Dashboard Validation

Date: 2026-06-27
Status: PENDING - USER SCREENSHOT REQUIRED

## Scope

Validate deployed user-facing pages:

```text
/
/v16-full
/v16-manual
```

## Live Site

```text
https://discount-hunter-sigma.vercel.app/
```

## Current Evidence

User provided screenshots for API JSON endpoints:

- `/api/prices`
- `/api/sync-wallet`
- `/api/buy-ledger`
- `/api/v16-status`
- reconcile dry-run evidence from status output

No user-facing dashboard screenshots have been provided yet for this runtime module.

Therefore this module is not complete.

## Required Checks

### `/`

Expected:

- Loads V16 full dashboard.
- Does not show V15 or legacy page.
- Does not redirect to debug or snapshot tools.

### `/v16-full`

Expected:

- Shows current prices.
- Shows LIVE/update time.
- Shows wallet section.
- Shows wallet error if wallet fails.
- Shows today decisions from `/api/today-decisions`.
- Shows release gate warning when `/api/v16-status.releaseBlocked` is true or related runtime blockers exist.
- Reconcile button is disabled when assets or wallet holdings are missing.
- Reconcile does not run with empty assets or empty wallet.

### `/v16-manual`

Expected:

- Loads manual decision page.
- Uses `筆` as decision count unit.
- Shows release gate warning if blocked.
- Empty price data surfaces `prices_data_empty` instead of showing false no-buy status.
- Manual buy button writes only when durable state is available.
- Duplicate response displays `已存在，未重複登帳`.

## Current Runtime Constraint

Live `/api/v16-status` currently shows:

```text
releaseBlocked: true
storage: missing_required_upstash_kv
```

Therefore dashboard should not be considered release-ready even if it visually loads.

## Evidence Needed

User should provide screenshots of:

1. `https://discount-hunter-sigma.vercel.app/`
2. `https://discount-hunter-sigma.vercel.app/v16-full`
3. `https://discount-hunter-sigma.vercel.app/v16-manual`

Screenshots should include:

- Top of page.
- Decision summary area.
- Wallet area.
- Any visible warning/error area.

## Result

Pending.

Do not proceed to Cleanup until dashboard runtime screenshots are reviewed.
