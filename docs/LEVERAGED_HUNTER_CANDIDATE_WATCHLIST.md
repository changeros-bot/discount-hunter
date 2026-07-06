# Leveraged Hunter Candidate Watchlist

**Project:** 槓桿獵人  
**Status:** Candidate Watchlist / Not Buy List  
**Owner:** Josh  
**Project Owner:** ChatGPT / Josh OS Project Owner  
**Updated:** 2026-07-06

---

## 1. Principle

槓桿獵人不是折價獵人的加速版。

槓桿獵人只能處理：

- 指數型槓桿 ETF
- 高流動性槓桿 ETF
- 有清楚底層指數的槓桿 ETF
- 可以用回撤 / 均線 / 波動控制的標的

禁止把單一高風險個股直接當成槓桿獵人核心。

---

## 2. Core Rule

槓桿 ETF 多數是 Daily Reset 產品。

因此策略定位必須是：

```text
短中期戰術部位
不是長期核心 DCA
不是無限攤平
不是折價獵人同規則
```

---

## 3. Candidate Classification

### A. 台股槓桿核心候選

| Ticker | 中文名稱 / 定位 | 倍數 | 初步用途 | 狀態 |
|---|---|---:|---|---|
| 00631L | 元大台灣50正2 | 2x | 台股槓桿獵人核心 | Priority 1 |
| 00647L | 元大 S&P 500 正2 | 2x | 美股大盤槓桿候選 | Priority 2 |

### B. 美國大盤槓桿候選

| Ticker | 中文定位 | 倍數 | 初步用途 | 狀態 |
|---|---|---:|---|---|
| SSO | S&P 500 兩倍 | 2x | 溫和槓桿核心候選 | Priority 1 |
| UPRO | S&P 500 三倍 | 3x | 高風險戰術候選 | Priority 2 |
| SPXL | S&P 500 三倍 | 3x | UPRO 替代比較 | Priority 2 |

### C. Nasdaq / 科技槓桿候選

| Ticker | 中文定位 | 倍數 | 初步用途 | 狀態 |
|---|---|---:|---|---|
| QLD | Nasdaq-100 兩倍 | 2x | 科技槓桿核心候選 | Priority 1 |
| TQQQ | Nasdaq-100 三倍 | 3x | 高風險戰術候選 | Priority 2 |
| TECL | 科技類股三倍 | 3x | 科技集中槓桿候選 | Priority 3 |

### D. 半導體槓桿候選

| Ticker | 中文定位 | 倍數 | 初步用途 | 狀態 |
|---|---|---:|---|---|
| USD | 半導體兩倍 | 2x | 半導體槓桿候選 | Priority 2 |
| SOXL | 半導體三倍 | 3x | 極高風險戰術候選 | Priority 3 |

### E. 暫不納入 / 僅研究

| Ticker | 原因 |
|---|---|
| FNGU | ETN 結構 + 集中巨型科技 + 風險過高 |
| BULZ | 集中成長股槓桿，波動與產品風險高 |
| 單一股票槓桿 ETF | 監管與產品風險高，先不納入 |
| 反向 ETF | 不是現階段策略目標 |

---

## 4. Priority List

### Priority 1 — 先做回測與 App 觀察

- 00631L
- SSO
- QLD

### Priority 2 — 回測後再決定

- 00647L
- UPRO
- SPXL
- TQQQ
- USD

### Priority 3 — 文件觀察，不進 App 主畫面

- TECL
- SOXL
- FNGU
- BULZ

---

## 5. Leveraged Hunter Decision Framework

槓桿獵人的決策狀態與折價獵人不同。

建議狀態：

| 狀態 | 意義 |
|---|---|
| 觀察中 | 尚未進入策略區 |
| 允許建立小部位 | 回撤 / 趨勢 / 風險條件通過 |
| 等待確認 | 價格到位但趨勢或波動未確認 |
| 禁止加碼 | 趨勢破壞、波動過大、超過部位上限 |
| 退出觀察 | 到達停損 / 停利 / Exit Rule |

---

## 6. Required Rules Before Buy

正式買入前必須定義：

1. 進場規則
2. 停止加碼規則
3. 退出規則
4. 最大部位
5. 單筆上限
6. 月度上限
7. 最大回撤容忍
8. 是否允許隔夜 / 長持
9. 是否允許在大盤熊市建立部位
10. Kill Switch

---

## 7. Project Owner Decision

槓桿獵人可以同步建立候選名單，但不能與 Discount Hunter 混用。

下一步：

1. 建立槓桿獵人 Priority 1 回測：00631L / SSO / QLD。
2. App 中槓桿獵人先顯示候選清單，不顯示買點。
3. 定義 00631L 第一版進場 / 停止 / 退出規則。
4. 自動化交易只允許從 Discount Hunter Phase 1 之後逐步接入，不直接做槓桿自動下單。
