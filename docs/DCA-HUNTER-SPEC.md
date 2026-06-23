# DCA 折價獵人規格書

Version: 15.36+
Last updated: 2026-06-23
Status: Iterative living document

## 1. Product goal

DCA 折價獵人是 30 秒決策系統，不是自動交易系統。每天只回答：今天有沒有買點；如果有，買哪一檔、買多少。

## 2. Core watchlist

目前核心監控標的：NVDA、TSM、AMD、AVGO、MRVL、VRT、RKLB、LITE、SPCX。

不得在未確認前自行新增或移除核心標的。

## 3. Price and drawdown

行情來源以 Binance xStocks / tokenized stock price 為主。

回撤公式：

```text
回撤 = (現價 - 高點) / 高點
```

回撤為負數時，首頁顯示紅字。

## 4. Per-asset buy rules

每一檔標的都有自己的買點規則與資金配置，不可使用全域固定買點。

範例：

```text
SPCX: -20%, -35%, -50%, -65%
AVGO: -15%, -25%, -35%, -50%
RKLB: -25%, -40%, -60%, -75%
```

實際規則必須讀取每個 asset 的 `rules` 與 `amounts`。

## 5. Progress formula

全系統只使用絕對進度。

```text
進度 = 目前回撤深度 / 下一層門檻 * 100
```

範例：AVGO 目前回撤 23%，下一層門檻 25%，進度為 92%。

禁止使用區間進度：

```text
(currentDepth - previousDepth) / (targetDepth - previousDepth)
```

首頁與 Telegram 必須一致。

## 6. Color rules

### PnL and returns

負數：紅字。
正數：綠字。
零：白字或中性顏色。

禁止改成灰字、白字、膠囊、Badge、背景色。

### Drawdown

負數回撤顯示紅字，正數顯示綠字。

目前用最後載入的 `styles/v15-color-force.css` 強制覆蓋 `v15-unified.css` 的白字規則。

## 7. Homepage sections

首頁排序：

1. 可執行買點
2. 鏈上已持有買點區
3. 觀察區

## 8. Wallet source of truth

目前持倉以 BSC RPC `balanceOf()` 為 source of truth。

交易紀錄與成本基礎由 transfer/swap history 計算。

必要欄位：

```text
quantitySource = bsc_rpc_balanceOf_live
```

## 9. Completed level

已完成層級根據實際累積投入成本判定。

例如每層金額為 5U、10U、15U、20U；如果累積投入 15U，代表已完成第 1 層與第 2 層，下一個目標為第 3 層。

## 10. Telegram alerts

Telegram 顏色根據目標層級，不根據剩餘距離或進度百分比。

```text
第1層 → 🟢
第2層 → 🟡
第3層以上 → 🔴
```

Telegram 必須讀取每檔自己的 `asset.rules` 與 `asset.amounts`。

範例：

```text
🟡 接近第2層 SPCX
目前深度：34.6%
目標層級：第2層
已完成：第1層
門檻：-35.0%
還差：0.4%
進度：99%
本層建議：10U
```

## 11. Wallet Execution Sync（V15.37 待辦）

目標：當使用者在 Binance 買入後，系統可以同步錢包變化，並在首頁與 Telegram 顯示買入動作。

需要同步三件事：

1. 現在持有什麼：鏈上 `balanceOf()` 數量。
2. 買過什麼：transfer/swap history 成本、買入層級、投入金額。
3. 剛剛做了什麼：比較上次快照與本次快照，判斷新增買入、賣出、加碼。

預期流程：

```text
幣安買入
↓
鏈上數量或成本增加
↓
系統同步錢包
↓
首頁顯示最近買入動作
↓
Telegram 發送買入完成通知
↓
下一次警報自動跳到下一層
```

範例 Telegram：

```text
✅ DCA折價獵人 買入同步

🟡 SPCX 第2層買入完成
買入金額：10U
目前累積投入：15U
下一目標：第3層
```

## 12. Forbidden regression list

禁止在未驗證前修改以下規則：

1. 絕對進度公式。
2. 紅字 / 綠字規則。
3. Telegram 層級顏色。
4. 每檔獨立買點規則。
5. BSC RPC live balance 作為目前持倉 source of truth。
6. 已完成層級依累積投入成本判定。

