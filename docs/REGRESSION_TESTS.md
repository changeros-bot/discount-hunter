# Regression Tests

## Purpose

Regression tests protect V16/V17 from repeating already-fixed bugs.

Every bug fix should either:

- add a regression case, or
- explicitly state why no regression is needed.

## Release gate

Before release:

```text
/api/regression-v16
```

must return:

```json
{ "ok": true, "failCount": 0 }
```

## Required regression areas

### 1. Price source

- Price API returns non-empty asset list.
- Each asset has symbol, price, high, discount, rules, and amounts.
- No silent fallback to fake data unless explicitly marked.

### 2. Today Decision

- D1-D4 trigger correctly from discount depth.
- Duplicate decisions are removed.
- Ledger-completed tiers are excluded.
- Pending purchases are not counted as manual-buy candidates.

### 3. Ledger

- Ledger can read symbol variants, e.g. `NVDA`, `NVDAon`, `NVDAON`.
- Done tiers are correctly detected.
- V17 must include pending-tier regression:

```text
signalLevel = 3
ledgerDoneTiers = [D1]
expected pendingTiers = [D2, D3]
```

### 4. Wallet

- Wallet live holdings must come from real source.
- Wallet ownership does not automatically mean a tier is bought.
- Wallet comparison must normalize symbols consistently.

### 5. Suggested amount

V17 must include these cases:

```text
manual-buy: MRVL D1 5U
expected suggestedAmount = 5U
```

```text
manual-buy: MRVL D1 5U
manual-buy: AMD D2 10U
pending purchase: TSM D1 5U
expected suggestedAmount = 15U
```

### 6. UI summary

- `可手動買入` count matches executable decisions.
- `已買入待補登` count matches pending purchases.
- `建議新增投入` equals executable decision amount sum.

### 7. Telegram / Notification

- Notification payload uses the same decision state as homepage.
- No duplicate notifications for the same symbol/tier/event.
- Pending purchase state is clearly labeled.

## Bug-to-regression rule

When a bug is found:

1. Write a minimal reproduction.
2. Add a regression case.
3. Fix the code.
4. Run regression.
5. Only then close the issue.

## V17 migration rule

After each migrated module:

- run regression
- compare V16 and V17 behavior
- document intentional behavior changes
