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

---

## 2. Josh Confirmed Simulation Parameters

### 2.1 Discount Hunter

| Item | Value |
|---|---:|
| 單筆買入 | 5U |
| 每月預算 | 100U |
| 總策略資金 | 300U |
| 單一標的上限 | 40U |
| 賣出 | 初版不賣，只累積 |
| 成本 | 初版先不含滑價，第二版加入 |

### 2.2 Leveraged Hunter

| Item | Value |
|---|---:|
| 單筆買入 | 5U |
| 總策略資金 | 50U |
| 單一標的上限 | 15U |
| 停利 | +12% |
| 停損 | -8% |
| 持有時間 | 30日 |
| P3 | 不交易 |

---

## 3. Discount Hunter Simulation Logic

```text
每日更新價格
→ 計算距離 52週高點 / Cycle High 回撤
→ 觸發層級
→ 檢查該層是否已買過
→ 檢查單檔上限 40U
→ 檢查本月預算 100U
→ 檢查總策略資金 300U
→ 買入 5U
→ 更新持倉與現金
```

### Outputs

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

## 4. Leveraged Hunter Simulation Logic

```text
每日更新價格
→ 判斷戰術訊號 A/B/C
→ Gate 通過才允許建立小部位
→ 買入 5U
→ 每日檢查停利 +12%
→ 每日檢查停損 -8%
→ 最多持有 30 日
→ 出場後記錄交易結果
```

### Outputs

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

## 5. Required Files

已建立 / 已升級：

```text
scripts/simulate_discount_hunter.py
scripts/simulate_leveraged_hunter.py
scripts/backtest_leveraged_hunter.py
```

輸出目標：

```text
reports/backtests/discount_hunter_simulation.csv
reports/backtests/discount_hunter_simulation_summary.csv
reports/backtests/leveraged_hunter_simulation.csv
reports/backtests/leveraged_hunter_simulation_summary.csv
```

---

## 6. Guardrails

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

## 7. Project Owner Decision

Josh 已確認模擬參數。

下一步：

1. 讓 backtest output 產生 30 日欄位，配合槓桿獵人持有 30 日。
2. 建立 JSON summary API，讓 App 可以讀取模擬結果。
3. Vercel / GitHub Actions 後續可接定期產生報告。
4. 正式接自動交易前，必須再加入 Binance 代幣價格、流動性、價差與 API 風險檢查。
