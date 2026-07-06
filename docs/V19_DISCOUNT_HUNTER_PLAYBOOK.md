# Josh Portfolio V19 — Discount Hunter Playbook

**Version:** V19.0 Draft  
**Status:** Ready for Review  
**Owner:** Josh  
**Project Owner:** ChatGPT / Josh OS Project Owner  
**Module:** Investment Operating System  
**Repository:** `changeros-bot/discount-hunter`  
**Last Updated:** 2026-07-06

---

## 0. Homepage Principle

> Discount Hunter 不預測市場，也不追逐最低點。它的任務是在投資假設成立的前提下，以紀律和折扣價格，持續累積高品質資產。

---

## 1. Mission

Discount Hunter 的目的不是猜底。

而是：

> 以折扣價格，逐步累積高品質資產。

Discount Hunter 不追求：

- 最低價
- 勝率最高

追求的是：

> 風險報酬比（Risk / Reward）最佳。

---

## 2. Constitution

### Rule 1 — Quality First

永遠優先品質。

不是：

> 跌很多。

而是：

> 好公司變便宜。

### Rule 2 — Price Is Trigger

價格只是觸發器，不是買進理由。

真正理由：

> Investment Thesis 仍然成立。

### Rule 3 — Buy Point Is Permission

所有買點都只是：

> 允許開始買。

不是：

> 必須買。

### Rule 4 — Quality > Price

任何價格，都不能覆蓋 Quality Checklist。

---

## 3. Asset Classification

不是所有資產都使用同一套 Discount。

### A. Core ETF

**代表：** VOO / QQQM / 0050 / VT / VWRA  
**策略：** Pure DCA + Discount 加碼

### B. AI Infrastructure

**代表：** NVDA / TSM / AVGO / MU / MRVL / AMD  
**策略：** Discount Hunter

### C. AI Supporting Infrastructure

**代表：** VRT / ETN / GE Vernova / Modine  
**策略：** Discount Hunter，但估值要求更高

### D. Platform

**代表：** GOOGL / AMZN / META  
**策略：** Discount Hunter

### E. Bitcoin

**代表：** BTC  
**策略：** 完全獨立 BTC Engine

### F. Crypto Innovation

**代表：** ETH / SOL / AAVE  
**策略：** 小部位，獨立規則，深折扣

### G. High Growth

**代表：** RKLB / SPCX / ASTS  
**策略：** 深折扣

---

## 4. Discount Rules

### 4.1 Core ETF

目的：累積資產。

主要：DCA。  
若大跌：允許額外加碼。

暫定：

| Layer | Drawdown |
|---|---:|
| L1 | -10% |
| L2 | -20% |
| L3 | -30% |

### 4.2 AI Infrastructure

採 Beta + MDD 校準。

原則：

> 波動越高，買點越深。

範例：

- 低波動：TSM / AVGO，第一層約 -15%
- 高波動：MRVL / AMD / MU，第一層約 -20%

**注意：實際買點由回測決定，不在 V19.0 固定。**

### 4.3 AI Supporting Infrastructure

比照 AI Infrastructure，但估值要求更高。

### 4.4 Platform

通常波動較低。

暫定第一層約 -15%。

### 4.5 Bitcoin Engine

BTC 完全獨立。

固定：Monthly DCA。  
另外：Cycle High Discount。

暫定：

| Layer | Drawdown |
|---|---:|
| D1 | -20% |
| D2 | -35% |
| D3 | -50% |
| D4 | -65% |
| D5 | -80% |

**注意：上述買點為暫定版，後續以歷史回測決定最終版本。**

### 4.6 Crypto Innovation

ETH / SOL / AAVE 不固定 DCA。

只做 Discount，等待深折扣。

### 4.7 High Growth

RKLB / SPCX / ASTS 起始至少 -35%。

目的：避免把正常波動誤判為折扣。

---

## 5. Quality Checklist

任何折扣都必須先過 Objective，再過 Qualitative。

### Objective

- [ ] Revenue
- [ ] FCF
- [ ] Gross Margin
- [ ] Balance Sheet
- [ ] CapEx Trend

### Qualitative

- [ ] Industry Leader
- [ ] Moat
- [ ] Management
- [ ] Investment Thesis

若 Objective 重大失敗：

> 停止 Discount。

---

## 6. Position Limits

整體 Portfolio：

| Type | Limit |
|---|---:|
| 單一股票 | <= 10% |
| 高風險 | <= 3% |
| Crypto Innovation | <= 2% |
| BTC | 依 Portfolio 配置上限，例如目標 20% |

超過上限：

> 停止新增，不是立即賣出。

---

## 7. Asset Lifecycle

所有資產必須經過：

```text
Research
→ Watchlist
→ Small Position
→ Core Candidate
→ Core Portfolio
→ Watch List
→ Exit
```

禁止：

> Research 直接變 Core。

---

## 8. Exit Rules

退出不是因為價格。

退出是因為：

> Investment Thesis Broken。

例如：

- CUDA 失去優勢
- GPU 不是 AI 核心
- Management 重大問題
- 財務重大問題
- 產業地位根本改變

---

## 9. Rebalance

目的：控制風險，不是獲利了結。

超過 Position Limit：停止新增。  
必要時：逐步再平衡。

---

## 10. Not-To-Do List

Discount Hunter 永遠不要：

- 追高
- 因新聞買股
- 因 ETF 分割買進
- 因社群 FOMO 買進
- 因短期下跌否定長期 Thesis
- 因價格便宜忽略基本面

---

## 11. Pending Backtests — V19.1

以下規則暫不定案，需以歷史資料回測驗證：

1. AI Infrastructure 折扣門檻：依 Beta + 歷史最大回撤 MDD 校準，而非統一 -15% / -25% / -35% / -50%。
2. BTC 五層折扣：驗證 -20% / -35% / -50% / -65% / -80% 是否優於其他組合。
3. ETF 加碼門檻：確認 -10% / -20% / -30% 是否更符合長期累積目標。
4. Position Limit：檢驗 8% / 10% / 12% 對組合風險與報酬的影響。

---

## 12. Version Roadmap

| Version | Task |
|---|---|
| V19.0 | Discount Hunter Playbook 封版候選 |
| V19.1 | 完成 AI Infrastructure 與 BTC 折扣規則的歷史回測 |
| V19.2 | 完成 ETF / BTC / AI Infrastructure / Platform / Crypto Innovation 各 Asset Playbook |
| V19.3 | 建立風險管理章節：Position Limits / Cash Management / Rebalance / Lot Management |
| V20 | 整合完整 Investment Operating System：Constitution + Playbooks + Risk Management + Annual Review |

---

## 13. App Update Responsibility

Project Owner must keep app versions aligned with this Registry:

- Discount Hunter app: V17.x UI / V19 Playbook logic reference
- Telegram daily report: must follow V19 decision semantics
- Josh OS four-in-one entry: must label Discount Hunter as the investment decision engine
- Backtest tasks must not be promoted into final buy rules before V19.1 validation

---

## 14. Registry Update Summary

```yaml
project: Discount Hunter
portfolio_version: Josh Portfolio V19
playbook_version: V19.0
status: Ready for Review
owner: Josh
project_owner: ChatGPT / Josh OS Project Owner
module: Investment Operating System
source_of_truth: docs/V19_DISCOUNT_HUNTER_PLAYBOOK.md
pending_backtest_version: V19.1
```
