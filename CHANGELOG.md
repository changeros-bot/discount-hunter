# Changelog

## 2026-06-25 - V16 documentation baseline

### Added

- Added `docs/V16_SPEC.md` as the V16 source of truth.
- Added `docs/PROGRESS.md` to record daily progress and handoff notes.
- Added `docs/AI_HANDOFF.md` for future AI-assisted development.
- Added `docs/TEST_CASES.md` with V16 verification cases.
- Added `docs/CONFIG.md` for configurable rules, timers, and environment variables.
- Added `docs/API.md` for endpoint behavior and validation order.
- Added `docs/STATE_MACHINE.md` for the V16 price / ledger / decision states.
- Added `docs/KNOWN_BUGS.md` to track pending work before封版.
- Added root `CHANGELOG.md`.

### Updated

- Updated `README.md` as the project entry point.
- Updated `docs/ARCHITECTURE.md` to describe the V16 data flow.
- Updated `docs/PROGRESS.md` with documentation status and next handoff steps.

### Important V16 decisions

- DCA `N` and dip-buy `D1-D4` are independent.
- Ledger is historical state and deduplication source, not the current price zone.
- Price zone is dynamic and must move with latest drawdown.
- Today Decision equals triggered tiers minus completed Ledger tiers.
- Same-tier reopening requires leaving the tier zone, waiting over 24 hours from `leftBuyZoneAt`, then re-entering.
- Reconcile must use Wallet Cost Gap to avoid backfilling deeper tiers incorrectly.

### Known issues

- `pages/v16-full.js` still needs dashboard three-zone restructuring.
- Telegram alert flow is not fully connected to Today Decision.
- `pages/api/reconcile-ledger.js` is legacy D1-only and should be avoided in favor of `pages/api/reconcile-tiers.js`.

## 2026-06-24 - V16 engine work

### Added / changed

- Added Buy Ledger concept with `N / D1 / D2 / D3 / D4` buckets.
- Added Wallet to Ledger reconcile flow.
- Added `/api/reconcile-tiers` for multi-tier backfill.
- Updated homepage button to call `/api/reconcile-tiers`.
- Updated `/reconcile` page to call `/api/reconcile-tiers`.
- Fixed tier reopen logic to use `leftBuyZoneAt`.
- Added Wallet Cost Gap guard.

### Still pending

- Verify RKLB D2 reconciliation end-to-end.
- Rebuild dashboard into Decision / Buy Zone / Watchlist.
- Connect Telegram alerts.
