# Runtime Finding 001 - Wallet Holding Exists But Dashboard Still Shows Unrecorded Buy

Date: 2026-06-27
Severity: P1
Status: OPEN - FIX REQUIRED

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

However, the V16 dashboard still shows multiple Today Decisions as:

```text
未登帳
```

and asset cards show:

```text
Ledger 尚未登帳
可手動買入
```

## Problem

The dashboard currently treats Ledger as the only execution source of truth.

When the wallet already contains the purchased asset but Ledger is missing or blocked by durable-state configuration, the dashboard still presents the decision as executable.

This can mislead the user into buying again.

## Expected Behavior

When live wallet holdings indicate the user already owns the asset, but Ledger does not yet contain the tier record, the UI should not present it as a simple executable buy.

Expected state should be closer to:

```text
錢包已持有，Ledger 待補登
```

or:

```text
Wallet 已買入，需補登 Ledger
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

## Required Fix

Minimal fix should add wallet-aware display state:

1. Build a wallet holdings map by normalized symbol.
2. When a decision exists but wallet already has a live holding for the symbol and Ledger is missing the tier, show wallet-owned / ledger-pending state.
3. Avoid labeling this as ordinary `未登帳，可手動買入`.
4. Prefer reconcile / ledger repair wording.

## Do Not Do

- Do not auto-write Ledger without durable state.
- Do not modify buy strategy.
- Do not change D1-D4 thresholds.
- Do not hide the issue silently.

## Current Status

Open.

Must be fixed before Cleanup and Release.
