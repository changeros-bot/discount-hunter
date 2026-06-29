# Coding Standards

## File size rule

- Page files should stay under 200 lines.
- If a file approaches 200 lines, split it before adding more logic.
- Large files are allowed only for temporary migration and must have a cleanup task.

## Page rule

Pages are for UI composition only.

Allowed in pages:

- React layout
- Component composition
- API loading state
- Simple rendering conditions

Not allowed in pages:

- Investment decision logic
- Ledger reconciliation logic
- Wallet comparison logic
- Tier calculation logic
- Telegram/notification logic
- Regression logic

## Module rule

Business logic belongs in `lib/`.

V17 modules should use this pattern:

```text
lib/v17/ledger.js
lib/v17/decision.js
lib/v17/wallet.js
lib/v17/tier.js
lib/v17/summary.js
lib/v17/state.js
```

Each module should have one clear responsibility.

## Naming rule

Use descriptive names:

- `ledgerStatusText()` instead of `ledgerText()` when the function includes pending tiers.
- `buildAssetState()` for SSOT construction.
- `getExecutableDecisions()` for manual-buy candidates.
- `getSuggestedAmount()` for cash requirement calculation.

## Change rule

Before changing code:

1. Identify the owner module.
2. Check whether the change is V16 hotfix or V17 refactor.
3. Avoid touching large page files unless absolutely required.
4. Add or update regression coverage.

## V16 rule

V16 is release-stabilization only.

Allowed:

- Critical runtime fixes
- Documentation
- Regression checks

Not allowed:

- Refactor
- New strategy
- New UI architecture
- Large page-file rewrites

## V17 rule

V17 is the architecture cleanup line.

Required:

- SSOT asset state
- Small modules
- Regression after each migrated domain
- No single file should become the new `v16-full.js`
