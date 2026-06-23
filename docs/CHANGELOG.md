# CHANGELOG

## 2026-06-23 / V15.36+

### Fixed

- 修復 AMDON / holdings 消失排查流程，確認先看資料、再定位層級。
- 修復首頁與 Telegram 進度公式不一致問題。
- 封版全系統採用絕對進度：目前回撤深度 / 下一層門檻。
- 移除區間進度概念。
- 修復紅綠字被 `v15-unified.css` 強制白字覆蓋的問題。
- 新增 `styles/v15-color-force.css` 作為最後載入的顏色覆蓋層。
- 修復 Telegram 顏色邏輯：不再依剩餘距離，改依目標層級。

### Current rules

- 第1層 Telegram：🟢
- 第2層 Telegram：🟡
- 第3層以上 Telegram：🔴
- 負數：紅字
- 正數：綠字
- 回撤負數：紅字
- 每檔買點規則獨立讀取 `asset.rules` / `asset.amounts`

### Next

- V15.37 Wallet Execution Sync：偵測使用者在 Binance 買入後的錢包變化，並在首頁 / Telegram 顯示買入完成。
- Cloudflare Worker 高頻監控。
- 防重複通知。
