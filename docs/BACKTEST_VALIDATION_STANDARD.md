# Backtest Validation Standard

**Project:** 折價獵人 / 槓桿獵人  
**Scope:** Research validation, not live trading  
**Status:** Required before any buy signal or automation  
**Owner:** Josh  
**Project Owner:** ChatGPT / Josh OS Project Owner  
**Updated:** 2026-07-06

---

## 1. Why this exists

目前槓桿獵人已經完成：

```text
GitHub Actions 可跑回測
Simulation CSV 可產生
App 可讀 READY 狀態
```

但這只代表流程跑通，不代表策略有效。

任何策略要從 Research 進入 Telegram 確認或下單草稿前，必須通過本文件的驗證標準。

---

## 2. Required Validation Layers

### Layer 1 — Signal Research

目的：確認訊號是否有研究價值。

至少要看：

```text
交易數
勝率
平均報酬
Expectancy
Profit Factor
Max Drawdown
Max Adverse Excursion
依標的拆解
依訊號拆解
```

低於 30 筆交易：

```text
只允許標示：樣本數不足
禁止標示：策略有效
禁止升級：買點 / Telegram 確認 / 自動交易
```

---

### Layer 2 — Cost Model

所有回測必須逐步加入成本。

第一版成本模型：

```text
Commission / 手續費
Spread / 買賣價差
Slippage / 滑價
```

第二版成本模型：

```text
Token Premium / Discount
Liquidity
Price Sync Delay
Overnight / Funding / Borrow Cost，如果未來有槓桿商品或保證金
```

沒有成本模型的結果只能叫做：

```text
Gross Research Result
```

不能叫正式策略績效。

---

### Layer 3 — In-sample / Out-of-sample

不能只看單一歷史區間。

初版切法：

```text
In-sample：前 70%
Out-of-sample：後 30%
```

判定原則：

```text
如果 In-sample 好，但 Out-of-sample 崩壞，策略不得升級
如果兩段都普通但穩定，可保留觀察
如果兩段都穩定且成本後仍正，可進入下一層
```

---

### Layer 4 — Walk-forward

目標：避免只在某段歷史好看。

初版設定：

```text
Training window：3 年
Testing window：1 年
Rolling step：1 年
```

每個 window 都要輸出：

```text
trades
win_rate
expectancy
profit_factor
max_drawdown
realized_pnl
return_on_used_capital
```

---

### Layer 5 — Stress Test

至少要覆蓋：

```text
多頭期
空頭期
盤整期
AI / 科技股回檔期
BTC 高波動期
```

如果策略只在單一行情有效，App 必須標示：

```text
Regime dependent / 行情依賴
```

---

## 3. Sample Size Gate

### Sample Level

| Trades | Status | Meaning |
|---:|---|---|
| < 30 | 樣本不足 | 只允許工程測試 |
| 30–49 | 初步觀察 | 可比較，但不可升級 |
| 50–99 | 研究可用 | 可評估訊號 |
| 100–199 | 候選策略 | 可做參數比較 |
| 200+ | 策略研究成熟 | 可考慮進入 paper trading |

---

## 4. Leveraged Hunter Baseline Parameters

目前 A 組 baseline：

```text
單筆：5U
總資金：50U
單檔上限：15U
停利：12%
停損：8%
持有：30日
Signal C：風控，不交易
```

目前狀態：

```text
流程通過
樣本數不足
策略有效性未通過
禁止升級買點
禁止自動交易
```

---

## 5. Candidate Parameter Sets

未來同時比較，不直接替換 baseline。

### A — Current Baseline

```text
單筆：5U
單檔上限：15U
停利：12%
停損：8%
持有：30日
```

### B — Moderate Risk / Reward

```text
單筆：4U
單檔上限：12U
停利：18%
停損：10%
持有：45日
```

### C — Deep Discount / Conservative Size

```text
單筆：3U
單檔上限：9U
停利：20%
停損：12%
持有：60日
```

判定方式：

```text
不能只挑最高 PnL
必須看樣本數、成本後報酬、Max Drawdown、Profit Factor、Out-of-sample 穩定度
```

---

## 6. 30 Day Exit Rule

目前 V1.2 規則：

```text
30 天內達停利 → 停利出場
30 天內觸停損 → 停損出場
30 天內都沒有 → 第 30 天時間出場
```

未來 B / C 組會改成 45 / 60 天時間出場。

---

## 7. Tactical Sandbox Rule

槓桿獵人資金池是 Tactical Sandbox。

```text
它可以滿倉回測
但不得影響核心 DCA
不得影響折價獵人
不得動用生活費 / 家用 / 學費 / 緊急預備金
```

50U 只是研究與小額沙盒，不代表核心資產配置。

---

## 8. Promotion Rule

策略要從 Research 升級到 Telegram 確認，至少需要：

```text
交易數 >= 100
成本後仍為正
Out-of-sample 不崩壞
Walk-forward 多數區間穩定
Profit Factor > 1.2
Max Drawdown 可接受
Signal C 只當風控
Quality / Liquidity / Token deviation gate 完成
```

在此之前，App 只能顯示：

```text
Research Only
Not a Buy Signal
```
