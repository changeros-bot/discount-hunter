# API_REFERENCE.md

## Core URLs

```text
Web:    http://158.179.185.67:3000
Proxy:  http://158.179.185.67:3001
```

## Health

### V17 health

```bash
curl http://158.179.185.67:3000/api/v17/health
```

用途：檢查 V17 storage、universe、providers、self-test gates。

關鍵成功值：

```text
storage.mode = upstash_kv
storage.durable = true
providers.binanceExchange.configured = true
providers.bscWallet.configured = true
```

### Proxy health

```bash
curl http://158.179.185.67:3001/health
```

用途：檢查 Oracle Binance Proxy 是否在線。

## Prices

```bash
curl http://158.179.185.67:3000/api/prices
```

用途：取得 Universe 價格、BTC cycle high、xStocks live price。

BTC 應包含：

```text
symbol: BTC
price > 0
cycleHigh: 126198
cycleHighDate: 2025-10-07
priceSource: Binance Web BTCUSDT
```

## Binance Exchange BTC

```bash
curl http://158.179.185.67:3000/api/binance-exchange-position
```

用途：讀 Binance Spot account + myTrades，計算 BTC 數量、成本、均價、現值、PnL。

成功標準：

```text
ok: true
configured: true
binanceSignedRequest: success
quantity > 0
averageBuyPrice > 0
marketPrice > 0
currentValue > 0
```

手動帶價格測試：

```bash
curl "http://158.179.185.67:3000/api/binance-exchange-position?btcPrice=60786"
```

## Wallet / xStocks

### Sync wallet

```bash
curl http://158.179.185.67:3000/api/sync-wallet
```

用途：同步 BSC wallet xStocks balanceOf、Binance xStocks live price、市值。

成功標準：

```text
walletAddress: 0x657f...AD76
liveBalanceHoldingsCount > 0
holdingsCount > 0
priceSource: binance_xstocks_live
```

### Debug transfers

```bash
curl http://158.179.185.67:3000/api/debug-transfers
```

用途：檢查 xStocks transfer history 與成本還原。

目前若看到：

```text
totalTransfers: 0
buyRecordCount: 0
```

代表還沒接 Moralis / NodeReal / MegaNode，成本會 fallback 5U。

## V17 UI

```text
http://158.179.185.67:3000/v17
```

用途：手機主畫面。

## V17 action/state endpoints

```bash
curl http://158.179.185.67:3000/api/v17/decisions
curl http://158.179.185.67:3000/api/v17/ui-decisions
curl http://158.179.185.67:3000/api/v17/action-state
curl http://158.179.185.67:3000/api/v17/events
```

用途：Today Decision、action queue、事件狀態。

## Smoke tests

```bash
curl http://158.179.185.67:3000/api/v17/smoke
curl http://158.179.185.67:3000/api/v17/smoke-test
curl http://158.179.185.67:3000/api/v17/self-test
```

注意：self-test 目前仍可能有 4 個邏輯測試失敗，這是程式規則問題，不是部署問題。

## Binance Proxy passthrough

```bash
curl http://158.179.185.67:3001/api/v3/time
curl http://158.179.185.67:3001/api/v3/ticker/price?symbol=BTCUSDT
```

用途：替代 Cloudflare Worker，避免 Binance 451。

Signed request 由 Next.js provider 產生 signature，再透過 proxy 轉發。