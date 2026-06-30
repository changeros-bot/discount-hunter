# V17 Decision Lifecycle SOP

This document is the source of truth for the V17 Today Decision lifecycle.

## Core Principle

Today Decision is an action queue, not a forced buy instruction.

A decision can be completed by confirmed transaction events, remain active when partially completed, or be skipped by the user for the current layer only.

## State Lifecycle

### 1. Enter action queue

A qualified asset enters Today Decision when the market price reaches the deepest active discount layer.

Only the deepest active layer is valid.

Example:

- If D1 is active, show D1.
- If price later reaches D2, D1 is replaced by D2.
- D1 and D2 must not both be shown.

## Exit Conditions

A decision can leave Today Decision only through one of the following conditions.

### A. Completed

A matching transaction event confirms the required amount for the current layer.

Rules:

- The decision leaves Today Decision.
- The event may be reflected in ledger or portfolio systems only through the normal transaction pipeline.
- Completion must not be inferred from a UI click.

### B. Partial

A matching transaction event is detected but the amount is below the suggested amount.

Rules:

- The decision remains in Today Decision.
- UI must show the amount mismatch.
- User must be reminded that the amount is incomplete.

### C. Suspected

A transaction event is detected but price is missing.

Rules:

- The decision remains in Today Decision.
- UI must show pending price confirmation.

### D. Mismatch

A transaction event does not match the current suggested layer.

Rules:

- The decision remains in Today Decision.
- UI must show that the action does not match the suggestion.

### E. Skipped Layer

Button label: `略過本層`

A skipped layer means the user decided not to act on the current deepest active layer.

Rules:

- Skip applies only to the current symbol + current layer.
- Skip belongs to a layer, not to the whole asset.
- Skip immediately removes that decision from Today Decision.
- Skip must not write to Ledger.
- Skip must not create holdings.
- Skip must not affect blockchain data.
- Skip must not be treated as a completed transaction.

Example:

- NVDA D1 is skipped.
- NVDA D1 leaves Today Decision.
- If NVDA later reaches D2, D2 must enter Today Decision again.

## Non-negotiable Rules

### Rule 1: Deepest layer wins

The Decision Engine must always use the deepest currently triggered layer.

### Rule 2: Higher layers expire automatically

If D2 is active, D1 is no longer actionable.

### Rule 3: Skip does not block deeper layers

D1 skipped must never block D2, D3, or D4.

### Rule 4: Skip is not a trade

Skip cannot write Ledger, create a position, or mark anything as bought.

### Rule 5: Today Decision cards must show layer rules

Today Decision cards must show the same layer rules as Watch and Holding cards:

- D1 threshold and amount
- D2 threshold and amount
- D3 threshold and amount
- D4 threshold and amount, when available

The current active layer must be visually highlighted.

## Regression Requirements

Every release must verify:

1. D1 active enters Today Decision.
2. D1 skipped leaves Today Decision.
3. D1 skipped does not write Ledger.
4. D1 skipped does not create holding.
5. D2 active after D1 skipped re-enters Today Decision.
6. Completed current layer leaves Today Decision.
7. Partial current layer remains in Today Decision.
8. Current Today Decision card shows full layer rules.
