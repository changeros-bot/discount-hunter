# DCA 折價獵人 V16 狀態機

更新日期：2026-06-25

## 1. 核心狀態

每檔標的同時有兩種狀態：

1. 價格狀態：由最新跌幅決定，會動態變化。
2. Ledger 狀態：由歷史買入紀錄決定，用於去重。

兩者不可混為一談。

## 2. 價格狀態機

```text
未達 D1
   │
   ▼
進入 D1 區
   │
   ▼
進入 D2 區
   │
   ▼
進入 D3 區
   │
   ▼
進入 D4 區
```

價格反彈時，狀態可以往回走：

```text
D3 區
   │ 反彈
   ▼
D2 區
   │ 反彈
   ▼
D1 區
   │ 反彈
   ▼
未達 D1
```

## 3. 今日決策狀態機

```text
價格進入新層級
        │
        ▼
檢查 Ledger 是否已登帳
        │
        ├── 已登帳 → 不進今日決策
        │
        └── 未登帳 → 進今日決策
```

## 4. 手動買入狀態機

```text
今日決策出現
        │
        ▼
使用者手動買入
        │
        ▼
Wallet 持倉增加
        │
        ▼
Reconcile 補登 Ledger
        │
        ▼
該層從今日決策消失
```

## 5. 同層重新觸發狀態機

```text
D2 已買入並登帳
        │
        ▼
價格反彈離開 D2 區
        │
        ▼
記錄 leftBuyZoneAt
        │
        ▼
等待超過 24 小時
        │
        ▼
價格再次跌回 D2 區
        │
        ▼
D2 可重新進今日決策
```

若未滿 24 小時：

```text
不得重新進今日決策
不得重新 Telegram 通知
```

## 6. Telegram 狀態機

```text
今日決策新增層級
        │
        ▼
檢查 12 小時冷卻
        │
        ├── 冷卻中 → 不通知
        │
        └── 可通知 → 發 Telegram
                         │
                         ▼
                    記錄 lastAlert
```

Telegram 只負責提醒，不代表可買入判斷。

可買入判斷仍由 Today Decision 與 Ledger 決定。

## 7. Reconcile 狀態機

```text
Wallet 有持倉
        │
        ▼
讀取最新價格與觸發層級
        │
        ▼
計算 Wallet Cost Gap
        │
        ▼
逐層檢查 D1-D4
        │
        ├── Ledger 已有 → 跳過
        ├── Cost Gap 不足 → 跳過
        └── Cost Gap 足夠 → 補登該層
```

## 8. 錯誤狀態

### 8.1 已買但今日決策仍顯示

可能原因：

- Ledger 沒寫入
- Today Decision 沒讀到最新 Ledger
- 同層重開條件錯誤

### 8.2 Wallet 成本增加但 Ledger 沒增加

可能原因：

- Reconcile 未執行
- `reconcile-tiers` 判斷 Cost Gap 不足
- Symbol 對不上

### 8.3 Telegram 沒通知

可能原因：

- Telegram 環境變數未設
- sendMessage 未接到 Today Decision
- 冷卻中

## 9. 正確首頁狀態

首頁應依狀態機分三區：

```text
今日決策：只放未登帳買點
買點區標的：目前仍在 D1-D4 區間內
觀察區：尚未達 D1
```
