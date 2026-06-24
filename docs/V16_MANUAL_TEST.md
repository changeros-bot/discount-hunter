# DCA 折價獵人 V16-M 測試指南

## 已完成

- `lib/v16-ledger.js`
- `pages/api/buy-ledger.js`
- `pages/api/manual-buy.js`
- `pages/api/today-decisions.js`
- `pages/api/telegram-alert-check.js`

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

## V16-M 判定

現在的封版核心是：

價格觸發 → 今日決策 → 手動買入 → `/manual-buy` 登帳 → Ledger 去重。
