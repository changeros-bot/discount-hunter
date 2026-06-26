# Consistency-006 Release Gates Check

Date: 2026-06-26
Status: PASS WITH NOTES
Phase: Audit Consistency Check

## Purpose

Convert the final audit findings into explicit phase gates so the project does not confuse "Audit 22/22 complete" with "V16 production ready".

This document defines the minimum gates for:

1. leaving Audit Consistency Check,
2. entering Fix Phase,
3. entering Regression Audit,
4. entering Repository Cleanup,
5. approving V16 Release.

## Scope

Repository documentation review only.

Primary source:

- `docs/audit/AUDIT_022_DEPLOYMENT_READINESS_GATE.md`

Supporting sources:

- `docs/audit/AUDIT_INDEX.md`
- `docs/audit/AUDIT_021_FINAL_RISK_CLOSURE.md`
- `docs/audit/ISSUE_REGISTER.md`
- `docs/audit/CRUD_MATRIX.md`
- consistency check documents 001-005

## Key Finding

Audit-022 explicitly states that V16 is not production-approved yet.

It approves the audit map as complete and allows V16 to move from architecture audit into fix-and-release hardening, but it does not approve production release.

Therefore, the correct current phase is:

```text
Architecture Audit 22/22 complete
↓
Audit Consistency Check
↓
Fix-and-Release Hardening
```

Not:

```text
Architecture Audit 22/22 complete
↓
Production Release
```

## Gate 1: Exit Audit Consistency Check

V16 may exit Audit Consistency Check only when all of the following are true:

- Consistency-001 Audit vs Production status is documented.
- Consistency-002 Runtime Gates are documented.
- Consistency-003 API Coverage is documented.
- Consistency-004 Writer Paths are documented.
- Consistency-005 State Flow is documented.
- Consistency-006 Release Gates is documented.
- No new hidden writer category is found.
- No new state category is found.
- No new Audit ID is required.

Current status:

PASS WITH NOTES.

Audit Consistency can close after this document is committed and indexed.

## Gate 2: Enter Fix Phase

Fix Phase may begin after Audit Consistency Check is complete.

Fix Phase constraints:

- No new product features.
- No strategy changes.
- No UI redesign.
- No broad refactor.
- Minimal changes only.
- Fix order must follow P0 → P1 → P2.
- Cleanup is not allowed during Fix Phase unless required to complete a safety fix.

Approved Fix Phase initial queue:

1. P0 hidden write neutralization.
2. P0 legacy reconcile-ledger handling.
3. P1 manual-buy same-tier idempotency.
4. P1 production durable state requirement / Upstash gate.
5. P1/P2 price and wallet upstream failure gating before reconcile.
6. P1/P2 v16-status or v16-health gate expansion.
7. P1/P2 Telegram cooldown/dedup release gate.

## Gate 3: Enter Regression Audit

Regression Audit may begin only after the selected P0/P1/P2 fixes are committed.

Minimum regression scope:

- Ledger read/write
- Manual buy
- Today decisions
- Wallet sync
- Price source
- Reconcile tiers
- Telegram alert check
- Telegram main send behavior
- v16-full dashboard path
- v16-manual path
- v16-status / v16-health

Regression must verify that fixes did not break:

- Ledger
- Wallet
- Decision
- Progress
- Dashboard
- Telegram
- Reconcile

## Gate 4: Enter Repository Cleanup

Repository Cleanup may begin only after Regression Audit passes.

Cleanup scope may include:

- debug APIs,
- legacy BscScan utilities,
- duplicate daily Telegram/report endpoints,
- historical docs,
- stale handoff/debug files.

Cleanup constraints:

- Do not delete files required by audit evidence before archiving or documenting them.
- Cleanup commits must be separate from safety fixes.
- Cleanup must not change investment strategy or buy-point behavior.

## Gate 5: V16 Release Approval

V16 may be released only when all code and runtime gates are satisfied.

### Required code gates

- Runtime env validation exists through script, endpoint, or checklist.
- `/api/v16-status` is expanded or `/api/v16-health` exists.
- Health gate covers `/api/prices`.
- Health gate covers `/api/sync-wallet`.
- Health gate covers `/api/reconcile-tiers` in safe/dry-run mode.
- Telegram transport/config can be checked without forced spam send.
- Production durable-state requirement is explicit.
- Hidden write path is fixed or neutralized.
- Manual same-tier duplicate write is blocked or made idempotent.
- Reconcile does not proceed with failed price/wallet upstream inputs.

### Required runtime gates

- Vercel deployment has `WALLET_ADDRESS` configured.
- At least one reliable BSC/RPC/transfer source is configured.
- `UPSTASH_REDIS_REST_URL` is configured in production.
- `UPSTASH_REDIS_REST_TOKEN` is configured in production.
- Telegram bot token and chat ID exist.
- Cloudflare Cron Worker is disabled or points only to a dedup-safe endpoint.
- One real wallet sync has been run and holdings/cost basis are plausible.
- One manual reconcile dry run has been run before write-back is allowed.

## Release Decision Logic

```text
IF Audit = complete
AND Consistency = complete
AND P0 = fixed
AND selected P1 safety blockers = fixed
AND Regression = pass
AND Runtime Gates = pass
AND Cleanup = complete
THEN V16 Release may be approved
ELSE V16 Release is blocked
```

## Result

PASS WITH NOTES.

The release gates are now explicit. The remaining work is not additional audit; it is Fix Phase followed by Regression, Runtime Validation, Cleanup, and Release.

## Next Step

Create or update `docs/audit/consistency/CONSISTENCY_INDEX.md` so all consistency checks are traceable from one place.
