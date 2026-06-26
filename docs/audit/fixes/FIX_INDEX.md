# DCA 折價獵人 V16 Fix Phase Index

Date: 2026-06-27
Status: FIX PHASE SOURCE-LEVEL COMPLETE FOR CURRENT QUEUE
Phase: Fix-and-Release Hardening

## Purpose

This index summarizes all Fix Phase items completed after Architecture Audit and Audit Consistency Check.

Current phase flow:

```text
Architecture Audit 22/22
↓
Audit Consistency Check
↓
Fix Phase source-level fixes
↓
Regression Audit
↓
Runtime Validation
↓
Repository Cleanup
↓
V16 Release
```

## Fix Summary

| Fix ID | File | Severity | Status | Result |
|---|---|---:|---|---|
| FIX-001 | `FIX_001_P0_HIDDEN_WRITE.md` | P0 | Source verified | `today-decisions` hidden write neutralized |
| FIX-002 | `FIX_002_P0_RECONCILE_LEDGER_LEGACY.md` | P0 | Source verified | legacy D1-only writer disabled |
| FIX-003 | `FIX_003_P1_MANUAL_BUY_IDEMPOTENCY.md` | P1 | Source verified | duplicate same-tier append blocked |
| FIX-004 | `FIX_004_P1_DURABLE_STATE_GATE.md` | P1 | Source verified, runtime pending | production volatile state fallback blocked |
| FIX-005 | `FIX_005_P1_RECONCILE_UPSTREAM_GATING.md` | P1/P2 | Source verified | price/wallet upstream gating added before reconcile |
| FIX-006 | `FIX_006_P1_V16_HEALTH_GATE.md` | P1 | Source verified, runtime pending | v16 health gate expanded |
| FIX-007 | `FIX_007_P1_TELEGRAM_COOLDOWN_GATE.md` | P1 | Source verified, runtime pending | main Telegram alert cooldown/dedup added |

## Commits

### FIX-001 P0 Hidden Write

- `a3b4d6cafe46a83b3ccfe03374c2112b00e7505e`
- `1d3b6981690539a209ecdaa2513be0635c9bf1b2`
- `60492209a6f973ac6138d1aef632db2e0148c80b`

### FIX-002 P0 Legacy Reconcile Ledger

- `3b53e118066a50ea512dbbd092f5282b1511da95`
- `866a1839b8b72b4df52fb096e8e22ef015d3e1a2`

### FIX-003 P1 Manual Buy Idempotency

- `accf418d49fb0dbb0fff5dae0b05129b97084054`
- `43bdefa34f014237dc0320beb68c60647f01defe`
- `f2cf2916611147131405824e65d39f440fb30c6d`
- `4b1bce2f663ef350a2b14077322155286936d2cf`

### FIX-004 P1 Durable State Gate

- `d5d11dce56b6f411bd96bd6e5c0f179cfe930d72`
- `b2b26747ace4033d80b1130e174f2b9da487ea08`
- `f00e346b58c37543ca2a96156b19c0b6166f2088`
- `5da2203f173e47aeecc530d69d1526eceb5d834c`

### FIX-005 P1 Reconcile Upstream Gating

- `ad2f0ee6e9b7a573472583cdaf8b3e771e04244a`
- `d9c40d4c1b7bbefce15880b3d79c367d04a80d45`
- `e457bbd602031cfcc16ab49db6b599032a1b9783`

### FIX-006 P1 V16 Health Gate

- `2376d9592370e0013a5b9232a37fd2a1866a8c62`
- `a8e3cb8ee0c04138c0f5db725d76d3800f5f75cd`
- `b15956e91e303a08a5a9a19d9e1c8f8169b7cc02`

### FIX-007 P1 Telegram Cooldown Gate

- `8749ada132ed4af65b39df6e790e9846ff168ea4`
- `6a557394caac63f86e05ab766ac5377fd7b6caa4`
- `c5a422af5e32d89387d961bf013a10c4be9c19ed`

## Current Source-Level Result

The current P0/P1 safety queue is source-level fixed.

Resolved at source level:

1. Decision/read endpoint hidden write.
2. Legacy D1-only reconcile writer.
3. Manual same-tier duplicate Ledger writes.
4. Production volatile state fallback.
5. Reconcile using incomplete price/wallet upstream inputs.
6. Partial v16-status health gate coverage.
7. Main Telegram alert duplicate send risk.

## Still Required Before Release

These are not optional:

1. Regression Audit.
2. Runtime Validation.
3. Repository Cleanup.
4. Final Release Gate.

## Minimum Regression Scope

Regression must verify:

- `/api/today-decisions` POST with posted Ledger.
- `/api/today-decisions` POST without posted Ledger remains read-only.
- `v16-manual` load path.
- `v16-full` load path.
- `/api/reconcile-ledger` returns 410.
- `/api/manual-buy` duplicate D1-D4 returns duplicate without write.
- `/api/buy-ledger` duplicate D1-D4 returns duplicate without write.
- `N` tier still allows repeated DCA writes.
- Production/Vercel without Upstash blocks writes.
- Local fallback still works outside production.
- `/api/reconcile-tiers` rejects empty assets/holdings.
- `/api/reconcile-tiers` dry-run does not write Ledger.
- `/api/v16-status` reports critical release blockers.
- `/api/telegram-alerts` cooldown/dedup works.

## Runtime Validation Required

Runtime validation must verify:

- Vercel env vars exist.
- Upstash Redis env vars exist in production.
- Telegram token/chat id exist.
- Wallet address exists and is valid.
- Real wallet sync works.
- Prices endpoint works.
- Reconcile dry-run works.
- Telegram alert can send once and dedup repeated trigger.

## Next Phase

Proceed to Regression Audit.

Suggested first file:

```text
docs/audit/regression/REGRESSION_INDEX.md
```

Suggested first run:

```text
REGRESSION_001_CORE_API.md
```
