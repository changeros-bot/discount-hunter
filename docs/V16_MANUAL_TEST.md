# DCA 折價獵人 V16-M 測試指南

## 已完成

- `lib/v16-ledger.js`
- `pages/api/buy-ledger.js`
- `pages/api/manual-buy.js`
- `pages/api/today-decisions.js`
- `pages/api/telegram-alert-check.js`
- `pages/api/wallet-change-alerts.js`
- `pages/api/daily-position-report.js`

## 資料保存策略

正式部署資料來源：Upstash KV。

```text
正式資料：Upstash KV
備援資料：local JSON fallback
人工備份：GitHub / docs / export
```

Ledger 與 Telegram cooldown 會優先讀寫 KV：

```text
discount-hunter:v16:buy-ledger
discount-hunter:v16:telegram-alerts
```

如果沒有設定 Upstash：

```text
data/buy-ledger.json
data/alerts.json
```

只作為本地開發 fallback，不可當正式封版資料庫。

需要的環境變數：

```text
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

## 1. 查看 Ledger

```http
GET /api/buy-ledger
```

查看單一標的：

```http
GET /api/buy-ledger?symbol=NVDAon
```

## 2. 手動買入登帳

```http
POST /api/manual-buy
Content-Type: application/json

{
  "text": "/buy NVDAon D1 5"
}
```

DCA 登帳：

```http
POST /api/manual-buy
Content-Type: application/json

{
  "text": "/dca NVDAon 5"
}
```

## 3. 今日決策去重

先取價格：

```http
GET /api/prices
```

再把 `data` 傳入：

```http
POST /api/today-decisions
Content-Type: application/json

{
  "assets": []
}
```

回傳只會包含：

- 尚未登帳
- 已觸發買點
- 通過 24 小時同層重置規則

## 4. Telegram 12 小時冷卻

只檢查：

```http
POST /api/telegram-alert-check
Content-Type: application/json

{
  "symbol": "NVDAon",
  "tier": "D1"
}
```

檢查並寫入冷卻：

```http
POST /api/telegram-alert-check
Content-Type: application/json

{
  "symbol": "NVDAon",
  "tier": "D1",
  "commit": true
}
```

## 5. Wallet 異動提醒

```http
GET /api/wallet-change-alerts
```

支援：

- 新增持倉
- 加碼
- 減碼
- 清倉

## 6. 每日持倉日報

只產生日報，不發 Telegram：

```http
GET /api/daily-position-report
```

產生日報並發 Telegram：

```http
POST /api/daily-position-report
```

或：

```http
GET /api/daily-position-report?send=1
```

## V16-M 判定

現在的封版核心是：

價格觸發 → 今日決策 → 手動買入 → `/manual-buy` 登帳 → Ledger 去重。

正式封版前必須確認：

- Upstash KV 已設定
- `/api/buy-ledger` 回傳正常
- `/api/manual-buy` 可寫入 KV
- `/api/today-decisions` 不重複顯示已登帳層級
- `/api/wallet-change-alerts` 能建立 baseline
- `/api/daily-position-report` 能正常產生文字
