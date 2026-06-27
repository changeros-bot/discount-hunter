# V16 Regression - Decision / Progress / Dashboard

Date: 2026-06-27
Status: SOURCE REVIEW COMPLETE

## Scope

Reviewed consistency across:

```text
/api/today-decisions
lib/v16-ledger progress helpers
pages/v16-full.js
pages/v16-manual.js
```

## Checks

| Item | Result |
|---|---|
| `/api/today-decisions` GET is read-only usage info | PASS |
| `/api/today-decisions` POST does not write Ledger | PASS |
| posted Ledger is normalized before decision calculation | PASS |
| no hidden leftBuyZone write in today-decisions | PASS |
| triggered decisions show progress 100 | PASS |
| non-triggered progress remains below 100 | PASS |
| dashboard sorting prioritizes deeper tier then deeper discount | PASS |
| v16-full top decision list uses full decisions array | PASS |
| v16-manual renders full decisions array | PASS |

## Fix Applied In This Segment

File changed:

- `pages/v16-manual.js`

Change:

- Decision count label changed from `檔` to `筆`.

Reason:

- `/api/today-decisions` returns executable decision entries.
- One symbol may produce multiple tier decisions.
- Therefore the display unit should be entries, not symbols.

Commit:

- `8d75ba5543ceaa0dea0b1abf3eb75379b238ff35`

## Notes

`v16-full` asset cards show a summary tier based on `asset.signal.level`, but the top 今日決策 section renders the full `decisions` array from `/api/today-decisions`.

Therefore multi-tier decision entries are still visible in the execution list.

## Runtime Validation Still Required

Validate on deployed site:

1. A triggered tier shows 100% progress.
2. A near but not triggered tier remains below 100%.
3. Multiple decisions display as multiple entries.
4. v16-manual count uses 筆.
5. Manual buy after a decision updates Ledger and removes completed decision after refresh.

## Result

Decision / Progress / Dashboard source-level regression review is complete.
