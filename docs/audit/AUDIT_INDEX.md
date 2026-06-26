# DCA 折價獵人 V16 Audit Index

## Status
- Audit-001 Ledger CRUD ✅
- Audit-002 Wallet Flow ✅
- Audit-003 Price Source ✅
- Audit-004 buy-ledger ✅
- Audit-005 manual-buy ✅
- Audit-006 reconcile-tiers ✅
- Audit-007 reconcile-ledger (Legacy) ✅
- Audit-008 today-decisions ✅
- Audit-009 Decision Engine ✅
- Audit-010 Progress Engine ✅
- Audit-011 Telegram Architecture ✅
- Audit-012 Alert State Engine ✅
- Audit-013 v16-full Architecture ✅
- Audit-014 v16-manual Architecture ✅
- Audit-015 v16-status / System Status Architecture ✅
- Audit-016 State Store / KV / File Fallback Architecture ✅

Progress: 16/22 (~73%)

This document is the master index for the V16 architecture audit. Detailed audit reports and issue register will be added incrementally.

## Latest Verified Findings
- Telegram transport layer is clean; risks are in upper-level API flows.
- `telegram-alerts` sends on every call and does not use Alert State cooldown/dedup.
- Alert State Core exists in `lib/v16-ledger.js` but is only used by `/api/telegram-alert-check`.
- Cloudflare Cron Worker code still exists in repo; runtime deployment status remains pending verification.
- `v16-full` does not directly write Ledger, but can trigger Ledger writes through `/api/reconcile-tiers`.
- `v16-full` avoids the `today-decisions` hidden write path by passing an explicit Ledger payload.
- `v16-full` buy-zone grouping uses `/api/prices` price signal, not Ledger actionable state.
- `v16-full` refreshes `loadAll()` every 5 seconds; this is read-heavy but not a Ledger pollution risk.
- `v16-manual` calls `/api/today-decisions` without an explicit Ledger payload, so it can trigger the hidden store-ledger write path.
- `manual-buy` uses the formal `appendBuy()` Ledger writer, but `appendBuy()` is not idempotent and does not prevent duplicate same-tier entries.
- `v16-status` is a partial smoke-test endpoint plus static checklist, not a complete verified system health report.
- `v16-status` runtime checks do not cover critical APIs such as `/api/sync-wallet`, `/api/prices`, `/api/reconcile-tiers`, or `/api/telegram-alerts`.
- Ledger State and Alert State use Upstash KV when configured, otherwise memory/file fallback depending on environment.
- In Production/Vercel without Upstash KV, Ledger State and Alert State fall back to volatile memory.
- Wallet Snapshot State is Upstash-only; without Upstash, `/api/wallet-change-alerts` returns `enabled:false`.
