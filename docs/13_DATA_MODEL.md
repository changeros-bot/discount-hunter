# DCA 折價獵人 Data Model

Last updated: 2026-06-29

---

## Price row

Source: `/api/prices`

Typical fields:

- `symbol`
- `name`
- `price`
- `high`
- `discount`
- `grade`
- `rules`
- `amounts`
- `signal`

Use:

- decision calculation
- dashboard cards
- notification events

---

## Wallet holding

Source: `/api/sync-wallet`

Important fields:

- `symbol`
- `quantity`
- `quantitySource`
- `totalCost`
- `averageCost`
- `currentValue`
- `unrealizedPnL`
- `pnlPct`
- `costBasisSource`
- `costBasisEstimated`
- `liveBalanceContractAddress`

Required live source:

```text
bsc_rpc_balanceOf_live
```

---

## Ledger

Source: `/api/buy-ledger`

Shape:

```text
ledger[symbol][tier] = rows[]
```

Purpose:

- record completed D1-D4 buy layers
- suppress duplicate decisions
- support reconcile and audit

---

## Today Decision

Source: `/api/today-decisions` POST

Typical fields:

- `symbol`
- `tier`
- `level`
- `amount`
- `discount`
- `triggeredAt`

Rules:

- decision key is symbol + tier
- duplicate keys should be deduped
- completed ledger tiers should be excluded

---

## Notification Event

Source: `/api/telegram-alerts`

Typical fields:

- `type`
- `symbol`
- `fromLevel`
- `toLevel`
- `threshold`
- `key`

Event types:

- `near`
- `trigger`
- `retreat`
- `new_high`

Key format:

```text
notification:{channel}:{type}:{symbol}:{fromLayer}:{toLayer}:{threshold}
```

---

## Health Summary

Source: `lib/v16-health.js`

Typical fields:

- `pricesOk`
- `walletOk`
- `pricesCount`
- `walletHoldingsCount`
- `liveBalanceHoldingsCount`
- `selectedLiveBalanceHoldingsCount`

Use:

- `/api/v16-status`
- `/api/telegram-alerts`
- future app push health checks

---

## Daily Position Report

Source: `/api/daily-position-report` and `/api/daily-position`

Typical fields:

- `totalCost`
- `marketValue`
- `pnl`
- `pnlPct`
- `details`
- `text`

Use:

- daily position preview
- optional Telegram daily report
