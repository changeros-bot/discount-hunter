# V17_TRANSFER_PACKAGE.md

## Purpose

This is the fast handoff package for moving Discount Hunter V17 to another server, cloud, or AI operator.

## Read First

```text
docs/PROJECT_STATE.md
docs/AI_HANDOFF.md
docs/MIGRATION_PLAYBOOK.md
docs/DEPLOY_CHECKLIST.md
docs/TROUBLESHOOTING.md
```

## Current Runtime

```text
App service: discount-hunter
Proxy service: oracle-binance-proxy
App port: 3000
Proxy port: 3001
Storage: Upstash Redis REST
Process manager: PM2
```

## Critical Data

```text
GitHub repository: changeros-bot/discount-hunter
Wallet address: 0x657f5cbBC1FBE274299a6be52b5e46C3C6a9AD76
Runtime env file: ~/discount-hunter/.env.local
```

## Transfer Steps

```text
1. Provision new Ubuntu server.
2. Open SSH, app port, proxy port.
3. Install Node.js and PM2.
4. Clone repository.
5. Restore runtime env file from secure source.
6. Build app.
7. Start app with PM2.
8. Start Binance proxy with PM2.
9. Run verification script.
10. Open mobile UI.
```

## Verification Script

```bash
bash scripts/verify-all.sh
```

## Final Checks

```text
V17 health returns durable storage.
Binance provider is configured.
Wallet provider is configured.
BTC market price is non-zero.
xStocks wallet holdings are non-zero.
Mobile /v17 loads.
```

## Do Not Transfer Through Chat

```text
Runtime secret values
Private SSH key
Binance API secret
Upstash REST token
```
