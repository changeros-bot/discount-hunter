# FIX-007 P1 Telegram Cooldown Gate

Date: 2026-06-27
Status: FIX APPLIED - SOURCE VERIFIED - PENDING FULL REGRESSION
Phase: Fix-and-Release Hardening

## Scope

Addresses Telegram alert cooldown / dedup release gate for the main buy-point alert path.

## Problem

Before this change, main Telegram alert sending used `sendTelegramMessage(message)` directly.

Risk:

- Repeated cron/manual triggers could send duplicate alerts.
- Price or wallet error alerts could spam the user.
- Existing Alert State existed, but main send flow did not enforce it.

## Files Changed

- `lib/telegram/notify.js`
- `pages/api/telegram-alerts.js`

## Changes

### `lib/telegram/notify.js`

Added optional cooldown support:

- `cooldownKey`
- `cooldownHours`

Behavior:

- If `cooldownKey` is provided, notifier checks Alert State before sending.
- If cooldown is still active, it returns `ok: true`, `skipped: true`, `deduped: true`.
- After a successful send, it records the alert timestamp through `markAlertSent()`.
- Existing calls without `cooldownKey` continue to behave like before.

### `pages/api/telegram-alerts.js`

Main alert path now passes cooldown keys:

- `telegram-alerts:prices-error`
- `telegram-alerts:wallet-error`
- `telegram-alerts:buy-points:{symbol-type-level list}`

Cooldown window:

- 12 hours

Response now includes:

- `sent`
- `deduped`
- `cooldownKey`

## Commits

- `8749ada132ed4af65b39df6e790e9846ff168ea4`
- `6a557394caac63f86e05ab766ac5377fd7b6caa4`

## Source Verification

Confirmed:

- `sendTelegramMessage()` reads Alert State when `cooldownKey` is provided.
- Duplicate calls inside cooldown return deduped without Telegram API send.
- Successful sends mark alert state.
- `telegram-alerts` uses cooldown for prices error, wallet error, and buy-point alert messages.
- `telegram-test` remains unchanged and manual-only.

## Regression Required

Still required:

- First `/api/telegram-alerts` call sends normally when Telegram config exists.
- Second identical call within 12 hours returns deduped/skipped.
- Price error alert has independent cooldown key.
- Wallet error alert has independent cooldown key.
- Alert State writes obey durable state requirement in production.
- Daily/report Telegram endpoints are reviewed during regression/cleanup for duplicate scheduling risk.

## Result

Main Telegram alert cooldown risk is source-level neutralized.

Full regression and runtime validation remain required before release.
