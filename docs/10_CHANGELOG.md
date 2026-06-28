# DCA 折價獵人 Changelog

Last updated: 2026-06-29

---

## 2026-06-29

Documentation Freeze:

- Added master documentation index.
- Added master audit file.
- Added master SOP.
- Added architecture overview.
- Added API reference.
- Added release notes.
- Added troubleshooting guide.
- Added design decisions.
- Added roadmap.
- Added test plan.

---

## 2026-06-28

Health Gate:

- Added shared health logic in `lib/v16-health.js`.
- Updated notification path to use shared health gate.
- Updated status path to use shared health gate.

Notification Engine:

- Created notification SOP.
- Implemented near alerts, buy trigger alerts, retreat alerts, and new-high alerts.
- Changed near warning logic so only highest crossed threshold is sent.
- Added dedupe and cooldown behavior.

Daily Position:

- Added daily-position alias.
- Verified daily position report preview.

Dashboard:

- Restricted dashboard helper panels to homepage routes.
- Confirmed production URL.
- Confirmed D1-D4 attention section and observation section semantics.

---

## 2026-06-27

Reconcile safety:

- Reconcile requires live wallet holdings.
- Homepage forces wallet sync before reconcile.
- Reconcile rejects missing live wallet evidence.

Legacy UI cleanup:

- Removed legacy buy point alert portal from global app render.
- Split dashboard into decision, holding, and observation sections.

---

## Maintenance rule

Every future code change must add a changelog entry when user-facing behavior, API behavior, release state, or operations behavior changes.
