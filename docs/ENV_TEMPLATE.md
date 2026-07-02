# ENV_TEMPLATE.md

> 不要把真實密鑰 commit 到 GitHub。本檔只放欄位名稱與用途。

## Oracle Production `.env.local`

檔案位置：

```bash
~/discount-hunter/.env.local
```

模板：

```env
# Durable storage for V17 mutable state
UPSTASH_REDIS_REST_URL=https://YOUR_UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN=YOUR_UPSTASH_REDIS_REST_TOKEN

# Oracle Binance Proxy
BINANCE_REST_BASE_URL=http://158.179.185.67:3001

# Binance Exchange read-only sync for BTC spot account
BINANCE_API_KEY=YOUR_BINANCE_READ_ONLY_API_KEY
BINANCE_API_SECRET=YOUR_BINANCE_READ_ONLY_API_SECRET

# Binance Wallet / BSC wallet for xStocks
WALLET_ADDRESS=0x657f5cbBC1FBE274299a6be52b5e46C3C6a9AD76

# Optional Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Optional transfer history providers for real xStocks cost basis
MORALIS_API_KEY=
MEGANODE_API_KEY=
NODEREAL_API_KEY=
MEGANODE_ENDPOINT=
NODEREAL_ENDPOINT=

# Optional BSC RPC / BscScan
BSC_RPC_URL=
BSCSCAN_API_KEY=
```

## 更新 `.env.local`

手機 SSH 可用這種方式，不用 nano：

```bash
cd ~/discount-hunter
cat > .env.local <<EOF
UPSTASH_REDIS_REST_URL=https://YOUR_UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN=YOUR_UPSTASH_REDIS_REST_TOKEN
BINANCE_REST_BASE_URL=http://158.179.185.67:3001
BINANCE_API_KEY=YOUR_BINANCE_READ_ONLY_API_KEY
BINANCE_API_SECRET=YOUR_BINANCE_READ_ONLY_API_SECRET
WALLET_ADDRESS=0x657f5cbBC1FBE274299a6be52b5e46C3C6a9AD76
EOF
pm2 restart discount-hunter --update-env
```

## 驗證 env 是否讀到

```bash
curl http://158.179.185.67:3000/api/v17/health
```

成功重點：

```text
storage.mode = upstash_kv
storage.durable = true
providers.binanceExchange.configured = true
providers.bscWallet.configured = true
```
