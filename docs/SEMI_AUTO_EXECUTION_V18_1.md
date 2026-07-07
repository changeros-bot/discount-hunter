# DCA 折價獵人 V18.1 半自動執行邊界

**Status:** Semi-Auto Draft Only  
**Updated:** 2026-07-07  
**Owner:** Josh

---

## 1. 定義

半自動不是自動交易。

本系統只允許：

```text
偵測買點
計算本層金額
產生手動下單草稿
產生檢查清單
等待使用者到 Binance 手動確認
完成後由使用者回 App 按「已完成」或「略過本層」
```

不允許：

```text
App 直接送單
App 連接交易 API 自動買入
沒有人工確認就下單
超過本層金額
把 WATCH 標的當正式主力標的
```

---

## 2. 半自動流程

```text
1. /api/prices 抓即時價格與回撤
2. /api/v17/ui-decisions 產生今日決策
3. /api/v17/semi-auto-drafts 產生手動下單草稿
4. 使用者人工檢查 Quality / 預算 / 部位
5. 使用者到 Binance 手動下單
6. 使用者回 App 按「已完成」或「略過本層」
```

---

## 3. 安全規則

```text
預設 Kill Switch = ON
只輸出草稿，不送單
每筆金額只能使用 registry amounts
WATCH 標的不進主力推播
SPCXon 暫不升級半自動，等待專用資料源
RKLB 只保留深折扣觀察，不當主力標的
```

---

## 4. API

```text
POST /api/v17/semi-auto-drafts
```

輸出：

```text
symbol
tier
price
discount
amountUsd
estimatedQty
checklist
copyText
```

---

## 5. Project Owner 判定

```text
V18.1 半自動只做到「下單草稿」。
實際交易仍由 Josh 在 Binance 手動確認。
這是從訊號只讀進入半自動的安全中間層，不是自動交易。
```
