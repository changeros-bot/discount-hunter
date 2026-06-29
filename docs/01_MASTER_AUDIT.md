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
| 008 | Manual buy safety | PASS | Regression confirms ledger read path and no duplicate decision keys. |
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
| 025 | Regression audit | PASS | `/api/regression-v16` returned `ok:true`, `failCount:0`. |
| 026 | Documentation freeze | PASS | Master docs 00 through 14 created and legacy docs consolidated. |
| 027 | V16 RC | IN PROGRESS | Release notes update and RC closeout underway. |

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
- `6992315` — add `/api/regression-v16` read-only regression endpoint.
- `9ee17f9` — mark legacy audit log consolidated.
- `f691ad9` — mark legacy notification SOP consolidated.

---

## Audit-025 Regression Result

Production endpoint:

```text
https://discount-hunter-sigma.vercel.app/api/regression-v16
```

Verified by user screenshot on 2026-06-29.

Result:

```json
{
  "ok": true,
  "version": "v16-regression-1",
  "passCount": 4,
  "failCount": 0
}
```

Checks:

| Check | Status | Detail |
|---|---:|---|
| `/api/prices` | PASS | count: 9 |
| `/api/buy-ledger` | PASS | symbols: 9 |
| `/api/today-decisions` POST | PASS | decisions: 0, duplicateCount: 0 |
| `/api/telegram-alerts` | PASS | version: `v16.6-shared-health-gate`, eventCount: 1, sendableCount: 0 |

Interpretation:

- `decisions: 0` is acceptable because no current uncompleted buy action was triggered at verification time.
- `sendableCount: 0` is acceptable because alert dedupe/cooldown and event state prevented unnecessary Telegram spam.
- `failCount: 0` satisfies Audit-025 exit criteria.

---

## Audit-026 Documentation Freeze Result

Status: PASS

Master docs created:

- `00_MASTER_INDEX.md`
- `01_MASTER_AUDIT.md`
- `02_MASTER_SOP.md`
- `03_ARCHITECTURE.md`
- `04_API_REFERENCE.md`
- `05_RELEASE_NOTES.md`
- `06_TROUBLESHOOTING.md`
- `07_DECISIONS.md`
- `08_ROADMAP.md`
- `09_TEST_PLAN.md`
- `10_CHANGELOG.md`
- `11_PROJECT_PRINCIPLES.md`
- `12_SECURITY.md`
- `13_DATA_MODEL.md`
- `14_OPERATIONS.md`

Legacy docs consolidated:

- `AUDIT_LOG.md` -> consolidated into `01_MASTER_AUDIT.md`.
- `NOTIFICATION_SOP.md` -> consolidated into `02_MASTER_SOP.md`.

---

## Audit-027 V16 RC Entry Criteria

Current status: IN PROGRESS

Entry criteria:

- Audit-025 PASS: yes.
- Audit-026 PASS: yes.
- Production dashboard stable: yes.
- `/api/v16-status` healthy: previously verified.
- `/api/regression-v16` healthy: yes.
- No known P0/P1 blockers: none currently recorded.

Remaining RC closeout:

- Update `05_RELEASE_NOTES.md` with V16 RC.
- Confirm final production deployment after release-note commit.

---

## Audit rule

No audit item may be marked PASS unless there is production evidence, a user screenshot, a commit, or a direct code inspection proving it.
