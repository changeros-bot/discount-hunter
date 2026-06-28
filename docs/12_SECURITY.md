# DCA 折價獵人 Security Guide

Last updated: 2026-06-29

---

## Purpose

This file documents security expectations for environment variables, API keys, Telegram credentials, and production operations.

---

## Secrets

Secrets must live in Vercel Environment Variables or trusted provider dashboards.

Do not commit:

- Telegram bot token.
- Telegram chat ID if private.
- RPC provider keys.
- Moralis key.
- MegaNode key.
- Upstash URL or token.
- Wallet private keys.

---

## Wallet rules

The app may read public wallet address holdings.

The app must never require or store:

- private key
- seed phrase
- signing approval
- trading permission

---

## Telegram rules

- Telegram token must be stored only as environment variable.
- Telegram test route is manual only.
- Alert routes must use cooldown/dedupe.
- Avoid public routes that force repeated Telegram sends without cooldown.

---

## RPC provider rules

- Use RPC keys through environment variables.
- If RPC fails, block buy alerts or downgrade them to warning.
- Do not reconcile ledger when live wallet cannot be verified.

---

## Upstash / durable state

Durable state is required for:

- Ledger.
- Alert state.
- Cooldown/dedupe.

Production should not rely on volatile memory state for these workflows.

---

## Environment variable review

Before RC, verify:

- Wallet address configured.
- RPC provider configured.
- Transfer source key configured if required.
- Upstash configured.
- Telegram configured.

---

## Incident rule

If a secret is exposed:

1. Rotate the secret immediately.
2. Remove exposed value from code/docs/logs where possible.
3. Redeploy production.
4. Record incident in `06_TROUBLESHOOTING.md`.
