# DCA 折價獵人 Release Notes

Last updated: 2026-06-29
Production: https://discount-hunter-sigma.vercel.app

---

## V16 current state

Status: Release hardening

Current target:

- Complete Audit-025 regression.
- Complete Audit-026 documentation freeze.
- Enter Audit-027 V16 Release Candidate.

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
- Notification SOP created.
- Near warning, trigger, retreat, and new-high events implemented.
- Near warnings send highest crossed threshold only.
- Shared health gate prevents status/notification mismatch.

### Health

- `lib/v16-health.js` created.
- `/api/v16-status` and `/api/telegram-alerts` use shared health logic.
- `/api/v16-status` is the primary release health gate.

### Daily Position

- `/api/daily-position-report` returns live position report.
- `/api/daily-position` alias added.

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

---

## V16 RC entry criteria

The project may enter V16 RC only when:

1. Audit-025 regression is PASS.
2. Audit-026 documentation freeze is PASS.
3. No P0/P1 open defects remain.
4. Production domain is verified.
5. Master docs are updated.
6. `/api/v16-status` returns healthy.
7. Homepage is stable on mobile.

---

## V17 candidates

Do not add these to V16 unless explicitly approved:

- App Push / Notification Center.
- Notification history UI.
- Telegram replay.
- More charting and analytics.
- Advanced cost-basis views.
- LINE or Email notification channels.
