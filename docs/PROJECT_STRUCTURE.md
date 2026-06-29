# Project Structure

## Current principle

V16 is the stable release line.
V17 is the architecture cleanup line.

Do not mix V16 hotfixes with V17 refactors.

## Recommended structure

```text
pages/
  index.js
  v16-full.js
  v17.js

lib/
  v17/
    index.js
    state.js
    symbol.js
    ledger.js
    wallet.js
    decision.js
    tier.js
    summary.js
    notification.js

pages/api/
  prices.js
  today-decisions.js
  buy-ledger.js
  sync-wallet.js
  reconcile-tiers.js
  regression-v16.js
```

## pages/

Pages should compose UI and call APIs.

They should not contain core business logic.

## lib/v17/state.js

Owns the Single Source of Truth.

Expected output shape:

```js
{
  symbol,
  signalLevel,
  signalTier,
  ledgerDoneTiers,
  pendingTiers,
  walletOwned,
  isLedgerDone,
  isPendingPurchase,
  isExecutable,
  suggestedAmount
}
```

## lib/v17/ledger.js

Owns:

- ledger rows
- done tier detection
- pending tier calculation
- ledger display text

## lib/v17/decision.js

Owns:

- decision dedupe
- executable decision filtering
- pending purchase filtering
- suggested amount calculation

## lib/v17/wallet.js

Owns:

- wallet holding map
- symbol-normalized ownership checks
- live holding validation

## lib/v17/tier.js

Owns:

- D1-D4 signal calculation
- progress calculation
- tier label helpers

## lib/v17/summary.js

Owns:

- homepage counts
- wallet summary
- suggested amount summary

## lib/v17/notification.js

Owns:

- Telegram payload preparation
- duplicate notification guard
- notification text formatting

## docs/

Docs are part of the release system.

Important docs:

```text
docs/V16_FINAL_HANDOFF.md
docs/V17_ARCHITECTURE.md
docs/V17_MIGRATION_PLAN.md
docs/CODING_STANDARDS.md
docs/REGRESSION_TESTS.md
docs/PROJECT_STRUCTURE.md
```

## New module rule

Before adding a new module:

1. Define responsibility.
2. Confirm no existing module owns it.
3. Add regression if the module changes behavior.
4. Keep file under 200 lines.

## Anti-patterns

Do not recreate:

- one giant page file
- duplicated decision logic
- wallet logic inside UI components
- ledger logic inside UI components
- notification logic inside page rendering
