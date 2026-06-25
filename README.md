# DCA 折價獵人

手機優先的 30 秒投資決策系統，用於監控 Binance xStocks / tokenized stocks 的折價買點、鏈上持倉、Buy Ledger 與 Telegram 提醒。

> 本專案不是自動交易系統。使用者仍然手動買入，系統負責判斷、提醒、記錄與對帳。

## 專案用途

DCA 折價獵人用來解決一件事：

```text
今天有沒有買點？
買哪檔？
買哪一層？
買多少？
是否已經買過？
下一層還差多少？
```

系統目標是讓使用者打開手機後，在 30 秒內完成投資決策。

## 核心概念

每檔標的有兩套互相獨立的買入模式。

### DCA 定期買入

Ledger 代碼：`N`

- 固定時間投入
- 與跌幅無關
- 不影響 D1-D4

### 折價買入

Ledger 代碼：

- `D1`
- `D2`
- `D3`
- `D4`

依跌幅層級觸發，逐層買入並分層登帳。

## V16 核心規格

請以 `docs/V16_SPEC.md` 為唯一真相。

重點如下：

- Ledger 是歷史與去重依據，不代表目前價格區間。
- 價格區間是動態的，跌深前進、反彈後退。
- 今日決策 = 目前已觸發層級 - Ledger 已登帳層級。
- 進度條採水壺模型，100% 代表到達下一層買點。
- Gap Down 必須列出所有跨越層級。
- 同層重新觸發必須：離開區間 + 超過 24 小時 + 再次進入。
- 24 小時以 `leftBuyZoneAt` 計算。
- Wallet 補登必須檢查 Wallet Cost Gap，避免誤補更深層。

## 目前功能

- Binance xStocks / tokenized stocks 價格監控
- 52 週高點或可用高點跌幅計算
- A / A- / B / C 分級買點規則
- 今日決策 API
- Buy Ledger：`N / D1 / D2 / D3 / D4`
- Wallet Live 持倉同步
- Wallet 成本、市值、未實現損益
- 手動補登 Ledger
- D1-D4 逐層補登 API：`/api/reconcile-tiers`
- 同層重新觸發基礎邏輯
- Telegram 發送工具

## 主要頁面

- `/`：主入口
- `/v16-full`：V16 主頁
- `/reconcile`：手動 Wallet → Ledger 補登頁

## 主要 API

- `/api/prices`：取得價格、跌幅、規則與 signal
- `/api/today-decisions`：產生今日決策
- `/api/buy-ledger`：讀取 Buy Ledger
- `/api/sync-wallet`：同步鏈上持倉
- `/api/reconcile-tiers`：依 Wallet Cost Gap 補登 D1-D4
- `/api/reconcile-ledger`：舊版，只補 D1，後續避免使用

## 啟動方式

```bash
npm install
npm run dev
```

本機網址：

```text
http://localhost:3000
```

## 部署方式

建議部署於 Vercel。

1. GitHub repository 連接 Vercel
2. 設定環境變數
3. Push 到 main branch
4. Vercel 自動部署

## 環境變數

### Wallet / Chain

```text
WALLET_ADDRESS
BSC_RPC_URL
```

### Telegram

```text
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
```

### Upstash KV

```text
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

若未設定 KV，production 可能使用 memory fallback；資料持久性需特別注意。

## 專案結構

```text
pages/
  api/
    prices.js
    today-decisions.js
    buy-ledger.js
    sync-wallet.js
    reconcile-ledger.js
    reconcile-tiers.js
  v16-full.js
  reconcile.js

lib/
  v16-ledger.js
  telegram/notify.js
  state/kv.js

docs/
  V16_SPEC.md
  ARCHITECTURE.md
  PROGRESS.md
  AI_HANDOFF.md
  TEST_CASES.md
  CONFIG.md
  API.md
  STATE_MACHINE.md
  KNOWN_BUGS.md

CHANGELOG.md
```

## 已知問題

### P0

- `pages/v16-full.js` 尚未完成三區重構。
- 需要重新驗證 RKLB D2 補登後，今日決策是否正確消失。

### P1

- Telegram 發送工具存在，但尚未完整接上 Today Decision。
- Telegram 尚未正式做到只通知新增未登帳層級。

### P2

- `pages/api/reconcile-ledger.js` 是舊版 D1-only API，後續應避免使用。
- 首頁仍有舊的「可執行買點」區塊，應改成：今日決策、買點區標的、觀察區。

## 下一步

1. 驗證 `/api/reconcile-tiers` 是否能正確補登 RKLB D2。
2. 重構 `pages/v16-full.js` 為三區首頁。
3. 接上 Telegram 買點提醒。
4. 依 `docs/TEST_CASES.md` 逐項驗證。
5. 全部通過後才可封版 V16。

## 文件

- [V16 規格](docs/V16_SPEC.md)
- [架構說明](docs/ARCHITECTURE.md)
- [進度紀錄](docs/PROGRESS.md)
- [AI 交接](docs/AI_HANDOFF.md)
- [測試案例](docs/TEST_CASES.md)
- [設定參考](docs/CONFIG.md)
- [API 參考](docs/API.md)
- [狀態機](docs/STATE_MACHINE.md)
- [已知問題](docs/KNOWN_BUGS.md)
- [更新紀錄](CHANGELOG.md)
