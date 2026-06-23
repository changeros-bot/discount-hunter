# DCA 折價獵人

手機優先的 30 秒決策系統，用於監控 Binance xStocks / tokenized stocks 的折價買點、鏈上持倉與 Telegram 買點警報。

## 核心原則

- 全系統採用絕對進度：目前回撤深度 / 下一層門檻。
- 每檔標的使用自己的 `rules` 與 `amounts`，不可套用全域固定買點。
- 損益與回撤顏色：負數紅字、正數綠字，不使用膠囊或 Badge。
- Telegram 顏色依目標層級：第1層 🟢、第2層 🟡、第3層以上 🔴。
- 目前持倉以 BSC RPC `balanceOf()` 為 source of truth。

## 文件

- [規格書](docs/DCA-HUNTER-SPEC.md)
- [更新紀錄](docs/CHANGELOG.md)
- [Debug SOP](docs/SOP-DEBUG.md)
- [系統架構](docs/ARCHITECTURE.md)

## 下一步

V15.37 Wallet Execution Sync：偵測使用者在 Binance 買入後的錢包變化，並在首頁與 Telegram 顯示買入完成。
