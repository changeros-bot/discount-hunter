# Audit-022 Deployment Readiness Gate

Date: 2026-06-26
Status: Verified from repository source; runtime still pending
Scope: final deployment gate review for V16.

## Purpose

Audit-022 defines the minimum gate before V16 can be called production-ready.

This audit intentionally separates two things:

1. repository source verification, which can be checked from GitHub, and
2. runtime verification, which must be checked against the actual deployed Vercel / KV / Telegram / wallet environment.

## Repository Findings

### 1. Package scripts do not provide an automated gate

`package.json` currently provides only:

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start"
}
```

No `lint`, `test`, `typecheck`, `env-check`, `predeploy`, or health-gate script is present.

Risk: Vercel can deploy a build even if runtime-critical environment variables or endpoint behavior are incomplete.

### 2. `/api/v16-status` is a partial smoke test, not a full production gate

The status endpoint checks a limited set of APIs:

- `/api/buy-ledger`
- `/api/telegram-alert-check`
- `/api/wallet-change-alerts`
- `/api/daily-position-report`

It marks manual write-sensitive APIs as `manual_test_required`:

- `/api/manual-buy`
- `/api/today-decisions`

It does not directly test:

- `/api/prices`
- `/api/sync-wallet`
- `/api/reconcile-tiers`
- `/api/telegram-alerts`

Risk: V16 status can return broadly positive output while price, wallet sync, reconcile, or main Telegram alert flow is broken or degraded.

### 3. Durable state is not enforced by code

`lib/state/kv.js` only reports whether Upstash env vars exist.

`lib/v16-ledger.js` falls back to memory when KV is not configured and file fallback is unavailable in production/Vercel.

Risk: without Upstash KV, Ledger and Alert State are not durable across serverless cold starts, restarts, or redeployments.

### 4. Reconcile page does not gate upstream failures

`pages/reconcile.js` calls `/api/prices`, then `/api/sync-wallet`, then posts to `/api/reconcile-tiers` using fallback empty arrays when upstream data is absent.

Risk: reconcile can proceed with incomplete price or wallet input and produce misleading results.

## Minimum Release Gate

V16 should not be marked production-ready until all items below are true:

### Required code gates

- Add an automated script or endpoint that checks required runtime env vars.
- Expand `/api/v16-status` or create a stricter `/api/v16-health` to cover:
  - `/api/prices`
  - `/api/sync-wallet`
  - `/api/reconcile-tiers` in dry-run or safe validation mode
  - Telegram transport config without forced spam send
- Make production durable-state requirements explicit: Upstash KV must be configured for production Ledger and Alert State.
- Add reconcile failure gating before posting to `/api/reconcile-tiers`.
- Fix or neutralize the hidden write path from decision pages by passing explicit Ledger payloads or separating read-only decision from mutation.
- Add idempotency or duplicate prevention for manual same-tier Ledger writes.

### Required runtime gates

- Confirm Vercel deployment has `WALLET_ADDRESS` configured.
- Confirm at least one reliable BSC/RPC/transfer source is configured.
- Confirm `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are configured in production.
- Confirm Telegram bot token and chat ID exist, but do not enable repeated scheduled sends until cooldown/dedup is wired into main send flows.
- Confirm Cloudflare Cron Worker is disabled or points only to a dedup-safe alert endpoint.
- Run one real wallet sync and verify holdings/cost basis are plausible.
- Run one manual reconcile dry run before allowing write-back.

## Final Decision

Audit-022 does not approve production release yet.

It approves the audit map as complete: the remaining risks are no longer unknown; they are explicit deployment and safety gates.

V16 can move from `architecture audit` to `fix-and-release hardening` after this point.
