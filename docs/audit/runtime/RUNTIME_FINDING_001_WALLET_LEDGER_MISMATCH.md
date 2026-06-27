# Runtime Finding 001 - Wallet Holding Exists But Dashboard Still Shows Unrecorded Buy

Date: 2026-06-27
Severity: P1
Status: SOURCE FIXED - DEPLOYED RUNTIME VALIDATION REQUIRED

## Finding

User-provided Binance Wallet screenshots show live xStocks positions and recent swap records.

Visible wallet state includes positions for:

- AVGOon
- RKLBon
- NVDAon
- MRVLon
- SPCXon
- TSMon
- QQQon
- AMDon
- GOOGLon

Visible recent history also shows several same-day swaps of approximately `-5 USDT` into xStocks.

However, the V16 dashboard still showed multiple Today Decisions as:

```text
未登帳
```

and asset cards showed:

```text
Ledger 尚未登帳
可手動買入
```

## Problem

The dashboard treated Ledger as the only execution source of truth.

When the wallet already contains the purchased asset but Ledger is missing or blocked by durable-state configuration, the dashboard still presented the decision as executable.

This could mislead the user into buying again.

## Expected Behavior

When live wallet holdings indicate the user already owns the asset, but Ledger does not yet contain the tier record, the UI must not present it as a simple executable buy.

Expected state:

```text
Wallet已持有，Ledger待補登
```

The action should be reconcile / ledger repair, not another buy instruction.

## Impact

- Duplicate buying risk.
- Dashboard trust issue.
- Release blocker for V16.

## Related Runtime Evidence

- `/api/prices` works.
- `/api/sync-wallet` works and returns holdings.
- `/api/buy-ledger` currently shows empty tier arrays.
- `/api/v16-status` blocks release due to `missing_required_upstash_kv`.

## Fix Applied

File changed:

- `pages/v16-full.js`

Change:

1. Added wallet holdings map using normalized symbols.
2. Added wallet-aware decision classification:

```text
executableDecisions
walletPendingDecisions
```

3. Changed Today Decision display from only:

```text
未登帳
```

to:

```text
Wallet已持有，Ledger待補登
```

when live wallet already owns the symbol.

4. Changed asset card action text from:

```text
可手動買入
```

to:

```text
Wallet已持有，Ledger待補登
```

when wallet-owned but Ledger-missing.

5. Changed summary from `未登帳買點` to split:

```text
可手動買入
Wallet已持有待補登
建議新增投入
```

## Commit

- `6c273824651e29e1801ba7b916baa73c8c7845ab`

## Do Not Do

- Do not auto-write Ledger without durable state.
- Do not modify buy strategy.
- Do not change D1-D4 thresholds.
- Do not hide the issue silently.

## Runtime Validation Required

After deployment, user must re-open:

```text
https://discount-hunter-sigma.vercel.app/
https://discount-hunter-sigma.vercel.app/v16-full
```

Expected:

- Today Decision summary shows `Wallet已持有待補登` count.
- Previously misleading rows no longer say only `未登帳`.
- Asset cards no longer say `可手動買入` for wallet-owned symbols.
- `建議新增投入` excludes wallet-owned pending rows.

## Current Status

Source fixed.

Still release-blocking until deployed runtime screenshots confirm the fix.
