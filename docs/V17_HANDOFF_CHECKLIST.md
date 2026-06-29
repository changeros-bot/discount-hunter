# V17 Handoff Checklist

## Project status
- V16 frozen except critical runtime fixes.
- V17 starts from documented architecture.

## Read order (mandatory)
1. V16_FINAL_HANDOFF.md
2. ARCHITECTURE_DECISIONS.md
3. V17_ARCHITECTURE.md
4. CODING_STANDARDS.md
5. PROJECT_STRUCTURE.md
6. REGRESSION_TESTS.md
7. DEFINITION_OF_DONE.md
8. V17_MIGRATION_PLAN.md
9. 14_OPERATIONS.md

## Sprint 1
- Create v17 page skeleton.
- Create lib/v17 modules.
- Build SSOT.
- Migrate Ledger.
- Run regression.

## Rules
- No business logic in pages.
- Split files before 200 lines.
- One responsibility per module.
- Every bug gets regression coverage.
- Documentation must stay in sync with code.

## Release target
- V17 Alpha after module migration and regression pass.
