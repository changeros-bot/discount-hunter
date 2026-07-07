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

但如果未來通過嚴格回測，可以升級成交易系統候選。

---

## 2. 方法論優先風險

### A. 存活者偏差

目前第一版標的清單是人工挑選的現代知名股票與 ETF。

這代表：

```text
回測可能高估訊號效果
因為名單中包含大量事後已知成功或仍存活的標的
```

正式報告必須揭露：

```text
第一版結果只能代表「這批現代候選標的」
不能代表全市場普遍有效
```

未來改進方向：

```text
用歷史時間點的市值前 N 大 / 成交量前 N 大動態名單
加入退市與失敗股票
把近五年上市股票獨立分組
```

### B. 超額報酬，而不只絕對報酬

2010 後美股長期偏多，固定天數後正報酬不一定代表 2560 有 alpha。

因此 V0.2 開始必須同時輸出：

```text
標的原始報酬
同期 SPY / QQQ 基準報酬
超額報酬 = 標的報酬 - 基準報酬
超額勝率 = 超額報酬 > 0 的比例
```

第一版程式已加入預設 benchmark：

```text
--benchmark SPY
```

### C. 市場狀態先標記，不先過濾

Research Only 階段不直接用 `SPY > MA200` 過濾訊號。

先在事件檔中記錄：

```text
benchmark_above_ma200
above_ma200
```

再用報表比較：

```text
大盤多頭時的 2560 表現
大盤空頭時的 2560 表現
```

這樣可以分辨：

```text
是 2560 訊號本身有效
還是單純搭上大盤順風車
```

### D. 即時性與研究邊界

2560 V0.5 僅允許使用日線收盤資料生成正式訊號。

```text
盤中資料僅供觀察
不得作為正式訊號依據
不得用盤中價格回頭改寫日線訊號
```

正式流程固定為：

```text
收盤後生成訊號
隔日開盤紙上進場
持有期間每日收盤更新停損 / 停利 / 到期狀態
```

原因：

```text
2560 是 EOD / next-day open 框架
不是分時或盤中策略
盤中成交量會失真
日均線盤中會漂移
yfinance 與 GitHub Actions 不適合低延遲監控
目前目標是驗證 edge，不是搶點
```

未來若要升級盤中架構，必須另開 V1.0+：

```text
即時行情 API
雲端服務
Telegram / LINE 推播
錯誤重試
資料品質檢查
API 金鑰管理
```

---

## 3. 研究問題

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
是否有超額報酬？
大盤多空狀態下表現是否不同？
```

---

## 4. 第一版產業分組

```text
AI半導體：NVDA, AVGO, AMD, TSM, MU, MRVL, SMCI
大型科技平台：AAPL, MSFT, GOOGL, META, AMZN, NFLX
高波動成長股：TSLA, PLTR, COIN, HOOD, RKLB, SOFI
金融支付：JPM, BAC, AXP, MA, V, PYPL
能源原物料：XOM, CVX, OXY, COP, FCX
工業基建：CAT, GE, DE, ETN, PWR
防禦消費：KO, PEP, WMT, COST, PG, MCD
ETF對照：QQQ, SPY, SMH, SOXX
```

ARKK 已暫時移出第一版 ETF 對照組，避免主動型主題 ETF 受到單一持股與基金經理人配置影響，干擾 2560 統計。

注意：高波動成長股含多檔近年上市標的，不應與 2010 年已有完整資料的成熟股票直接等權比較。

---

## 5. 型態分類

### 誘多

```text
MA25 走平或向上
短線上漲
但 5日均量仍未站上 60日均量
```

用途：驗證是否應該避開。

目前 V0.1 結果顯示誘多不一定差，代表誘多定義可能過粗，不能直接當排除條件。

### 沖量

```text
股價站上 MA25
5日均量上穿 60日均量
```

用途：短線機會。

後續可測試：

```text
VOL5 > 1.2 × VOL60
VOL5 > 1.5 × VOL60
```

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
且股價仍在 MA200 之上
```

用途：研究潛在低量蓄勢。

新增 MA200 前提是為了降低把冷門殭屍股誤判成蓄勢股的風險。

---

## 6. 回測腳本

```text
scripts/backtest_2560_sector_lab.py
scripts/simulate_2560_lab.py
```

