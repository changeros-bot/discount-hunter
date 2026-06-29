# DCA 折價獵人 Design Decisions

Last updated: 2026-06-29

---

## Decision-001 — Wallet Live is source of truth

Decision:

Current holdings must come from live BNB Chain RPC `balanceOf()`.

Reason:

Transfer history proves historical movement but not current balance. Live holdings are required before reconcile or current-position decisions.

Impact:

- Reconcile requires `quantitySource = bsc_rpc_balanceOf_live`.
- Stale wallet snapshots are not allowed for ledger writes.

---

## Decision-002 — Ledger records completed layers

Decision:

Ledger is used to record completed buy layers, not to replace live wallet state.

Reason:

Ledger answers “what layer has been accounted for.” Wallet answers “what is currently held.”

Impact:

- Completed Ledger tiers suppress duplicate decisions.
- Wallet/Ledger mismatch is an alert condition.

---

## Decision-003 — Today Decisions is POST-based

Decision:

`/api/today-decisions` should calculate from posted `assets` and `ledger`.

Reason:

The frontend already has fresh price rows and ledger state. POST avoids hidden source ambiguity.

Impact:

- GET path is informational only.
- Regression must test POST path.

---

## Decision-004 — Near alert sends only highest threshold

Decision:

If a symbol is already at 98%, send only 98%, not 92/94/96/98 all at once.

Reason:

Multiple catch-up warnings are noisy and reduce trust.

Impact:

- Event engine emits only highest crossed near threshold.

---

## Decision-005 — Telegram and App Push should share event rules

Decision:

Notifications are shared events first, then delivered to channels.

Reason:

Telegram-only logic would diverge when App Push is added.

Impact:

- Event keys should be stable and channel-aware.
- Future App Push must reuse the same event engine.

---

## Decision-006 — Dashboard helper panels are homepage-only

Decision:

更新紀錄 / Telegram 測試 / 持倉分布 / 歷史紀錄 should render only on dashboard routes.

Reason:

Rendering them globally polluted 404 pages and caused false debugging signals.

Impact:

- `_app.js` uses route guard for dashboard helper panels.

---

## Decision-007 — `daily-position` alias exists

Decision:

Keep both `/api/daily-position-report` and `/api/daily-position`.

Reason:

The shorter route is natural for manual validation and avoids 404 confusion.

Impact:

- `daily-position` aliases the report endpoint.

---

## Decision-008 — V16 is hardening, not feature expansion

Decision:

During V16 freeze, only P0/P1 fixes, documentation, and regression work are allowed.

Reason:

New features increase risk before RC.

Impact:

- App Push, notification history UI, LINE, Email, and advanced analytics move to V17 unless explicitly approved.

---

## Decision-009 — Wallet verifies, but does not prove a tier was bought

Decision:

Wallet data must be used for verification, quantity monitoring, value, cost basis, PnL, and reconcile safety. However, Wallet ownership alone must not mark a D1-D4 tier as bought.

Reason:

A wallet may already hold a symbol from an older tier. If the system treats “Wallet owns symbol” as “current tier bought,” future layers such as D2, D3, or D4 can be incorrectly suppressed.

Correct state logic:

```text
Price reaches tier + Ledger has tier
  -> Completed

Price reaches tier + Pending purchase exists
  -> Bought, Ledger pending

Price reaches tier + no Ledger tier + no Pending purchase
  -> Manual buy candidate

Wallet owns symbol
  -> Verification signal only, not tier completion proof
```

Impact:

- Today Decision suggested amount is based on manual-buy candidates.
- Wallet ownership may show warning/context, but cannot reduce suggested amount by itself.
- Future Wallet delta detection should create Pending events only after quantity increase is detected and matched to a decision.
