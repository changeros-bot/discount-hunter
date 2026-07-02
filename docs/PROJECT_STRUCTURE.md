# PROJECT_STRUCTURE.md

## Current Line

```text
V17 Oracle Production Candidate
```

## Top Level

```text
pages/        Next.js pages and API routes
lib/          Core business logic and providers
components/   UI components
public/       Static assets
styles/       CSS
scripts/      Operations scripts
docs/         Runbooks, handoff, recovery, release docs
```

## Runtime Services

```text
discount-hunter        Next.js app, port 3000
oracle-binance-proxy   Binance proxy, port 3001
```

## Key API Routes

```text
pages/api/prices.js
pages/api/binance-exchange-position.js
pages/api/sync-wallet.js
pages/api/debug-transfers.js
pages/api/debug-live-holdings.js
pages/api/debug-pnl.js
pages/api/v17/health.js
pages/api/v17/decisions.js
pages/api/v17/events.js
pages/api/v17/action-state.js
```

## Key Libraries

```text
lib/v17/binance-exchange-provider.js
lib/state/kv.js
lib/xstocks/transfer-source.js
lib/xstocks/rpcBalances.js
lib/telegram/notify.js
```

## Data Flow

```text
Mobile browser
  -> /v17
  -> API routes
  -> Upstash Redis REST
  -> Oracle Binance Proxy
  -> Binance API
  -> BSC wallet balanceOf
```

## Storage Rule

Production mutable V17 state must use durable storage.

```text
Upstash Redis REST = required
runtime file writes = not allowed for production mutable state
```

## Current Verified Providers

```text
BTC Binance account sync: working
BTC live market price: working
BSC wallet live balance: working
xStocks live price: working
```

## Current Known Gap

```text
xStocks cost basis still needs transfer-history provider.
Moralis / NodeReal / MegaNode should be integrated next.
```

## Module Responsibility Rule

Before changing a module:

1. Identify its owner responsibility.
2. Confirm no existing module already owns the behavior.
3. Add or run regression checks.
4. Do not mix Investment Engine and Tactical Engine cost basis.
5. Do not move wallet or ledger logic into UI rendering.
