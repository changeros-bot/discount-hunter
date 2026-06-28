# DCA 折價獵人 Architecture

Last updated: 2026-06-29
Production: https://discount-hunter-sigma.vercel.app

---

## Purpose

DCA 折價獵人 is a mobile-first xStocks decision dashboard. The user should be able to open the app and understand within 30 seconds:

1. Whether there is a buy point.
2. Which symbol needs attention.
3. Which layer is active.
4. Whether Wallet already holds it.
5. Whether Ledger has recorded it.

---

## High-level flow

```text
Prices
  -> Today Decisions
  -> Dashboard

Wallet Live
  -> Holdings
  -> Cost Basis / PnL
  -> Ledger Reconcile

Ledger
  -> Completed layers
  -> Decision suppression
  -> Dashboard sections

Notification Engine
  -> Telegram
  -> Future App Push
```

---

## Core frontend

- `pages/index.js` imports `pages/v16-full.js`.
- `pages/v16-full.js` is the main dashboard.
- `pages/_app.js` provides global metadata and homepage-only helper panels.

Dashboard sections:

- 今日決策
- 鏈上持倉
- 已登帳持倉區
- 觀察區
- Ledger 檢查
- Homepage-only panels: 更新紀錄, Telegram 測試, 持倉分布, 歷史紀錄

---

## Core backend APIs

- `/api/prices` — xStocks price and signal data.
- `/api/sync-wallet` — live BNB Chain wallet holdings and cost basis.
- `/api/buy-ledger` — ledger read endpoint.
- `/api/today-decisions` — POST-based decision calculation.
- `/api/reconcile-tiers` — reconcile live holdings into ledger layers.
- `/api/telegram-alerts` — notification event engine.
- `/api/daily-position-report` — daily position report.
- `/api/daily-position` — alias for daily position report.
- `/api/v16-status` — release health gate.

---

## Shared libraries

- `lib/v16-ledger.js` — ledger and alert state functions.
- `lib/v16-health.js` — shared health gate.
- `lib/telegram/notify.js` — Telegram transport.
- `lib/xstocks/*` — price, transfer, cost basis, RPC balance helpers.

---

## State sources

| State | Source |
|---|---|
| Current holdings | BNB Chain RPC `balanceOf()` |
| Cost basis | transfer history + fallback first layer cost |
| Price | Binance xStocks / reference stock price providers |
| Ledger | durable KV state |
| Alert state | durable KV state |

---

## Key architecture principles

- Wallet Live is the current-holding source of truth.
- Ledger records completed buy layers, not current wallet ownership by itself.
- Price engine triggers decisions; Ledger suppresses completed layers.
- Notifications are shared events first, then delivered to channels.
- Health checks must use `lib/v16-health.js`.
