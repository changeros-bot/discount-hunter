# V16 Regression - Runtime Gates / Environment / Release Blockers

Date: 2026-06-27
Status: SOURCE REVIEW COMPLETE

## Scope

Reviewed runtime gate behavior for:

- durable state
- Vercel / production fallback blocking
- Telegram config
- Telegram cooldown persistence
- release blocker reporting

## Checks

| Item | Result |
|---|---|
| Production/Vercel requires Upstash for durable state | PASS |
| `getStorageMode()` reports missing required Upstash | PASS |
| Ledger writer rejects production fallback | PASS |
| `v16-status` reports durable state blocker | PASS |
| Telegram missing token/chat id returns explicit failure | PASS |
| Telegram cooldown sends require durable state in production | PASS after fix |

## Fix Applied In This Segment

File changed:

- `lib/telegram/notify.js`

Problem:

A cooldown-gated Telegram send could send the Telegram message first, then fail while recording cooldown if production lacked Upstash.

Risk:

- Telegram message sent.
- Cooldown not persisted.
- Repeated retries could send duplicates.

Fix:

If a `cooldownKey` is provided and production/Vercel requires durable state but Upstash is missing, `sendTelegramMessage()` now returns before sending:

```text
missing_required_upstash_kv_for_telegram_cooldown
```

Commit:

- `6ce233680764382cd17d71692371d44490bcad8b`

## Runtime Validation Still Required

Validate in deployed environment:

1. Production without Upstash blocks Ledger writes.
2. `/api/v16-status` reports durableState blocker.
3. Telegram alert with cooldownKey does not send if Upstash is missing.
4. Production with Upstash allows send and records cooldown.
5. Repeat send inside cooldown returns deduped/skipped.

## Result

Runtime gate source-level regression review is complete.
