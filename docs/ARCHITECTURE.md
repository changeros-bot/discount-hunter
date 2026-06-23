# Architecture

Last updated: 2026-06-23

## System purpose

DCA 折價獵人是一個手機優先的 30 秒決策儀表板，用於監控 Binance xStocks / tokenized stock 的折價買點、鏈上持倉、Telegram 買點警報。

## Main data flow

```text
/api/prices
↓
Asset prices + rules + amounts
↓
Homepage cards
↓
Telegram alerts
```

```text
Wallet address
↓
/api/sync-wallet
↓
BSC RPC balanceOf()
↓
Live holdings
↓
Cost basis from transfer/swap history
↓
Merged holdings
↓
Homepage wallet summary
↓
Telegram completed level logic
```

## APIs

### /api/prices

Provides:

```text
symbol
name
price
high
highType
discount
rules
amounts
signal
```

### /api/sync-wallet

Provides current wallet and portfolio state.

Source of truth for current holdings:

```text
BSC RPC balanceOf()
```

Cost basis source:

```text
transfer / swap history
```

Important debug fields:

```text
liveBalanceSymbols
selectedLiveBalanceSymbols
holdingSymbols
estimatedCostBasisSymbols
liveBalanceErrors
holdingPriceDebug
```

### /api/telegram-alerts

Reads:

```text
/api/prices
/api/sync-wallet
```

Calculates:

```text
completedLevel
next target level
remaining distance
absolute progress
layer-based emoji
```

Sends Telegram message through:

```text
lib/telegram/notify
```

## CSS load order

Current `_app.js` CSS order:

```text
globals.css
v10.css
title-gold.css
hero-poster.css
v15-unified.css
v15-fix.css
v15-color-force.css
```

Important: `v15-unified.css` contains strong global overrides with `!important`, including white text rules. `v15-color-force.css` must stay last to preserve red/green signed values.

## Future architecture: Wallet Execution Sync

Target V15.37:

```text
Previous wallet snapshot
↓
Current wallet snapshot
↓
Diff by symbol
↓
Detect buy / sell / add
↓
Map to completed layer
↓
Homepage recent actions
↓
Telegram buy-complete notification
```

Required persistent state options:

```text
Vercel KV / Upstash Redis / Cloudflare KV / simple JSON endpoint
```

Potential keys:

```text
lastSnapshot:<wallet>
lastBuyAction:<symbol>
lastNotifiedCompletedLevel:<symbol>
```

