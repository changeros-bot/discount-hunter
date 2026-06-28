# DCA 折價獵人 Roadmap

Last updated: 2026-06-29

---

## Current phase

V16 is in Release Hardening.

Primary goals:

1. Finish Audit-025 regression.
2. Finish Audit-026 documentation freeze.
3. Enter Audit-027 V16 Release Candidate.

---

## V16 remaining work

### Audit-025 Regression

Remaining validation:

- `/api/buy-ledger`
- `/api/today-decisions` POST path
- `/api/telegram-alerts` after shared health gate

### Audit-026 Documentation Freeze

Deliverables:

- Master docs 00 through 14.
- Consolidated audit and SOP references.
- Troubleshooting and operations runbooks.

### Audit-027 Release Candidate

Entry criteria:

- No open P0/P1 bugs.
- Production domain verified.
- `/api/v16-status` healthy.
- Homepage stable.
- Master docs updated.

---

## V17 candidate scope

Do not add these to V16 unless explicitly approved:

- App Push / In-App Notification Center.
- Notification history UI.
- Telegram replay.
- More detailed PnL analytics.
- Cost basis drilldown views.
- LINE or Email notification channels.
- Better mobile charts.
- Notification log persistence UI.

---

## V18 candidate scope

Possible future work:

- Multi-wallet support.
- Multi-strategy dashboard.
- Long-term DCA integration with 富邦 holdings.
- Automated weekly/monthly reports.
- More exchange/provider redundancy.
- Strategy simulator.

---

## Roadmap rule

V16 is for stabilization.

New features should be collected here and moved into V17 planning after V16 RC is complete.
