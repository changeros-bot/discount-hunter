# DCA 折價獵人 V16 Audit Log

Last updated: 2026-06-29
Production: https://discount-hunter-sigma.vercel.app

This file is the source of truth for V16 audit progress. Chat history is not the source of truth.

---

## Audit-021 — Notification / Health Gate

Status: PASS

Scope:

- Telegram test message
- Telegram alert event engine
- Near warning alerts
- Buy point trigger alerts
- Retreat alerts
- Daily summary route
- Shared health gate

Result:

- Telegram transport verified.
- `docs/NOTIFICATION_SOP.md` created.
- `lib/v16-health.js` created as shared Health Gate.
- `pages/api/telegram-alerts.js` updated to use shared health rules.
- `pages/api/v16-status.js` updated to use shared health rules.

Key commits:

- `dcb020d` — add notification SOP
- `5192688` — implement notification event rules
- `cdc6f9d` — highest near alert only
- `a691bb9` — new high notification
- `34a7fce` — telegram-alerts shared health gate
- `bb5c359` — v16-status shared health gate

Acceptance:

- Prices health: PASS
- Wallet health: PASS
- Ledger health: PASS
- Telegram transport: PASS

---

## Audit-022 — Dashboard 404 / Global Panels

Status: PASS

Scope:

- Homepage route
- 404 page contamination
- Global dashboard panels

Result:

- Confirmed homepage is `pages/index.js` importing `pages/v16-full.js`.
- Confirmed old `inter-sigma` domain should not be used.
- Confirmed production domain is `discount-hunter-sigma.vercel.app`.
- Fixed `_app.js` so global dashboard panels only render on `/` and `/v16-full`.

Key commit:

- `9b64ece` — show dashboard panels only on homepage

Acceptance:

- Homepage shows dashboard panels.
- 404 pages no longer show dashboard panels.

---

## Audit-023 — Daily Position Alias

Status: PASS

Scope:

- `/api/daily-position-report`
- `/api/daily-position`

Result:

- Added alias route so `/api/daily-position` maps to `/api/daily-position-report`.
- Confirmed daily report returns live wallet summary.

Key commit:

- `5fda4e4` — add daily-position alias

Acceptance:

- `/api/daily-position-report`: PASS
- `/api/daily-position`: PASS

---

## Audit-024 — Homepage Section Semantics

Status: PASS

Scope:

- Entered buy-zone holdings section
- Watchlist section
- User screenshot interpretation

Final definition:

- `已登帳持倉區` is not all wallet holdings.
- `已登帳持倉區` means symbols currently in D1–D4 / special attention zone.
- `觀察區` means symbols not currently in D1–D4.
- Therefore `4 + 5 = 9` is expected and correct.

Result:

- No code change required.
- Screenshot duplication was confirmed as repeated screenshot, not duplicate UI rendering.

Acceptance:

- Buy-zone section: PASS
- Watchlist section: PASS
- No duplicate watchlist: PASS

---

## Audit-025 — Regression Audit

Status: IN PROGRESS

Regression targets:

1. `/api/prices`
2. `/api/sync-wallet`
3. `/api/buy-ledger`
4. `/api/today-decisions`
5. `/api/telegram-alerts`
6. `/api/daily-position`
7. `/api/v16-status`
8. Homepage UI

Rules:

- No new features during regression.
- Only P0/P1 bug fixes allowed.
- Any fix must be recorded in this file and, if notification-related, in `docs/NOTIFICATION_SOP.md`.

Current known result:

- `/api/prices`: PASS from user screenshot.
- `/api/sync-wallet`: PASS from prior verification.
- `/api/daily-position`: PASS from user screenshot.
- `/api/v16-status`: PASS from user screenshot after shared health gate.
- Homepage UI: PASS after user correction on section semantics.

Remaining to verify:

- `/api/buy-ledger`
- `/api/today-decisions` via POST path
- `/api/telegram-alerts` after shared health gate

---

## Next Steps

After Audit-025 completes:

1. Audit-026 — Cleanup
2. Audit-027 — V16 RC
