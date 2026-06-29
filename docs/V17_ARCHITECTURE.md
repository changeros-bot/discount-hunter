# V17 Architecture

## Goals
- Modular architecture
- Single Source of Truth (SSOT)
- Small files

## Rules
- Page files <= 200 lines.
- UI only in pages/.
- Business logic in lib/v17/.
- One module, one responsibility.
- Regression after each migration.

## Suggested modules
- lib/v17/ledger.js
- lib/v17/decision.js
- lib/v17/wallet.js
- lib/v17/summary.js
- lib/v17/tier.js
