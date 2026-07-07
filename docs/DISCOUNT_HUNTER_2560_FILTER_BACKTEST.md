# Discount Hunter 2560 Filter Backtest

**Project:** DCA 折價獵人  
**Status:** Research / Filter Test  
**Owner:** Josh  
**Updated:** 2026-07-07

---

## 1. Decision

2560 不開新專案，不復活槓桿獵人。

正式定位：

```text
2560 = DCA 折價獵人的技術面輔助濾網
不是買點引擎
不是自動交易規則
不是獨立策略
```

主訊號仍然是：

```text
D 層回撤買點
```

2560 只回答：

```text
D 層買點出現時，技術面是否有加分或扣分？
```

---

## 2. Backtest Question

不測：

```text
2560 戰法單獨能不能賺錢？
```

改測：

```text
D 層買點 + 2560 技術濾網
是否比單純 D 層買點更好？
```

比較指標：

```text
觸發次數
21日 / 63日 / 126日 / 252日平均報酬
21日 / 63日 / 126日 / 252日勝率
最大不利跌幅
樣本數是否足夠
```

---

## 3. Filter Groups

### A. D_ONLY

原始折價獵人：

```text
只看 D 層回撤
不加技術濾網
```

### B. D_MA25

```text
D 層觸發
MA25 向上或走平
```

### C. D_VOLUME

```text
D 層觸發
5日均量 >= 60日均量
或當日量縮到 60日均量以下
```

### D. D_2560

```text
D 層觸發
MA25 向上或走平
價格接近 MA25
5日均量 >= 60日均量 或 縮量
```

---

## 4. BTC Handling

BTC 不能直接硬套股票版 2560。

BTC-lite 規則：

```text
BTC 仍用 Cycle High 回撤
2560 技術濾網只看 MA25 是否走平或向上
成交量不作為強制條件
```

---

## 5. xStocks Handling

xStocks 回測使用原股資料作代理：

```text
AVGOon -> AVGO
NVDAon -> NVDA
TSMon -> TSM
GOOGLon -> GOOGL
RKLBon -> RKLB
```

代幣成交量不作為 2560 量能判斷，因為 xStock 代幣本身流動性可能不足。

---

## 6. Script

```text
scripts/backtest_discount_hunter_2560.py
```

Manual run:

```bash
python scripts/backtest_discount_hunter_2560.py --source yfinance
```

Custom tickers:

```bash
python scripts/backtest_discount_hunter_2560.py --tickers BTC-USD NVDA TSM AVGO AMD MRVL GOOGL RKLB --source yfinance
```

Outputs:

```text
reports/backtests/discount_hunter_2560_events.csv
reports/backtests/discount_hunter_2560_summary.csv
```

---

## 7. Promotion Rule

2560 只有在以下情況才可進 Telegram：

```text
D_2560 的 63日或126日報酬 / 勝率 明顯優於 D_ONLY
樣本數足夠
最大不利跌幅沒有惡化
```

Telegram 只能顯示輔助標籤：

```text
2560：通過 / 量能不足 / 趨勢不足 / 不適用
```

不可顯示：

```text
2560 建議買入
```
