# 2560 技術研究室

**Project:** 2560 Technical Lab  
**Status:** Research Only  
**Owner:** Josh  
**Updated:** 2026-07-07

---

## 1. 定位

2560 技術研究室是獨立研究模組。

```text
不是槓桿獵人
不是 DCA 折價獵人
不是自動交易系統
不是資金管理系統
```

它只研究：

```text
哪些產業 / 股性 / 型態適合 2560 短線波段？
```

---

## 2. 研究問題

不要問：

```text
2560 戰法一定能賺錢嗎？
```

要問：

```text
2560 適合哪些產業？
哪種型態最有效？
哪種型態是假訊號？
20 / 30 / 60 日是否有統計優勢？
```

---

## 3. 第一版產業分組

```text
AI半導體：NVDA, AVGO, AMD, TSM, MU, MRVL, SMCI
大型科技平台：AAPL, MSFT, GOOGL, META, AMZN, NFLX
高波動成長股：TSLA, PLTR, COIN, HOOD, RKLB, SOFI
金融支付：JPM, BAC, AXP, MA, V, PYPL
能源原物料：XOM, CVX, OXY, COP, FCX
工業基建：CAT, GE, DE, ETN, PWR
防禦消費：KO, PEP, WMT, COST, PG, MCD
ETF對照：QQQ, SPY, SMH, SOXX, ARKK
```

---

## 4. 型態分類

### 誘多

```text
MA25 走平或向上
短線上漲
但 5日均量仍未站上 60日均量
```

用途：驗證是否應該避開。

### 沖量

```text
股價站上 MA25
5日均量上穿 60日均量
```

用途：短線機會。

### 波段

```text
股價接近 MA25
5日均量高於 60日均量
```

用途：主要波段型態。

### 縮量黑馬

```text
股價接近 MA25
成交量縮到 60日均量以下
且接近 20日低量
```

用途：研究潛在低量蓄勢。

---

## 5. 回測腳本

```text
scripts/backtest_2560_sector_lab.py
```

手動執行：

```bash
python scripts/backtest_2560_sector_lab.py --source yfinance
```

輸出：

```text
reports/backtests/2560_sector_events.csv
reports/backtests/2560_sector_summary.csv
reports/backtests/2560_sector_by_industry.csv
reports/backtests/2560_sector_by_pattern.csv
```

---

## 6. 評估指標

```text
5日報酬
10日報酬
20日報酬
30日報酬
60日報酬
勝率
最大不利跌幅
訊號次數
```

2560 是短線 / 波段系統，所以重點看：

```text
20日 / 30日 / 60日
```

---

## 7. 升級規則

2560 技術研究室若要進入正式頁面，至少要符合：

```text
某一產業樣本數 >= 100
某一型態在 20 / 30 / 60 日有穩定正期望
最大不利跌幅可接受
誘多型態確實表現較差，能作為排除條件
```

未通過前：

```text
不進主入口
不進 Telegram
不給資金建議
不自動交易
```
