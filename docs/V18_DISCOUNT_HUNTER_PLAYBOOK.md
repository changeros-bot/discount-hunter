# Josh Portfolio V18 — Discount Hunter Playbook

**Version:** V18.0  
**Status:** Ready for Review  
**Owner:** Josh  
**Project Owner:** ChatGPT / Josh OS Project Owner  
**Module:** Investment Operating System  
**Repository:** `changeros-bot/discount-hunter`  
**Last Updated:** 2026-07-06

---

## 0. Version Governance

V18.0 is the current official Playbook for the Discount Hunter app.

V19.0 is a future draft only and must not replace V18.0 until V18 is reviewed and promoted.

Current app label:

```text
App：Discount Hunter V17.1
Playbook：Josh Portfolio V18.0
Status：Ready for Review
```

---

## 1. Mission

Discount Hunter 的目的不是猜底，而是：

> 以折扣價格，逐步累積高品質資產。

Discount Hunter 不追求最低價，也不追求短期勝率；追求的是風險報酬比最佳。

---

## 2. Constitution

1. **品質優先**：不是跌很多就買，而是好公司變便宜。
2. **價格只是觸發器**：價格不是買進理由，Investment Thesis 仍成立才是理由。
3. **買點只是允許買入**：買點不是必須買。
4. **品質大於價格**：任何折扣都不能覆蓋品質檢查。

---

## 3. 中文資產分類

| 中文分類 | 代表資產 | 策略 |
|---|---|---|
| 核心 ETF | VOO / QQQM / 0050 / VT / VWRA | Pure DCA + 大跌加碼 |
| AI 基礎建設 | NVDA / TSM / AVGO / MU / MRVL / AMD | Discount Hunter |
| AI 支援基礎建設 | VRT / ETN / GE Vernova / Modine | Discount Hunter，估值要求更高 |
| 平台型公司 | GOOGL / AMZN / META | Discount Hunter |
| 比特幣引擎 | BTC | 獨立 Cycle High Engine |
| 加密創新 | ETH / SOL / AAVE | 小部位，深折扣 |
| 高成長深折扣 | RKLB / SPCX / ASTS | 起始至少深折扣，避免正常波動 |

---

## 4. Decision Status Framework

App 狀態必須使用中文，且不能直接把觸發買點寫成「建議買」。

| 狀態 | 條件 | 意義 |
|---|---|---|
| 觀察中 | 價格尚未觸發買點 | 不買，等待 |
| 允許買入 | 價格觸發 + 品質通過 + 部位未超限 + 資料正常 + 預算允許 | 可以買，但不是必須買 |
| 等待確認 | 價格觸發，但品質、資料、預算或規則仍未確認 | 需要人工確認 |
| 不可新增 | 品質失敗、Thesis 破裂、部位超限、資料錯誤或手動鎖定 | 不允許新增 |

---

## 5. Quality Checklist — V18 Scope

Quality Checklist 從半自動開始。

### 客觀條件

- 營收成長
- 自由現金流
- 毛利率
- 資產負債表
- 資本支出趨勢

### 質化條件

- 產業領導地位
- 護城河
- 管理層品質
- 投資假設是否成立

### 狀態

- 通過
- 觀察
- 失敗
- 未檢查

### 自動化範圍

客觀財務資料可以自動抓取並產生建議狀態。質化條件由 AI 協助整理，Josh 最終確認。

---

## 6. Discount Rules — Pending Backtest

以下買點不得直接升級為正式規則，必須等回測完成。

| 類別 | 待測方案 |
|---|---|
| 核心 ETF | -10 / -20 / -30，-15 / -25 / -35 |
| AI 基礎建設 | -15 / -25 / -35 / -50，-20 / -30 / -40 / -55，-25 / -35 / -45 / -60 |
| 比特幣引擎 | -20 / -35 / -50 / -65 / -80，-25 / -40 / -55 / -70 / -85 |
| 高成長深折扣 | -35 / -50 / -65 |

---

## 7. Auto-Trading Roadmap

自動化交易要推進，但每版都必須有安全閘門。

| Version | 自動化交易進度 |
|---|---|
| V17.2 | 訊號只讀：版本治理、中文分類、決策狀態框架 |
| V17.3 | Quality Checklist 手動 / 半自動雛形 |
| V17.4 | 客觀財務資料自動抓取 |
| V17.5 | Quality 狀態接進決策引擎 |
| V17.6 | Position Limit / Budget Check |
| V17.7 | Telegram 確認 / 略過 / 延後 |
| V17.8 | 產生下單草稿，不直接送單 |
| V17.9 | 小額白名單半自動確認下單 |
| V18.1 | 回測結果進 Playbook |
| V18.2 | 有限自動交易測試：Kill Switch + 日限額 + 月限額 + 錯誤停止 |

---

## 8. Current Implementation Priorities

1. 修正 Registry：V18.0 為正式版本，V19.0 為 Future Draft。
2. App 顯示：Discount Hunter V17.1 + Playbook V18.0。
3. App 中文化：資產分類與 Quality Checklist 全中文。
4. 回測先跑價格層級，不混入財報。
5. Quality Checklist 半自動開始，不做過度工程化。
6. 自動化交易每個版本都要推進一小步。
