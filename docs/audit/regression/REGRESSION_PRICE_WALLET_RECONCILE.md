# V16 Regression - Price / Wallet / Reconcile Flow

Date: 2026-06-27
Status: SOURCE REVIEW COMPLETE

## Scope

Reviewed the data path:

```text
/api/prices
↓
/api/sync-wallet
↓
/api/reconcile-tiers
↓
/api/v16-status health gate
↓
v16-full / v16-manual
```

## Checks

| Item | Result |
|---|---|
| `/api/prices` returns data array | PASS, runtime pending |
| `/api/sync-wallet` returns `ok:true` and holdings array | PASS, runtime pending |
| `/api/reconcile-tiers` rejects empty assets | PASS |
| `/api/reconcile-tiers` rejects empty holdings | PASS |
| `/api/reconcile-tiers` dry-run does not write Ledger | PASS |
| `/api/reconcile-tiers` formal write only occurs when added rows exist and dryRun is false | PASS |
| `v16-full` blocks reconcile when assets/wallet are missing | PASS |
| `v16-manual` rejects empty price data | PASS |
| `v16-status` flags empty prices directly | PASS |
| `v16-status` flags empty wallet holdings directly | PASS |

## Fix Applied In This Segment

File changed:

- `pages/api/v16-status.js`

Change:

- Empty price data now produces direct release blocker reason: `prices_data_empty`.
- Empty wallet holdings now produces direct release blocker reason: `wallet_holdings_empty`.
- Reconcile dry-run remains blocked when prices or wallet are not OK.

Commit:

- `9eab3e38b89aac9dd953588714487c22d4573dc5`

## Prior Related Fixes

- `pages/reconcile.js` gates upstream price/wallet data before reconcile.
- `pages/api/reconcile-tiers.js` rejects incomplete inputs and supports dry-run.
- `pages/v16-full.js` blocks reconcile when assets or wallet holdings are missing.
- `pages/v16-manual.js` rejects empty price data.

## Runtime Validation Still Required

Validate on deployed site:

1. `/api/prices` returns 9 watched assets.
2. `/api/sync-wallet` returns live wallet holdings.
3. `/api/reconcile-tiers` dry-run returns `storage: dry_run_no_write`.
4. `/api/v16-status` shows no release blocker when all upstreams work.
5. `/api/v16-status` shows direct blocker when prices or wallet are empty.

## Result

Price / wallet / reconcile source-level regression review is complete.
