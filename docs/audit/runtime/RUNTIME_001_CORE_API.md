# RUNTIME-001 Core API Validation

Date: 2026-06-27
Status: PARTIAL PASS - RELEASE BLOCKED BY ENV

## Live Site

```text
https://discount-hunter-sigma.vercel.app/
```

## Evidence Source

User-provided mobile browser screenshots at 2026-06-27 11:16-11:17 Taiwan time.

## Validated Endpoints

### `/api/prices`

Observed:

- JSON response loads in browser.
- `count: 9`.
- 9 watched xStocks assets returned.
- `source: Binance xStocks public API`.
- No `prices_data_empty` issue observed.

Result: PASS.

### `/api/sync-wallet`

Observed:

- JSON response loads in browser.
- Live wallet holdings are present.
- Visible holdings include NVDA, TSM, QQQ, GOOGL, SPCX, RKLB, AVGO, AMD, MRVL related entries.
- Live balance / cost basis fields are populated.

Result: PASS, detailed numerical validation still pending.

### `/api/buy-ledger`

Observed:

- JSON response loads in browser.
- `ok: true`.
- Ledger contains expected symbols.
- Each symbol has `N`, `D1`, `D2`, `D3`, `D4` arrays.
- GET behavior is read-only.

Result: PASS.

### `/api/reconcile-tiers` dry-run evidence

Observed from status output:

- `dryRun: true`.
- `storage: dry_run_no_write`.
- `addedCount: 0` in the visible response.

Result: PASS for dry-run no-write gate.

### `/api/v16-status`

Observed:

```json
{
  "ok": false,
  "version": "16.4-explicit-empty-data-health-gate",
  "storage": "missing_required_upstash_kv",
  "durableStateOk": false,
  "requiresDurableKv": true,
  "hasKvConfig": false,
  "releaseBlocked": true
}
```

Visible release blocker:

```text
durableState: missing_required_upstash_kv
```

Result: PASS for release gate behavior.

Important: This is not a source bug. It confirms the production runtime gate is correctly blocking release because Upstash KV is not configured.

## Current Runtime Result

```text
Core API                 PASS
Prices                   PASS
Wallet Sync              PASS
Buy Ledger GET           PASS
Reconcile Dry Run        PASS
Release Gate             PASS, currently blocking release
Production Release       BLOCKED
```

## Release Blocker

```text
missing_required_upstash_kv
```

V16 must not be marked release-ready until durable production state is configured or the release policy is explicitly changed.

## Next Runtime Module

Proceed to:

```text
RUNTIME_003_MANUAL_BUY.md
```

Manual Buy validation must confirm:

1. First D1 write succeeds.
2. Same D1 duplicate returns unchanged.
3. N tier can be written repeatedly.
4. v16-manual refresh reflects Ledger changes.
