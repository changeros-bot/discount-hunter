# V16 Regression - Ledger and Manual Buy

Date: 2026-06-27
Status: SOURCE REVIEW COMPLETE

## Scope

Reviewed Ledger append behavior and manual-buy duplicate handling.

## Checks

| Item | Result |
|---|---|
| D1-D4 duplicate prevention | PASS |
| N tier repeated DCA writes | PASS |
| Reopen rule uses leftBuyZone + 24h | PASS |
| `/api/manual-buy` exposes duplicate result | PASS |
| `/api/buy-ledger` exposes duplicate result | PASS |
| Duplicate response avoids misleading Telegram text | PASS |
| GET `/api/buy-ledger` read-only | PASS |

## Source Findings

`appendBuy()` blocks duplicate D1-D4 writes when the tier has not been reopened.

`N` tier is not included in `DIP_TIERS`, so recurring DCA/manual N entries remain appendable.

`manual-buy` returns `replyText` from `buildTelegramText()`. Duplicate rows return:

```text
已存在，未重複登帳
```

`buy-ledger` POST returns:

```json
{
  "message": "buy_record_duplicate_skipped",
  "duplicate": true,
  "storage": "unchanged"
}
```

## Runtime Validation Still Required

Manual runtime test should verify:

1. First D1 write succeeds.
2. Second same-symbol same-tier D1 write returns duplicate.
3. N tier can be written multiple times.
4. v16-manual displays duplicate reply text correctly.

## Result

No additional source fix required in this segment.