手動執行：

```bash
python scripts/backtest_2560_sector_lab.py --source yfinance --benchmark SPY --atr-multiplier 1.5
python scripts/simulate_2560_lab.py --source yfinance --cost 0.002 --slippage 0.002
```

輸出：

```text
reports/backtests/2560_sector_events.csv
reports/backtests/2560_sector_summary.csv
reports/backtests/2560_sector_by_industry.csv
reports/backtests/2560_sector_by_pattern.csv
reports/backtests/2560_sector_by_market.csv
reports/backtests/2560_sim_events.csv
reports/backtests/2560_sim_summary.csv
reports/backtests/2560_sim_by_industry.csv
reports/backtests/2560_sim_by_pattern.csv
reports/backtests/2560_sim_by_exit.csv
```

---

## 7. V0.3 指標修正

### ATR 正規化 MA25 距離

舊版：

```text
abs(close / MA25 - 1) <= 3.5%
```

新版：

```text
abs(close - MA25) <= 1.5 × ATR14
```

目的：

```text
讓高波動股與低波動股使用同一把「波動度尺」
避免固定百分比對不同股性不公平
```

### MA25 趨勢判斷

新版同時使用：

```text
MA25 連續 3 天上揚
或 MA25 5日斜率 >= -0.3%
```

目的：

```text
降低 -0.5% 魔術數字的依賴
避免 5日斜率太短造成過多雜訊
```

---

## 8. V0.4 交易模擬規則

V0.4 使用更接近實務的 next-day open 模擬：

```text
Day 0：收盤後確認 2560 訊號
Day 1：隔日開盤價 × 1.002 紙上進場
交易成本：0.2%
```

目前最佳規則：

```text
risk_30d
停損：-8%
停利：+15%
最多持有：30 個交易日
```

V0.4 初步判定：

```text
大型科技平台：第一紙上交易組
AI半導體：第二觀察組
高波動成長股：暫不進正式紙上交易
```

---

## 9. 評估指標

```text
5日報酬
10日報酬
20日報酬
30日報酬
60日報酬
同期基準報酬
超額報酬
超額勝率
勝率
最大不利跌幅
訊號次數
SPY 是否站上 MA200
個股是否站上 MA200
ATR 距離 MA25
交易數
平均淨報酬
中位數淨報酬
平均持有天數
Profit Factor
最大單筆虧損
最大單筆獲利
```

2560 是短線 / 波段系統，所以重點看：

```text
20日 / 30日 / 60日
```

交易模擬階段重點看：

```text
risk_30d 是否在隔日開盤 + 滑價 + 成本後仍維持正中位數
Profit Factor 是否 > 1.3
最大單筆虧損是否可接受
```

---

## 10. 升級規則

2560 技術研究室若要進入正式頁面，至少要符合：

```text
某一產業樣本數 >= 100
某一型態在 20 / 30 / 60 日有穩定正期望
同時具備穩定超額報酬
交易模擬扣除成本與滑價後仍為正中位數
Profit Factor > 1.3
最大不利跌幅可接受
```

未通過前：

```text
不進主入口
不進 Telegram
不給資金建議
不自動交易
```

---

## 11. 交易系統升級路線

如果 2560 通過研究門檻，升級順序如下：

```text
V0.1 訊號研究：固定 5/10/20/30/60 日報酬
V0.2 超額報酬：扣 SPY / QQQ 同期報酬
V0.3 ATR 與市場狀態標記：ATR 正規化、SPY MA200 狀態欄
V0.4 交易模擬：next-day open、出場規則、成本、滑價
V0.5 Paper Trading：只記錄不下單
V1.0 小額人工確認交易系統
```

交易系統階段必須加入：

```text
MA25 跌破出場
VOL5 跌回 VOL60 下方出場
固定最大持有天數
固定風險上限
手續費與滑價
單筆 / 單日 / 單月風控
```

---

## 12. 即時化升級順序

即時盤中不是 V0.5 目標。

正確順序：

```text
日線回測穩定
收盤後自動產報表
隔日開盤紙上交易
加入提醒與通知
最後才考慮盤中監控
```

核心原則：

```text
先證明日線訊號有 edge
再決定是否值得付出即時 API、雲端服務與推播架構成本
```
