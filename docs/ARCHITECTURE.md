# DCA 折價獵人架構說明

更新日期：2026-06-25

## 1. 系統定位

DCA 折價獵人是長期 DCA + 逢低買入決策系統，不是自動交易系統。

使用者仍然手動買入，系統負責：

- 讀價格
- 判斷層級
- 顯示今日決策
- 同步 Wallet
- 補登 Ledger
- 發 Telegram 提醒

## 2. 核心資料流

```text
Binance / xStocks Price API
        │
        ▼
Tier Engine
        │
        ▼
Today Decision Engine
        │
        ├── UI Dashboard
        ├── Telegram Alert
        └── Buy Ledger

Wallet / BSC RPC
        │
        ▼
Wallet Sync
        │
        ▼
Reconcile Engine
        │
        ▼
Buy Ledger
```

## 3. 主要模組

### 3.1 Price API

主要用途：

- 取得最新價格
- 取得高點
- 計算跌幅
- 產生每檔標的的 `rules`、`amounts`、`signal`

相關檔案：

- `pages/api/prices.js`

### 3.2 Tier Engine

主要用途：

- 根據跌幅判斷 D1-D4 是否觸發
- 支援跳空跨層
- 不直接決定是否已買

相關檔案：

- `lib/v16-ledger.js`
- `getTriggeredDipTiers()`

### 3.3 Today Decision Engine

主要用途：

- 計算今日應執行的買點
- 必須排除 Ledger 已登帳層級
- 排序 D4 > D3 > D2 > D1，同層跌幅深優先

相關檔案：

- `pages/api/today-decisions.js`
- `getExecutableTiers()`

### 3.4 Buy Ledger

主要用途：

- 記錄 N / D1 / D2 / D3 / D4
- 作為去重依據
- 作為今日決策排除依據

相關檔案：

- `pages/api/buy-ledger.js`
- `lib/v16-ledger.js`
- Upstash KV 或本地 fallback

### 3.5 Wallet Sync

主要用途：

- 讀取目前鏈上持倉
- 計算持倉成本、市值、未實現損益
- 不直接代表 D1-D4 已完成

相關檔案：

- `pages/api/sync-wallet.js`

### 3.6 Reconcile Engine

主要用途：

- 用 Wallet 持倉輔助補登 Ledger
- 補登 D1-D4 時必須檢查 Wallet Cost Gap
- 避免只買 D1 卻誤補 D2

相關檔案：

- `pages/api/reconcile-ledger.js`：舊版，只補 D1
- `pages/api/reconcile-tiers.js`：新版，D1-D4 逐層補登並檢查成本差額

### 3.7 Telegram

主要用途：

- 買點提醒
- Wallet 變動提醒
- 每日持倉日報

目前狀態：

- 發送工具存在
- 今日決策觸發流程尚未完整接線

相關檔案：

- `lib/telegram/notify.js`

## 4. UI Dashboard

目前主頁：

- `pages/v16-full.js`

預期首頁應分為：

```text
今日決策
買點區標的
觀察區
Wallet
Ledger 檢查
```

目前已知問題：

- 首頁仍保留舊的「可執行買點」區塊
- 三區重構尚未完成

## 5. 儲存層

優先順序：

1. Upstash KV
2. Memory fallback
3. Local file fallback（非 production）

相關環境變數：

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

## 6. 重要設計原則

- Price 狀態是動態的
- Ledger 是歷史與去重依據
- Wallet 是目前持倉，不等於買點完成狀態
- Today Decision 只能顯示未登帳項目
- Telegram 只能通知新增未登帳層級
