# DCA 折價獵人 API 參考

更新日期：2026-06-25

## 1. `/api/prices`

用途：取得價格、跌幅、層級規則與 signal。

方法：GET

回傳重點：

```text
symbol
name
price
high
discount
rules
amounts
signal
```

注意：

- `rules` 是每檔標的自己的買點規則。
- `amounts` 是每檔標的自己的建議投入金額。
- 不應用全域固定層級取代每檔設定。

## 2. `/api/today-decisions`

用途：計算今日決策。

方法：POST

Request：

```json
{
  "assets": []
}
```

邏輯：

```text
目前已觸發層級 - Ledger 已登帳層級 = 今日決策
```

回傳：

```text
count
totalAmount
decisions
```

注意：

- 已登帳層級不應再出現。
- 除非同層重新觸發條件成立。
- 排序應為 D4 > D3 > D2 > D1，同層跌幅深優先。

## 3. `/api/buy-ledger`

用途：讀取或維護 Buy Ledger。

Ledger 結構：

```json
{
  "NVDAon": {
    "N": [],
    "D1": [],
    "D2": [],
    "D3": [],
    "D4": []
  }
}
```

注意：

- `N` 是 DCA。
- `D1-D4` 是折價買入。
- Wallet 不可直接取代 Ledger。

## 4. `/api/sync-wallet`

用途：同步鏈上 Wallet 持倉。

方法：POST

主要回傳：

```text
holdings
totalCost
currentValue
unrealizedPnl
quantitySource
```

注意：

- Wallet 是目前持倉 source of truth。
- Wallet 不是買點層級完成狀態。
- D1-D4 是否完成仍看 Ledger。

## 5. `/api/reconcile-ledger`

用途：舊版補登 API。

狀態：Legacy，不建議使用。

限制：

- 只補 D1。
- 不支援 D2-D4。

後續應使用：

```text
/api/reconcile-tiers
```

## 6. `/api/reconcile-tiers`

用途：依 Wallet 持倉補登 D1-D4。

方法：POST

Request：

```json
{
  "assets": [],
  "holdings": []
}
```

核心防呆：

```text
Wallet 總成本 - Ledger 已登帳成本 >= 該層建議金額
```

只有成本差額足夠，才補登該層。

預期用途：

- 使用者已手動買入
- Wallet 成本增加
- Ledger 尚未補上該層
- 按補登後寫入 Ledger

注意：

- 不追認舊價格。
- 依最新價格與目前觸發層級補登。
- 不得因價格已到 D2，就在 Wallet 成本不足時誤補 D2。

## 7. Telegram API / 工具

目前狀態：尚未完整接線。

相關檔案：

```text
lib/telegram/notify.js
```

應完成：

- 讀取 Today Decision
- 排除已登帳層級
- 同標的同層 12 小時冷卻
- 呼叫 Telegram sendMessage
- 成功後記錄 alert state

## 8. API 驗證順序

建議順序：

1. `/api/prices`
2. `/api/sync-wallet`
3. `/api/buy-ledger`
4. `/api/today-decisions`
5. `/api/reconcile-tiers`
6. `/api/today-decisions` 再查一次

如果補登後今日決策沒有消失，優先查：

- `reconcile-tiers` 是否真的寫入 Ledger
- `buy-ledger` 是否讀到最新 Ledger
- `today-decisions` 是否排除該層
