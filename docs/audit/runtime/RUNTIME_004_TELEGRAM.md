# RUNTIME-004 Telegram Validation

Date: 2026-06-27
Status: PENDING - BLOCKED BY DURABLE STATE CONFIG FOR COOLDOWN SENDS

## Scope

Validate live Telegram behavior:

- GET preview-only endpoints do not send messages.
- POST or explicit query flag is required for send.
- Cooldown-gated sends require durable state in production.
- Duplicate sends inside cooldown are skipped/deduped.
- Manual telegram test remains POST-only.

## Current Runtime Constraint

Live `/api/v16-status` shows:

```text
storage: missing_required_upstash_kv
durableStateOk: false
requiresDurableKv: true
hasKvConfig: false
releaseBlocked: true
```

Therefore cooldown-gated Telegram sends should be blocked before sending.

This is expected and intentional.

## Expected Current Behavior Before Upstash Is Configured

### Preview-only GET endpoints

These should not send Telegram:

```text
GET /api/telegram-daily
GET /api/daily-summary
GET /api/daily-position-report
GET /api/wallet-alerts
GET /api/wallet-change-alerts
GET /api/telegram-test
```

Expected:

```json
{
  "previewOnly": true,
  "sent": false
}
```

or equivalent no-send response.

### Cooldown-gated POST/send endpoints

These should not send while Upstash is missing:

```text
POST /api/telegram-daily
POST /api/daily-summary
POST /api/daily-position-report
POST /api/wallet-alerts
POST /api/wallet-change-alerts?commit=1
```

Expected error:

```text
missing_required_upstash_kv_for_telegram_cooldown
```

Reason:

Production must not send cooldown-gated Telegram messages unless cooldown state can be durably recorded.

### Manual Telegram Test

```text
GET /api/telegram-test
```

Expected:

- no Telegram send
- preview/instruction response only

```text
POST /api/telegram-test
```

Expected after Telegram env is configured:

- sends one manual test message
- no cooldown required because it is a manual transport test

## Full Validation After Upstash Is Configured

1. POST one cooldown-gated endpoint.
2. Confirm Telegram received.
3. Repeat same endpoint within cooldown.
4. Confirm second response is skipped/deduped.
5. Confirm no duplicate Telegram message.

## Runtime Result So Far

Source-level protections are in place.

Live Telegram runtime validation is still pending because durable state is not configured.

## Release Status

Telegram runtime validation remains pending.

V16 must not be marked release-ready until:

- Upstash KV is configured, or
- Release policy explicitly accepts disabling cooldown-gated Telegram sends.
