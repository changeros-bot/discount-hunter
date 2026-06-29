# V17 Validation Log

This file records what has been checked, what is still pending, and what must not be considered complete yet.

---

## Current Validation Status

| Area | Status | Evidence | Notes |
|---|---|---|---|
| Storage Policy | Static checked | `docs/V17_STORAGE_POLICY.md` | Mutable V17 state must not use runtime files |
| Storage Guard | Static checked | `lib/v17-storage.js` | Production without durable KV must fail loudly |
| Asset Registry | Self-test available | `/api/v17/self-test` | Checks required fields, BTC, engines, strategies |
| Decision Engine | Self-test available | `/api/v17/self-test` | Checks read-only guardrail and basic tier math |
| Health Gate | API available | `/api/v17/health` | Combines release gates and self-test summary |
| Deployed API Test | Pending | Manual browser/API call required | Need to call deployed `/api/v17/health` after Vercel deploy |
| Build Test | Pending | `npm run build` | Must be run before RC |
| V16 Regression | Pending | V16 dashboard/API smoke test | Required before connecting V17 UI |
| Mobile UI Test | Pending | Manual phone check | Not started |
| Universe Freeze Approval | Pending | `docs/V17_UNIVERSE_FREEZE.md` | Required before replacing old discount-buy rules |
| New Discount Rule Migration | Blocked | Universe Freeze not approved | Do not migrate yet |

---

## Validation Endpoints

After deployment, check these endpoints manually:

```txt
/api/v17/storage-status
/api/v17/assets
/api/v17/decisions
/api/v17/self-test
/api/v17/health
```

Expected behavior:

- `/api/v17/storage-status` should show whether durable storage is configured.
- `/api/v17/assets` should return V17 Asset Registry.
- `/api/v17/decisions` should return read-only decisions and no ledger writes.
- `/api/v17/self-test` should pass core architecture tests.
- `/api/v17/health` should summarize release gates and pending blockers.

---

## Current Blockers

1. V17 has not been dynamically tested on deployed Vercel runtime.
2. Build test has not been confirmed.
3. V16 regression has not been confirmed after V17 additions.
4. Universe Freeze is not approved.
5. Old discount-buy rules must not be replaced yet.
6. Automatic trading remains out of scope for V17 execution.

---

## Rule

A module is not Done until it has:

1. Implementation.
2. Static review.
3. Functional test.
4. Regression check.
5. Fix if needed.
6. Re-test.
7. Validation log update.
