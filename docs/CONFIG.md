# DCA 折價獵人設定參考

更新日期：2026-06-25

## 1. 投資層級設定

### A 級

標的：QQQon、NVDAon、TSMon、AVGOon

```text
D1 = -15%
D2 = -25%
D3 = -35%
D4 = -50%
```

### A- 級

標的：SPCXon

```text
D1 = -20%
D2 = -35%
D3 = -50%
D4 = -65%
```

### B 級

標的：GOOGLon、AMDon、MRVLon

```text
D1 = -20%
D2 = -35%
D3 = -50%
D4 = -65%
```

### C 級

標的：RKLBon

```text
D1 = -25%
D2 = -40%
D3 = -60%
```

## 2. 買入金額

目前 V16 以每檔 `amounts` 為準，不建議使用全域固定金額。

常見預設：

```text
D1 = 5U
D2 = 10U
D3 = 15U
D4 = 20U
```

實際金額應以 `pages/api/prices.js` 回傳的 asset amounts 為準。

## 3. Ledger 類型

```text
N  = Normal DCA
D1 = Dip Buy Level 1
D2 = Dip Buy Level 2
D3 = Dip Buy Level 3
D4 = Dip Buy Level 4
```

## 4. 時間與冷卻設定

```text
同層重新觸發 = 離開買點區後超過 24 小時
Telegram 同層提醒冷卻 = 12 小時
首頁價格刷新 = 約 5 秒
Wallet 同步 = 約 60 秒
```

注意：

- 24 小時應以 `leftBuyZoneAt` 計算。
- Telegram 12 小時只控制提醒，不代表可以重買。

## 5. 環境變數

### Wallet / BSC

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

## 6. 儲存策略

優先順序：

1. Upstash KV
2. Memory fallback
3. Local file fallback（非 production）

若 production 沒有 Upstash KV，資料可能不穩定，不適合封版。

## 7. 不建議修改的設定

除非使用者明確要求，不應修改：

- A / A- / B / C 分層門檻
- DCA 與 D1-D4 分帳邏輯
- 同層重新觸發三條件
- Wallet Cost Gap 防呆
- Today Decision 公式
