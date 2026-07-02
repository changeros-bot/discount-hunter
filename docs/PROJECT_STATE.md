# PROJECT_STATE.md

## Current Version

```text
V17 Oracle Production Candidate
```

## Server

```text
Provider: Oracle OCI
Runtime: Ubuntu 24.04
App Port: 3000
Proxy Port: 3001
Process Manager: PM2
```

## PM2 Services

```text
discount-hunter
oracle-binance-proxy
```

## Storage

```text
Upstash Redis REST
Production mutable state must use durable storage.
```

## Connected Providers

```text
Binance read-only account sync: connected
Oracle Binance proxy: connected
BSC wallet live balance sync: connected
xStocks live price source: connected
```

## Verified Features

```text
BTC account quantity
BTC average cost
BTC live price
BTC market value
BTC unrealized PnL
xStocks live wallet balance
xStocks live market value
V17 mobile UI
PM2 production start
```

## Pending

```text
xStocks transfer history provider
real xStocks cost basis
Moralis / NodeReal / MegaNode integration
Telegram decision push
four V17 state-machine self-test failures
HTTPS / domain binding
secret rotation before final seal
```

## Primary Verification Commands

```bash
curl http://localhost:3001/health
curl http://localhost:3000/api/v17/health
curl http://localhost:3000/api/binance-exchange-position
curl http://localhost:3000/api/sync-wallet
curl http://localhost:3000/api/debug-transfers
```
