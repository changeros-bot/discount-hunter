# DISCOUNT_HUNTER_DEPLOYMENT_KIT_v1

> 用途：未來換 GPT、換 SSH App、換 Oracle / VPS、或重新部署 DCA 折價獵人時，直接照本文件執行。

## 0. 目前正式架構

```text
User Android / Browser
  -> Oracle VPS: http://158.179.185.67:3000
  -> Discount Hunter Next.js
  -> Oracle Binance Proxy: http://158.179.185.67:3001
  -> Binance API

xStocks:
  Discount Hunter
  -> BSC RPC balanceOf
  -> Wallet 0x657f...AD76

State:
  Discount Hunter
  -> Upstash Redis REST
```

## 1. 目前主機資料

```text
Host/IP: 158.179.185.67
SSH user: ubuntu
SSH port: 22
SSH key file: ssh-key-2026-07-01.key
Project path: ~/discount-hunter
Proxy path: ~/binance-proxy
```

## 2. PM2 服務

```bash
pm2 status
```

應看到：

```text
discount-hunter        online
oracle-binance-proxy  online
```

重啟：

```bash
pm2 restart discount-hunter --update-env
pm2 restart oracle-binance-proxy
pm2 save
```

## 3. 必要環境變數 `.env.local`

檔案位置：

```bash
~/discount-hunter/.env.local
```

模板見：`docs/ENV_TEMPLATE.md`

必要欄位：

```env
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
BINANCE_REST_BASE_URL=http://158.179.185.67:3001
BINANCE_API_KEY=
BINANCE_API_SECRET=
WALLET_ADDRESS=0x657f5cbBC1FBE274299a6be52b5e46C3C6a9AD76
```

注意：不要把真實 Token / Secret commit 到 GitHub。

## 4. 一鍵健康檢查

```bash
curl http://158.179.185.67:3001/health
curl http://158.179.185.67:3001/api/v3/ticker/price?symbol=BTCUSDT
curl http://158.179.185.67:3000/api/v17/health
curl http://158.179.185.67:3000/api/binance-exchange-position
curl http://158.179.185.67:3000/api/sync-wallet
```

## 5. 成功標準

### Binance BTC

`/api/binance-exchange-position` 應看到：

```text
configured: true
binanceSignedRequest: success
BTC quantity > 0
averageBuyPrice > 0
marketPrice > 0
currentValue > 0
```

### xStocks Wallet

`/api/sync-wallet` 應看到：

```text
walletAddress: 0x657f...AD76
liveBalanceHoldingsCount > 0
holdingsCount > 0
priceSource: binance_xstocks_live
```

若看到 `costBasisEstimated: true`，代表持倉與市值是即時的，但成本仍為 fallback，需要接 Moralis / NodeReal / MegaNode。

## 6. 轉機流程總覽

新主機部署順序：

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl unzip build-essential
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

Clone：

```bash
cd ~
git clone https://github.com/changeros-bot/discount-hunter.git
cd discount-hunter
npm install
```

建立 `.env.local`，build + start：

```bash
npm run build
pm2 start npm --name discount-hunter -- start
pm2 save
```

Proxy：

```bash
cd ~
mkdir -p binance-proxy
cd binance-proxy
npm init -y
npm install express dotenv
# 建立 index.js，見 MIGRATION_GUIDE.md
pm2 start index.js --name oracle-binance-proxy
pm2 save
```

## 7. 安全事項

已貼到聊天或截圖的以下資料，一律視為外洩：

```text
BINANCE_API_SECRET
BINANCE_API_KEY
UPSTASH_REDIS_REST_TOKEN
```

正式封板前請旋轉：

1. Binance 刪除舊 API Key，重建 Read-only Key。
2. Upstash Rotate REST Token。
3. 更新 `.env.local`。
4. `pm2 restart discount-hunter --update-env`。

## 8. 下一階段：真實 xStocks 成本

目前 xStocks：

```text
數量：BSC live balanceOf，真實
價格：Binance xStocks live，真實
市值：真實
成本：fallback 5U，需補 transfer history
```

要改成真實成本，需要接其中一個：

```text
Moralis
NodeReal / MegaNode
BscScan API Pro / compatible token transfer API
```

目標：

```text
totalTransfers > 0
buyRecordCount > 0
costBasisEstimated: false
```
