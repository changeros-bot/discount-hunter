# DCA 折價獵人 Release Notes

Last updated: 2026-06-29
Production: https://discount-hunter-sigma.vercel.app

---

## V16 Release Candidate

Status: RC IN PROGRESS

RC date: 2026-06-29

Production URL:

```text
https://discount-hunter-sigma.vercel.app
```

RC basis:

- Audit-025 Regression: PASS.
- Audit-026 Documentation Freeze: PASS.
- `/api/regression-v16`: PASS.
- Regression result: `ok:true`, `passCount:4`, `failCount:0`.

Regression checks:

| Check | Status | Detail |
|---|---:|---|
| `/api/prices` | PASS | 9 tracked symbols |
| `/api/buy-ledger` | PASS | 9 ledger symbols |
| `/api/today-decisions` POST | PASS | decisions 0, duplicateCount 0 |
| `/api/telegram-alerts` | PASS | v16.6 shared health gate |

RC included capabilities:

- Wallet Live as source of truth.
- Binance xStocks price engine.
- Ledger read and reconcile safety.
- Cost basis and PnL display.
- Today Decisions POST flow.
- D1-D4 attention zone and observation zone UI.
- Telegram event engine.
- Near / trigger / retreat / new-high event rules.
- Shared health gate.
- Daily position report.
- Master documentation set.

Known limits:

- V16 does not include App Push.
- V16 does not include LINE or Email notifications.
- V16 does not include auto-trading.
- New feature work moves to V17 unless explicitly approved.

Remaining RC closeout:

- Confirm final production deployment after this release-note update.
- If production remains healthy, mark Audit-027 PASS in `01_MASTER_AUDIT.md`.

---

## V16-M hardening highlights

### Wallet and Ledger

- Live wallet holdings verified through BNB Chain RPC balance checks.
- Reconcile flow requires live holdings.
- Stale wallet snapshots must not write Ledger.
- Fallback first-layer cost exists for missing stablecoin transfer leg.

### Dashboard

- Homepage points to `pages/v16-full.js`.
- Dashboard panels are shown only on homepage routes.
- D1-D4 attention section and observation section semantics confirmed.

### Notification

- Telegram transport verified.
- Notification SOP created and consolidated into Master SOP.
- Near warning, trigger, retreat, and new-high events implemented.
- Near warnings send highest crossed threshold only.
- Shared health gate prevents status/notification mismatch.

### Health

- `lib/v16-health.js` created.
- `/api/v16-status` and `/api/telegram-alerts` use shared health logic.
- `/api/v16-status` is the primary release health gate.
- `/api/regression-v16` added as a read-only regression endpoint.

### Daily Position

- `/api/daily-position-report` returns live position report.
- `/api/daily-position` alias added.

### Documentation

- Master docs 00 through 14 created.
- Legacy `AUDIT_LOG.md` consolidated.
- Legacy `NOTIFICATION_SOP.md` consolidated.

---

## Key commits

- `d9a9c13` — require live wallet source for reconcile.
- `b84b82e` — force live wallet sync before reconcile.
- `ecd68c3` — remove legacy global alert portal.
- `dcb020d` — create Notification SOP.
- `5192688` — implement notification event rules.
- `cdc6f9d` — highest near threshold only.
- `a691bb9` — add new-high notification.
- `1a56599` — create shared health gate.
- `34a7fce` — telegram-alerts uses shared health gate.
- `bb5c359` — v16-status uses shared health gate.
- `5fda4e4` — add daily-position alias.
- `9b64ece` — dashboard panels only on homepage.
- `319de40` — create audit log.
- `6992315` — add v16 regression endpoint.
- `aae210b` — mark Audit-025 and Audit-026 PASS.

---

## V17 candidates

Do not add these to V16 unless explicitly approved:

- App Push / Notification Center.
- Notification history UI.
- Telegram replay.
- More charting and analytics.
- Advanced cost-basis views.
- LINE or Email notification channels.
