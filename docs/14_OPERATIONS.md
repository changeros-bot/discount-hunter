# DCA 折價獵人 Operations Runbook

Last updated: 2026-06-29
Production: https://discount-hunter-sigma.vercel.app

---

## Daily checks

1. Open production homepage.
2. Confirm Wallet shows LIVE.
3. Confirm `/api/v16-status` is healthy.
4. Confirm `/api/prices` returns tracked symbols.
5. Confirm `/api/sync-wallet` returns live holdings.
6. Confirm no unexpected Telegram spam.

---

## Weekly checks

1. Review Vercel deployments.
2. Review GitHub commits and docs updated.
3. Run regression checklist from `09_TEST_PLAN.md`.
4. Check Telegram notification behavior.
5. Check daily position report.
6. Confirm no stale preview domains are being used.

---

## Deployment procedure

1. Commit code and documentation.
2. Wait for Vercel deployment.
3. Confirm deployment is Production and Ready.
4. Validate production URL.
5. Run `/api/v16-status`.
6. Validate homepage.
7. Record result in `01_MASTER_AUDIT.md` or `10_CHANGELOG.md` if release-impacting.

---

## Rollback procedure

1. Identify last known good commit.
2. Use Vercel rollback or redeploy from GitHub if needed.
3. Verify `/api/v16-status`.
4. Verify homepage.
5. Record incident in `06_TROUBLESHOOTING.md`.

---

## Telegram operations

Manual transport test:

```text
/api/telegram-test
```

Alert engine test:

```text
/api/telegram-alerts
```

Rules:

- Do not repeatedly force Telegram tests unless needed.
- Use cooldown/dedupe routes for normal checks.
- Record false alerts in troubleshooting.

---

## Wallet operations

Wallet sync test:

```text
/api/sync-wallet
```

Pass criteria:

- live holdings found
- live balance source present
- cost/value/PnL present

If wallet sync fails:

1. Check environment wallet address.
2. Check RPC provider.
3. Check transfer source provider.
4. Do not reconcile ledger until wallet is healthy.

---

## Release candidate procedure

Before V16 RC:

1. Audit-025 PASS.
2. Audit-026 PASS.
3. `/api/v16-status` healthy.
4. Homepage stable on mobile.
5. Master docs updated.
6. No P0/P1 open issues.

After RC:

- Do not modify core logic unless P0/P1 bug is found.
- New features move to V17 planning.

---

## Documentation maintenance

After every meaningful change:

- Update `01_MASTER_AUDIT.md`.
- Update `02_MASTER_SOP.md` if workflow changed.
- Update `05_RELEASE_NOTES.md` if release-impacting.
- Update `06_TROUBLESHOOTING.md` if a new bug pattern was found.
- Update `10_CHANGELOG.md` for visible or operational changes.
