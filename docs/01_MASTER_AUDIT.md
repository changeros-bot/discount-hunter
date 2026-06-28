# DCA 折價獵人 Master Audit

Last updated: 2026-06-29
Production: https://discount-hunter-sigma.vercel.app

This file is the master audit record. Earlier audits are reconstructed from code, commits, deployment state, and verified screenshots. Audit-021 onward must be maintained as live engineering records.

---

## Audit status

| Audit | Topic | Status | Notes |
|---|---|---:|---|
| 001 | Project baseline | Reconstructed | Next.js / Vercel project baseline established. |
| 002 | Price engine | PASS | `/api/prices` returns 9 xStocks and signal data. |
| 003 | Watchlist scope | PASS | xStocks scope confirmed; no new assets without user approval. |
| 004 | Wallet Live source | PASS | Live BNB Chain `balanceOf()` is source of truth. |
| 005 | Cost basis fallback | PASS | Missing cost basis uses visible fallback instead of hiding capital. |
| 006 | Ledger storage | PASS | Ledger reads from durable state and feeds decisions/UI. |
| 007 | Today decisions | PASS | POST-based decision calculation integrated into homepage. |
| 008 | Manual buy safety | Partial | Needs continued idempotency regression before RC. |
| 009 | Homepage dashboard | PASS | Production homepage loads dashboard. |
| 010 | Section split | PASS | D1-D4 attention section + observation section = 9 symbols. |
| 011 | Reconcile tiers safety | PASS | Reconcile requires live wallet holdings. |
| 012 | Legacy alert portal | PASS | Old global alert portal removed. |
| 013 | V16 status | PASS | `/api/v16-status` is release health gate. |
| 014 | Daily position | PASS | Daily position report returns live wallet summary. |
| 015 | Telegram transport | PASS | Telegram delivery verified. |
| 016 | Telegram event rules | PASS | Near, trigger, retreat, new-high events implemented. |
| 017 | Telegram dedupe | PASS | Cooldown/dedupe active through alert state. |
| 018 | Changelog panel | PASS | Dashboard changelog exists and is homepage-only. |
| 019 | Shared Health Gate | PASS | `lib/v16-health.js` used by telegram/status paths. |
| 020 | Production domain | PASS | Production domain confirmed: discount-hunter-sigma. |
| 021 | Notification / Health Gate | PASS | SOP + shared health gate completed. |
| 022 | Dashboard 404 panels | PASS | Global panels restricted to dashboard routes. |
| 023 | Daily position alias | PASS | `/api/daily-position` alias added. |
| 024 | Homepage semantics | PASS | User confirmed 4+5 split is correct. |
| 025 | Regression audit | IN PROGRESS | API/UI final regression underway. |
| 026 | Documentation freeze | IN PROGRESS | Master docs being created. |
| 027 | V16 RC | PENDING | Requires Audit-025 and Audit-026 PASS. |

---

## Key verified commits

- `d9a9c13` — reconcile requires live wallet source.
- `ecd68c3` — remove legacy global buy alert portal.
- `b84b82e` — force live wallet sync before reconcile.
- `dcb020d` — add notification SOP.
- `5192688` — implement notification event rules.
- `cdc6f9d` — highest near alert only.
- `a691bb9` — add new-high notification.
- `1a56599` — add shared V16 health gate.
- `34a7fce` — telegram-alerts uses shared health gate.
- `bb5c359` — v16-status uses shared health gate.
- `5fda4e4` — add daily-position alias.
- `9b64ece` — dashboard panels only on homepage.
- `319de40` — add initial audit log.

---

## Current Audit-025 regression targets

Must pass before V16 RC:

1. `/api/prices`
2. `/api/sync-wallet`
3. `/api/buy-ledger`
4. `/api/today-decisions` POST path
5. `/api/telegram-alerts`
6. `/api/daily-position`
7. `/api/v16-status`
8. Homepage UI

Current verified PASS from user screenshots:

- `/api/prices`
- `/api/sync-wallet`
- `/api/daily-position`
- `/api/v16-status`
- Homepage UI

Remaining:

- `/api/buy-ledger`
- `/api/today-decisions` POST path
- `/api/telegram-alerts` after shared health gate

---

## Audit rule

No audit item may be marked PASS unless there is production evidence, a user screenshot, a commit, or a direct code inspection proving it.
