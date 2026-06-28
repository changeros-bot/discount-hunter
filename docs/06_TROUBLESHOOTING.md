# DCA 折價獵人 Troubleshooting

Last updated: 2026-06-29
Production: https://discount-hunter-sigma.vercel.app

---

## Bug-001 — Old domain shows 404

Symptom:

- API checks pass on one URL, but homepage or another path shows 404.

Cause:

- Testing was done on an obsolete or unrelated Vercel domain instead of production.

Correct production domain:

```text
https://discount-hunter-sigma.vercel.app
```

Fix:

- Use the production domain from Vercel deployment screen.
- Verify deployment is Production and Ready.

Prevention:

- Always record production domain in `00_MASTER_INDEX.md` and `05_RELEASE_NOTES.md`.

---

## Bug-002 — V16 status says healthy but Telegram says Wallet error

Symptom:

- `/api/v16-status` shows Wallet healthy.
- `/api/telegram-alerts` sends or reports Wallet error.

Cause:

- Health logic was duplicated between routes and became inconsistent.

Fix:

- Created `lib/v16-health.js`.
- Updated `/api/telegram-alerts` and `/api/v16-status` to use shared health gate.

Prevention:

- Never implement independent wallet/prices health checks inside routes.
- All new notification or release checks must import shared health logic.

---

## Bug-003 — `/api/daily-position` 404

Symptom:

- `/api/daily-position-report` works.
- `/api/daily-position` shows 404.

Cause:

- Short alias route did not exist.

Fix:

- Added `pages/api/daily-position.js` as an alias to `daily-position-report`.

Prevention:

- Add alias routes intentionally when they are referenced by UI or manual validation.
- Record alias routes in `04_API_REFERENCE.md`.

---

## Bug-004 — 404 page still shows dashboard panels

Symptom:

- A 404 route shows 更新紀錄 / Telegram 測試 / 持倉分布 / 歷史紀錄 below the 404 message.

Cause:

- `_app.js` rendered dashboard helper panels globally for every route.

Fix:

- Restrict helper panels to `/` and `/v16-full` only.

Prevention:

- Do not mount dashboard-only components globally unless route-scoped.

---

## Bug-005 — Near alert sends 92/94/96/98 all at once

Symptom:

- A symbol already at 98% sends four near alerts.

Cause:

- Alert engine emitted every crossed threshold instead of only the highest current threshold.

Fix:

- Send only highest currently crossed threshold.

Prevention:

- Notification engine must follow `02_MASTER_SOP.md`.

---

## Bug-006 — Misreading D1-D4 section as missing wallet holdings

Symptom:

- UI shows 已登帳持倉區 (4) while Wallet has 9 holdings.

Cause:

- The section means D1-D4 / special attention zone, not all wallet holdings.

Fix:

- No code change. Semantics confirmed by user.

Prevention:

- Keep section definitions documented in `01_MASTER_AUDIT.md` and `03_ARCHITECTURE.md`.

---

## General debug order

When something fails:

1. Confirm production domain.
2. Confirm latest Vercel deployment is Ready.
3. Test `/api/v16-status`.
4. Test the specific API route directly.
5. Check whether route requires POST instead of GET.
6. Check runtime logs only after the above.
7. Record root cause in this file.
