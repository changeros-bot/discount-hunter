# V16 Regression - Legacy and Debug Endpoints

Date: 2026-06-27
Status: SOURCE REVIEW COMPLETE

## Scope

Reviewed legacy/debug endpoints and pages that may confuse V16 runtime behavior.

## Findings

| Path | Status | Note |
|---|---|---|
| `/` | OK | `pages/index.js` routes to `v16-full` |
| `/debug-wallet` | Debug only | Calls `/api/sync-wallet`; no Ledger write; no Telegram send |
| `/sync-snapshot` | Legacy V15 page | Writes localStorage only and links to `/index-v15`; cleanup candidate |
| `/api/reconcile-ledger` | Disabled | Returns 410 legacy disabled; no Ledger write |
| `/api/wallet-ledger` | Legacy read API | V15.6 compatible read path; no V16 Ledger write |
| `/api/binance-debug` | Debug only | Read-only Binance xStocks debug |
| `/api/debug-live-prices` | Debug only | Read-only price debug |
| `/api/ondo-debug` | Debug naming issue | Read-only; content is Binance xStocks debug; cleanup naming candidate |
| `/api/binance-health` | Read-only health | OK |
| `/api/ondo-health` | Debug naming issue | Read-only; content is Binance xStocks health; cleanup naming candidate |

## Cloudflare Note

Cloudflare Worker code should be retained.

Current assumption from user:

- Cloudflare Worker file remains useful.
- Cron Trigger was previously removed due to free quota concerns.
- Do not treat the Worker file as dead code.
- Do not assume runtime scheduling is active unless Cron Trigger is manually re-enabled.

## Regression Result

No additional source fix required in this segment.

Cleanup phase should decide whether to archive or label V15/debug/ondo-named files.

## Progress

Regression legacy/debug endpoint review complete.
