# V18 Quality Checklist Automation Scope

**Project:** DCA 折價獵人  
**Playbook:** Josh Portfolio V18.0  
**Status:** Implementation Scope  
**Owner:** Josh  
**Project Owner:** ChatGPT / Josh OS Project Owner  
**Updated:** 2026-07-06

---

## 1. Decision

Quality Checklist 不做成一開始就全自動風控。

正式方向：

> 從「半自動」開始：自動抓客觀財務資料，App 給出初步狀態，Josh 最終確認。

理由：

- 財務數字可以自動化。
- 護城河、管理層、投資假設是否成立，不能完全交給自動判斷。
- 若一開始做太重，會拖慢自動化交易進度。
- 這個功能的主要價值是「防止價格便宜但品質惡化時繼續買」。

---

## 2. Value Assessment

### High Value

適用於：

- AI 基礎建設
- AI 支援基礎建設
- 平台型公司
- 高成長深折扣
- 加密創新中有現金流或協議收入資料者

主要價值：

1. 避免把基本面惡化誤判成折扣。
2. 避免只因價格下跌而加碼。
3. 讓「允許買入」不只是價格訊號。
4. 為自動交易加第一層安全閘門。

### Medium Value

適用於：

- BTC

BTC 不適合用公司財務 Checklist。BTC 只需要獨立檢查：

- Cycle High 回撤
- 長期持有假設是否仍成立
- 交易所 / 錢包資料是否正常
- 配置上限是否超過

### Low Value

適用於：

- Core ETF：VOO / QQQM / 0050 / VT / VWRA

ETF 不需要公司級 Quality Checklist。ETF 只需要：

- 指數是否仍為核心配置
- 費用率是否合理
- 是否仍符合長期 DCA 目的
- 是否有替代 ETF 更好

---

## 3. Chinese Checklist

### 客觀條件 Objective

| 中文項目 | 自動化程度 | 初期資料 |
|---|---:|---|
| 營收成長 | 高 | 最近季度營收 YoY / TTM 營收 |
| 自由現金流 | 高 | FCF / FCF Margin |
| 毛利率 | 高 | Gross Margin / YoY 變化 |
| 資產負債表 | 中高 | 現金、負債、流動比率、淨現金 |
| 資本支出趨勢 | 中 | CapEx / Revenue、CapEx YoY |

### 質化條件 Qualitative

| 中文項目 | 自動化程度 | 初期處理 |
|---|---:|---|
| 產業領導地位 | 中 | AI 摘要 + Josh 確認 |
| 護城河 | 低中 | AI 摘要 + Josh 確認 |
| 管理層品質 | 低中 | AI 摘要 + Josh 確認 |
| 投資假設是否成立 | 中 | Playbook Thesis + Josh 確認 |

---

## 4. Status Labels

App 內只顯示中文：

- 通過
- 觀察
- 失敗
- 未檢查

總狀態：

- 品質通過
- 品質觀察
- 品質失敗
- 尚未檢查

---

## 5. Decision Impact

### 允許買入

需要：

1. 價格觸發買點
2. 品質狀態 = 通過
3. 部位未超限
4. 資料來源正常
5. 預算允許

### 等待確認

出現於：

- 價格到買點，但品質尚未檢查
- 價格到買點，但財務資料過舊
- 價格到買點，但質化條件尚未確認
- 資料來源有部分缺失

### 不可新增

出現於：

- 品質失敗
- 投資假設破裂
- 部位超過上限
- 資料錯誤嚴重
- 手動鎖定禁止新增

---

## 6. Data Strategy

### Phase Q1 — Manual + Auto Shell

- App 加入中文 Checklist UI
- 每檔可以手動設為：通過 / 觀察 / 失敗 / 未檢查
- 狀態會影響「允許買入」判斷

### Phase Q2 — Objective Auto Fetch

自動抓：

- 營收
- 營收年增率
- 毛利率
- 自由現金流
- 現金與負債
- CapEx

App 不直接下結論，只顯示：

- 原始數字
- 趨勢
- 建議狀態
- Josh 確認按鈕

### Phase Q3 — AI Summary Assist

針對質化條件產生摘要：

- 產業領導地位
- 護城河
- 管理層品質
- 投資假設是否成立

AI 只給建議，不直接改最終狀態。

---

## 7. Project Owner Assessment

Quality Checklist 值得做，但不能做太重。

最有價值的版本不是「完整自動化研究報告」，而是：

> 當價格到買點時，系統能阻止品質惡化的資產進入自動化交易流程。

因此 V18 的實作範圍應該是：

1. 中文 Checklist UI
2. 手動狀態保存
3. 客觀財務資料自動抓取
4. 狀態影響決策
5. 質化條件先保留人工確認

不應該在 V18 做：

- 完全自動判斷護城河
- 完全自動判斷管理層
- 因 AI 判斷直接下單
- 對 ETF 套用公司級財報 Checklist

---

## 8. Automation Trading Link

Quality Checklist 是自動交易的前置安全閘門。

自動化交易流程中，Quality 必須這樣使用：

```text
價格觸發
→ Quality Check
→ Position Limit Check
→ Budget Check
→ Telegram Confirm
→ Order Draft
→ Manual Confirm / Semi-Auto Execute
```

初期不允許：

```text
價格觸發
→ 直接自動下單
```
