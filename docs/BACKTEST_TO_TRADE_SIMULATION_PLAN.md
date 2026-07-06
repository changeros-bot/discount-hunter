# Backtest to Trade Simulation Plan

**Projects:** DCA 折價獵人 / 槓桿獵人  
**Status:** Simulation Upgrade Plan  
**Owner:** Josh  
**Project Owner:** ChatGPT / Josh OS Project Owner  
**Updated:** 2026-07-06

---

## 1. Purpose

目前兩個回測工具都屬於「訊號研究」：

```text
折價獵人：測折扣層級是否合理
槓桿獵人：測戰術訊號是否有研究價值
```

下一階段要升級為「交易模擬」：

```text
每次真的假設買 5U
計算成本、部位、現金、停損、停利、停止加碼、總資金上限
```

這樣才能回答：

```text
這套規則如果真的執行，資金會怎麼變化？
會不會太早打光現金？
哪個標的佔比過高？
最大浮虧是否可承受？
```

---

## 2. Discount Hunter Simulation

### 2.1 Initial Assumptions

| Item | Value |
|---|---:|
| 單筆買入 | 5U |
| 單一標的上限 | 15U / 30U，待測 |
| 每月預算 | 50U / 100U，待測 |
| 總策略資金 | 300U / 500U，待測 |
| 賣出 | 初版不賣，只累積 |
| 成本 | 初版先不含滑價，第二版加入 |

### 2.2 Simulation Logic

```text
每日更新價格
→ 計算距離 52週高點 / Cycle High 回撤
→ 觸發層級
→ 檢查該層是否已買過
→ 檢查單檔上限
→ 檢查本月預算
→ 買入 5U
→ 更新持倉與現金
```

### 2.3 Outputs

```text
總投入
目前市值
未實現損益
最大浮虧
每檔持倉成本
每檔部位占比
買入次數
本月預算耗盡次數
錯過訊號次數
```

---

## 3. Leveraged Hunter Simulation

### 3.1 Initial Assumptions

| Item | Value |
|---|---:|
| 單筆買入 | 5U |
| 單一 P1 標的上限 | 15U |
| 單一 P2 標的上限 | 5U |
| P3 | 不交易 |
| 槓桿獵人總資金 | 50U |
| 最大持有天數 | 20 / 60 日，待測 |
| 停利 | +8% / +12% / +20%，待測 |
| 停損 | -6% / -10% / -15%，待測 |

### 3.2 Simulation Logic

```text
每日更新價格
→ 判斷戰術訊號 A/B/C
→ Gate 通過才允許建立小部位
→ 買入 5U
→ 每日檢查停利 / 停損 / 最大持有天數 / Kill Switch
→ 出場後記錄交易結果
```

### 3.3 Outputs

```text
交易次數
勝率
平均報酬
平均持有天數
最大單筆虧損
最大連續虧損
最大資金佔用
期末資產
是否優於只持有 QQQ / BTC / 現金
```

---

## 4. Required Files

新增或升級：

```text
scripts/simulate_discount_hunter.py
scripts/simulate_leveraged_hunter.py
reports/backtests/discount_hunter_simulation.csv
reports/backtests/leveraged_hunter_simulation.csv
```

---

## 5. Guardrails

模擬結果不能直接變成自動交易。

升級條件：

```text
回測結果穩定
交易模擬可承受
Quality / Gate 可用
代幣價格與原股偏離可監控
Telegram 確認流程完成
Kill Switch 完成
```

---

## 6. Project Owner Decision

下一步先做兩支模擬腳本：

1. `scripts/simulate_discount_hunter.py`
2. `scripts/simulate_leveraged_hunter.py`

先用 CSV / yfinance 原股資料跑模型。

正式接自動交易前，必須再加入 Binance 代幣價格、流動性、價差與 API 風險檢查。
