# DCA 折價獵人 Master Index

Last updated: 2026-06-29
Production: https://discount-hunter-sigma.vercel.app
Repository: changeros-bot/discount-hunter

This directory is the single source of truth for DCA 折價獵人 V16 and future versions. Chat history is not the source of truth.

---

## Core documents

1. `01_MASTER_AUDIT.md` — Audit-001 onward, including reconstructed historical audits and verified V16 audits.
2. `02_MASTER_SOP.md` — Operating procedures for Wallet, Ledger, Health Gate, Notifications, Deployment, and Recovery.
3. `03_ARCHITECTURE.md` — System architecture and data flow.
4. `04_API_REFERENCE.md` — API routes, purpose, method, and validation expectations.
5. `05_RELEASE_NOTES.md` — Release history and release candidate status.
6. `06_TROUBLESHOOTING.md` — Known incidents, causes, fixes, and prevention.
7. `07_DECISIONS.md` — Design decisions and reasons.
8. `08_ROADMAP.md` — V16 closeout and V17/V18 roadmap.
9. `09_TEST_PLAN.md` — Regression and production validation plan.
10. `10_CHANGELOG.md` — Human-readable change log tied to commits.
11. `11_PROJECT_PRINCIPLES.md` — Non-negotiable project rules.
12. `12_SECURITY.md` — Secrets, token, key, and environment variable controls.
13. `13_DATA_MODEL.md` — Data model for prices, wallet, ledger, decisions, and notifications.
14. `14_OPERATIONS.md` — Daily/weekly operations, deployment, rollback, and monitoring.

---

## Existing legacy/reference documents

- `AUDIT_LOG.md` — Initial audit log created during V16 hardening. Content is consolidated into `01_MASTER_AUDIT.md`.
- `NOTIFICATION_SOP.md` — Notification SOP. Content is consolidated into `02_MASTER_SOP.md` and remains as a specialized reference until cleanup.

---

## Documentation rule

Every production change must update the relevant master document in the same work session:

```text
Code change
→ Test
→ Master Audit update
→ SOP update if workflow changed
→ Release Notes update if release-impacting
→ Deploy
→ Verify
```

A change is not considered complete until documentation and production verification are both done.
