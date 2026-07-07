# Backtest to Trade Simulation Plan

**Project:** DCA 折價獵人  
**Status:** Simulation Upgrade Plan  
**Owner:** Josh  
**Project Owner:** ChatGPT / Josh OS Project Owner  
**Updated:** 2026-07-07

---

## 1. Purpose

目前回測工具屬於「訊號研究」：

```text
折價獵人：測折扣層級是否合理
```

下一階段要升級為「交易模擬」：

```text
每次真的假設買 5U
計算成本、部位、現金、停止加碼、總資金上限
```

---

## 2. Josh Confirmed Simulation Parameters

| Item | Value |
|---|---:|
| 單筆買入 | 5U |
| 每月預算 | 100U |
| 總策略資金 | 300U |
| 單一標的上限 | 40U |
| 賣出 | 初版不賣，只累積 |
| 成本 | 初版先不含滑價，第二版加入 |

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
```
