# DEPLOY_CHECKLIST.md

## Deploy Checklist

```text
[ ] git pull
[ ] npm install
[ ] npm run build
[ ] pm2 restart discount-hunter --update-env
[ ] pm2 restart oracle-binance-proxy
[ ] pm2 save
[ ] verify proxy health
[ ] verify v17 health
[ ] verify prices
[ ] verify Binance account position
[ ] verify wallet sync
[ ] open mobile UI /v17
```

## Commands

```bash
cd ~/discount-hunter
git pull
npm install
npm run build
pm2 restart discount-hunter --update-env
pm2 save
```

## Verification

```bash
curl http://localhost:3001/health
curl http://localhost:3000/api/v17/health
curl http://localhost:3000/api/prices
curl http://localhost:3000/api/binance-exchange-position
curl http://localhost:3000/api/sync-wallet
```

## Pass Criteria

```text
proxy ok
storage durable
Binance configured
wallet configured
BTC market price greater than zero
wallet holdings count greater than zero
mobile UI loads
```
