# DCA 折價獵人 Master SOP

Last updated: 2026-06-29
Production: https://discount-hunter-sigma.vercel.app

This file is the master operating procedure for V16.

---

## Source of truth

Wallet Live is the source of truth for current holdings.

Required live quantity source:

```text
bsc_rpc_balanceOf_live
```

Rules:

- Transfer history alone is not proof of current holdings.
- Reconcile must sync live wallet first.
- Reconcile must not use stale frontend wallet snapshots.
- If no live wallet holding is found, cancel reconcile.

---

## Health Gate

Shared health logic must live in:

```text
lib/v16-health.js
```

Consumers:

- `/api/v16-status`
- `/api/telegram-alerts`
- future notification or app push endpoints

Rules:

- Do not duplicate wallet/prices health checks in separate routes.
- If health logic changes, update the shared health file first.
- Status and notification paths must use the same health rules.

---

## Notifications

Channels:

- Telegram Bot
- Future App Push / In-App Alert

Event types:

- Near warning: 92, 94, 96, 98.
- Buy trigger: D1, D2, D3, D4.
- Retreat: backward movement to a shallower layer or D0.
- New high: price reaches or exceeds known high.
- Wallet/System error.
- Daily summary.

Dedup key format:

```text
notification:{channel}:{type}:{symbol}:{fromLayer}:{toLayer}:{threshold}
```

Rules:

- Near alert sends only highest crossed threshold.
- Same event key must not spam repeatedly.
- Ledger-completed layers should not trigger new buy alerts.
- If wallet cannot be verified, buy alerts must be blocked.

---

## Ledger

Ledger records completed buy layers.

Rules:

- Ledger write must be idempotent.
- Same symbol and same tier should not duplicate.
- Reconcile must require live wallet evidence.
- Dry-run reconcile should be used in health checks.

---

## API

Rules:

- Production API routes must return JSON.
- User-facing read routes may be GET.
- Mutation routes should be POST.
- Health endpoints must avoid forced spam sends.

---

## Deployment

Production domain:

```text
https://discount-hunter-sigma.vercel.app
```

Rules:

- Verify Vercel deployment is Production and Ready.
- Verify latest commit SHA matches expected commit.
- Do not use obsolete preview domains for final validation.
- After deployment, validate `/api/v16-status` and homepage.

---

## Documentation

Minimum completion path:

```text
Code -> Test -> Audit update -> SOP update if workflow changed -> Release Notes if release-impacting -> Deploy -> Verify
```

A change is not complete if documentation is missing.

---

## Emergency triage

When production behavior is contradictory:

1. Verify domain.
2. Verify Vercel deployment commit.
3. Verify `/api/v16-status`.
4. Verify direct API route.
5. Inspect runtime logs only after API route verification.
6. Record root cause in `06_TROUBLESHOOTING.md`.
