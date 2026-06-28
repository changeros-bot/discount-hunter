# DCA 折價獵人 Test Plan

Last updated: 2026-06-29
Production: https://discount-hunter-sigma.vercel.app

---

## Purpose

This test plan defines the minimum validation needed before V16 RC.

---

## Regression checklist

### 1. Prices

URL:

```text
/api/prices
```

Pass criteria:

- `ok: true`
- `status: PASS`
- tracked symbol count is non-zero
- price, high, discount, and signal fields exist

---

### 2. Sync Wallet

URL:

```text
/api/sync-wallet
```

Pass criteria:

- `ok: true`
- `holdings` exists
- live holdings exist
- `quantitySource = bsc_rpc_balanceOf_live` for live rows
- cost/value/PnL fields exist

---

### 3. Buy Ledger

URL:

```text
/api/buy-ledger
```

Pass criteria:

- `ok: true`
- `ledger` exists
- no corrupted JSON

---

### 4. Today Decisions

URL:

```text
/api/today-decisions
```

Method: POST

Input:

- assets from `/api/prices`
- ledger from `/api/buy-ledger`

Pass criteria:

- `ok: true`
- decisions array exists
- no duplicate symbol/tier rows
- ledger-completed tiers are excluded

---

### 5. Telegram Alerts

URL:

```text
/api/telegram-alerts
```

Pass criteria:

- route uses shared health gate
- no false wallet error when `/api/sync-wallet` is healthy
- eventCount and sendableCount behave as expected
- dedupe prevents repeated spam

---

### 6. Daily Position

URLs:

```text
/api/daily-position-report
/api/daily-position
```

Pass criteria:

- both routes work
- report has total cost, market value, PnL, and details
- GET preview does not force-send Telegram

---

### 7. V16 Status

URL:

```text
/api/v16-status
```

Pass criteria:

- `ok: true`
- `pricesOk: true`
- `walletOk: true`
- `releaseBlocked: false`

---

### 8. Homepage UI

URL:

```text
/
```

Pass criteria:

- page loads on production domain
- Wallet shows LIVE
- Ledger check shows PASS or clear reason
- 今日決策 is visible
- D1-D4 attention section and observation section are not duplicated
- dashboard helper panels appear only on homepage

---

## Failure handling

When a test fails:

1. Record route, screenshot/log, and time.
2. Identify whether it is domain, deployment, API, data, or UI.
3. Fix only the minimum required issue.
4. Update `01_MASTER_AUDIT.md` and `06_TROUBLESHOOTING.md` if the issue is new.
5. Re-run the failed test and related regression checks.
