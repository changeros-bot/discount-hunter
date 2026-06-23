# Debug SOP

Last updated: 2026-06-23

## Core rules

### Rule 1 — Data first

先看資料，不要先看程式。

程式碼是邏輯的因，資料是執行的果。當畫面或 API 結果不一致時，先抓 debug JSON、API response、部署 commit、實際畫面，不要先猜。

### Rule 2 — Layer isolation

先確認問題在哪一層。

範例資料流：

```text
Binance Wallet
↓
BSC RPC balanceOf
↓
liveBalanceSymbols
↓
selectedLiveBalanceSymbols
↓
holdings[]
↓
summarize()
↓
Homepage / Telegram
```

如果問題已經在上游發生，就不要檢查下游。

### Rule 3 — Single variable

一次只驗證一個問題。

不要同時查 RPC、成本、價格、UI、Telegram、CSS。每次只測一個假設，確認後再往下一層。

### Rule 4 — No evidence, no claim

沒有資料證據，不做推論式結論。

錯誤示範：

```text
應該是成本沒算到。
可能是快取。
應該是 Vercel 沒部署。
```

正確做法：

```text
先看 debugCounts.holdingSymbols。
先看 Vercel Production commit。
先看 GitHub main 實際程式。
先看 CSS 是否有 !important 覆蓋。
```

## Required verification examples

### Deployment verification

1. 看 Vercel Production commit SHA。
2. 用 GitHub 讀取該 SHA 的檔案。
3. 比對版本號與功能是否存在。

### Wallet verification

優先欄位：

```text
liveBalanceSymbols
selectedLiveBalanceSymbols
holdingSymbols
estimatedCostBasisSymbols
liveBalanceErrors
```

### CSS verification

若 JS 已經設定顏色但畫面沒變，必查：

```text
!important
.page > section:not(.hero) strong
.dataGrid strong
v15-unified.css
v15-fix.css
最後載入順序
```

## Regression prevention

修改前先看：

```text
docs/DCA-HUNTER-SPEC.md
```

修改後至少驗證：

```text
1. 首頁版本
2. 進度公式
3. 紅綠字
4. Telegram 顏色
5. 持倉同步
```
