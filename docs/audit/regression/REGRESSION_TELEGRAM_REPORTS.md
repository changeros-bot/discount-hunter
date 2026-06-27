# V16 Regression - Telegram Report Endpoints

Date: 2026-06-27
Status: SOURCE VERIFIED

## Scope

Checked all endpoints that call `sendTelegramMessage()`.

## Result

All Telegram/report endpoints are now classified as one of:

- preview-only on GET
- POST or explicit query flag required to send
- cooldown gated when repeated sends are possible

## Endpoints

| Endpoint | GET behavior | Send trigger | Cooldown |
|---|---|---|---|
| `/api/telegram-alerts` | allowed | alert endpoint call | yes |
| `/api/telegram-daily` | preview only | POST or `send=1` | yes |
| `/api/daily-summary` | preview only | POST or `send=1` | yes |
| `/api/daily-position-report` | preview only | POST or `send=1` | yes |
| `/api/wallet-alerts` | preview only | POST or `notify=1` | yes |
| `/api/wallet-change-alerts` | preview only, no snapshot write | POST or `commit=1` | yes |
| `/api/telegram-test` | preview only | POST only | manual test |

## Commits

- `495d0c13088635c2aed1cc0351d5d94ce10c5691`
- `6db24a75df82472cbba5d507e0f3a354072fe65f`
- `07fc9de4a815bfaa22eb130937a895acedf863d9`
- `afc28ce6a92e0624f6c92be3fe726d937b08f6da`
- `76878adda3caca13aa091501090e02213282eb09`
- `4918ab6a99bbbf7bdbf80e4420dfb672bcd99371`

## Remaining

Runtime validation is still required to confirm Telegram delivery and cooldown persistence in production.
