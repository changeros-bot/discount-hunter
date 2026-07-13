# 折扣獵人 V17.5｜紙上交易治理憲法

版本：V1.0  
生效日：2026-07-13  
適用範圍：核心正式 10 檔、預備名單 18 檔、預備名單2 18 檔，以及其後新增的所有紙上驗證候選標的。  
最高權限：任何正式晉級、替換或移除，均須 Josh 明確批准。

---

## 第一條｜最高目的

本制度的目的不是找出短期漲幅最大的標的，也不是讓正式名單持續擴張，而是：

> 只讓少數具備可靠資料、足夠證據、合理買點、長期體質與組合價值的標的，取得晉級資格。

任何短期報酬、熱門敘事或單月排名，都不得凌駕於本憲法。

---

## 第二條｜三區角色分離

### 核心正式 10 檔

- 用於檢查既有投資邏輯是否仍成立。
- 可接受降級、替換或移除審查。
- 不參加一般候選晉級競賽。

### 預備名單 18 檔

- 第一批候選池。
- 與預備名單2使用同一套治理標準。

### 預備名單2 18 檔

- 第二批候選池。
- 與預備名單交叉比較時，只能比較已通過資格與證據門檻的標的。

不得把 46 檔全部直接排成一條絕對名次。

---

## 第三條｜正式決策順序

任何標的均依下列順序審查：

1. Hard Gate
2. Evidence Coverage
3. Loss Attribution
4. Dimension Scoring
5. Strategy Redesign
6. Portfolio Selection
7. Josh Approval

前一層未通過，不得進入下一層。

---

## 第四條｜Hard Gate：資格性否決

以下任一情況成立，標的不得進入 100 分評分：

- 代號未確認。
- underlying 身分不明。
- token 與母資產映射不可驗證。
- 報價倍率、幣別或拆股處理錯誤。
- 52 週高點資料明顯錯誤。
- 價格嚴重脫鉤且無合理解釋。
- 流動性差到無法合理模擬成交。
- 商品結構與折扣獵人策略不相容。
- 真實資產已下市、合併或性質重大改變。

處理結果：

```text
maturityClass = HARD_BLOCKED
score = null
eligibleForPromotion = false
```

資格性風險不得被其他高分抵銷。

SKHYon、DRAMon 雖已確認代號存在，仍須持續驗證 underlying、報價倍率、幣別轉換、52 週高點來源與追蹤偏差。

---

## 第五條｜Evidence Coverage：證據不足不等於表現差

每檔先標記：

```text
SUFFICIENT
PARTIAL
INSUFFICIENT
```

證據充分性至少包含：

- 有效交易日數。
- 報價覆蓋率。
- 是否有足夠價格波動。
- 是否觸發折價層級。
- 是否存在可比較的產業或資產基準。
- 是否能實際觀察策略行為。

低波動標的一個月內未觸發 D1，不得因此被扣成低分，只能標記：

```text
discountEvidence = INSUFFICIENT
```

正式輸出必須同時顯示：

```text
normalizedScore
evidenceCoverage
```

高分但證據不足，成熟度最多只能為 B_PENDING。

---

## 第六條｜Loss Attribution：先判斷為什麼虧，再決定是否扣分

### SYSTEMATIC

市場或產業普跌，公司相對表現正常，基本面未惡化。

```text
performanceScore = PENDING
maturityClass 最多 B_PENDING
```

### IDIOSYNCRATIC

公司自身財報、指引、競爭地位或特定事件惡化。

```text
正常扣分
必要時進 C_REDESIGN 或 D_REJECT
```

### STRATEGY_DESIGN_ERROR

買點太淺、層級過密、倉位吸金過快、波動假設錯誤。

```text
maturityClass = C_REDESIGN
保留資產，淘汰目前策略版本
```

### DATA_OR_TOKEN_ERROR

報價、映射、倍率或資料來源異常。

```text
maturityClass = DATA_REVIEW 或 HARD_BLOCKED
不得把錯誤價格視為投資虧損
```

### UNDETERMINED

目前無法確認原因。

```text
performanceScore = PENDING
maturityClass 最多 B_PENDING
```

最高原則：

> 淘汰的是投資邏輯或策略版本失效，不是單純帳面虧損。

---

## 第七條｜100 分評分架構

只有通過 Hard Gate，且對應維度具備足夠證據，才可評分。

| 項目 | 權重 |
|---|---:|
| 公司與資產體質 | 30 |
| 折價策略適配度 | 25 |
| 紙上交易表現 | 20 |
| 資料與交易品質 | 15 |
| 組合價值 | 10 |

### 公司與資產體質 30 分

- 商業模式與護城河：8
- 獲利與現金流品質：7
- 財務安全性：5
- 產業地位：5
- 長期成長持續性：5

此項只回答：

> 這是不是值得長期研究和持有的資產？

### 折價策略適配度 25 分

- D1 是否過淺或過深。
- 層級是否合理。
- 層級間距是否符合波動。
- 倉位配置是否合理。
- 52 週高點是否適合作為策略基準。

此項只回答：

> 目前這套折價層級、倉位與波動假設是否適合這項資產？

不得因公司品質高而在此重複加分。

### 紙上交易表現 20 分

30 天階段不以夏普比率作主要依據，優先觀察：

- 相對基準表現。
- 回撤是否超出該資產合理波動。
- 建倉後行為是否符合策略假設。
- 是否反覆觸發造成過早接刀。
- token 是否出現異常偏離。

### 資料與交易品質 15 分

Hard Gate 通過後，才評：

- 報價穩定性。
- 輕微缺漏率。
- 價差與流動性品質。
- 交易成本。
- 追蹤穩定度。

### 組合價值 10 分

- 是否補足正式組合缺口。
- 是否與正式 10 檔高度重複。
- 是否具備可替換價值。
- 是否增加不必要維護成本。

---

## 第八條｜動態正規化

證據不足的維度不得填零分，也不得硬塞固定中性分。

```text
normalizedScore = earnedScore / availableScore × 100
```

同時保留：

```text
evidenceCoverage = availableScore / 100 × 100%
```

例如可評維度總滿分為 55，取得 43 分：

```text
normalizedScore = 43 / 55 × 100 = 78.2
evidenceCoverage = 55%
```

該標的不得僅因 78.2 分而晉級。

---

## 第九條｜治理狀態

| 狀態 | 意義 |
|---|---|
| HARD_BLOCKED | 資格問題，禁止評分或晉級 |
| DATA_REVIEW | 資料異常，暫停判斷 |
| B_PENDING | 證據不足或仍需延長驗證 |
| C_REDESIGN | 資產可留，但策略需重做 |
| D_REJECT | 有充分證據證明不適合 |
| A_CANDIDATE | 通過初審，取得晉級提案資格 |
| QUALIFIED_REDUNDANT | 標的合格，但組合角色重複 |
| APPROVED | Josh 明確批准後正式晉級 |

重複標的不應直接判 D。

MU、SKHY、DRAM 可同時合格，但最終可能只保留一檔個股，或一檔個股加一檔 ETF；其餘可標記為 QUALIFIED_REDUNDANT。

---

## 第十條｜A_CANDIDATE 最低條件

A_CANDIDATE 至少需全部滿足：

```text
Hard Gate = PASS
normalizedScore >= 80
evidenceCoverage >= 80%
fundamentalScore >= 22/30
dataQualityScore >= 12/15
無重大基本面惡化
無資料或映射異常
策略不需重做
```

A_CANDIDATE 只代表取得提案資格，不代表自動加入正式區。

---

## 第十一條｜B、C、D 判定

### B_PENDING

任一情況成立：

- normalizedScore >= 65，但證據仍不足。
- evidenceCoverage < 80%。
- 折價層級尚未充分觸發。
- Loss Attribution 為 SYSTEMATIC 或 UNDETERMINED。

### C_REDESIGN

- 公司體質合格。
- 資料資格通過。
- 但買點、層級、倉位或波動假設不適合。

C 代表保留資產、淘汰策略版本。

### D_REJECT

需有充分證據支持：

```text
normalizedScore < 50
AND evidenceCoverage >= 70%
AND 非純系統性下跌
```

或出現：

- 基本面明顯惡化。
- 長期投資論點失效。
- 在同類標的中被另一標的全面支配，且無額外組合價值。

30 天階段原則上不得草率判 D。

---

## 第十二條｜策略優化方式

### 折價層級

原始範例：

```text
-15% / -25% / -35% / -50%
```

若過早建倉，可改為：

```text
-20% / -30% / -40% / -55%
```

高波動資產可改為：

```text
-30% / -45% / -60% / -75%
```

### 倉位配置

- 高品質、低波動：5 / 10 / 15 USD
- 中等風險：5 / 5 / 10 / 15 USD
- 高風險：3 / 5 / 7 / 10 USD

### 分類調整

個股、單一公司 token、ETF 不得視為同一角色。

### 資料修正

發現以下問題時，先修資料，不拿錯誤資料做淘汰判斷：

- 52 週高點錯誤。
- 拆股未調整。
- token 與母資產脫鉤。
- 市值、成交量或幣別資料不一致。

---

## 第十三條｜Token 追蹤偏差

不得直接用 token 顯示價格與母股一股價格比較 3% 偏差。

應先正規化：

```text
normalizedTokenPrice
= tokenPrice / tokenRatio / FXAdjustment / corporateActionFactor
```

再在相同時間戳或允許時間窗內比較：

```text
trackingDeviation
= normalizedTokenPrice / referenceUnderlyingPrice - 1
```

需處理：

- token 比例。
- ADR 比例。
- 幣別轉換。
- 拆股與公司行動。
- 市場交易時段差異。
- 延遲報價。

---

## 第十四條｜52 週高點定義

系統須區分：

```text
underlyingHigh52w
tokenHigh52w
strategyReferenceHigh
```

原則：

- 一般美股 Token：優先使用 underlying adjusted 52-week high。
- 新上市 Token：可使用上市以來高點，但必須標記 SINCE_LISTING。
- ETF Token：使用 ETF 本身高點，不使用成分股高點。
- 加密資產：使用獨立週期規則，不與股票共用。

---

## 第十五條｜30、90、180 天治理節奏

### T+30 天：資料與系統驗收

主要檢查：

- 代號與映射。
- 報價穩定性。
- 52 週高點。
- 折價層級運作。
- 資料覆蓋率。
- 明顯策略錯誤。

主要結果：

```text
HARD_BLOCKED
DATA_REVIEW
B_PENDING
C_REDESIGN
A_CANDIDATE
```

30 天原則上不做正式晉級或正式淘汰，除非投資論點已明確失效。

### T+90 天：策略有效性初審

開始正式檢查：

- 相對基準。
- 回撤與波動。
- 觸發品質。
- 倉位效率。
- 虧損歸因。
- 產業週期適配。

此時才適合正式產生 A/B/C/D。

### T+180 天：正式晉級與汰換

最後檢查：

- 基本面是否持續成立。
- 是否經歷不同市場環境。
- 是否優於現有正式標的。
- 是否補足組合缺口。
- 是否造成過度重複。

最多提出 1–3 檔晉級，優先採替換制。

---

## 第十六條｜正式晉級門檻

任何正式加入 `/v17` 的標的，必須通過：

1. 公司體質通過。
2. 資料品質通過。
3. 折價策略通過。
4. 紙上風險表現通過。
5. 組合重複度檢查。
6. 替換價值檢查。
7. Josh 明確批准。

系統不得自動將任何候選標的加入 `/v17`。

每次最多晉級 1–3 檔，正式 10 檔已足夠時優先採替換制。

---

## 第十七條｜正式報告輸出

正式審查至少輸出六張表：

1. Hard Gate 表。
2. Evidence Coverage 表。
3. Loss Attribution 表。
4. Strategy Fit 表。
5. Fundamental Review 表。
6. Final Decision 表。

Final Decision 表至少包含：

| 標的 | Gate | Coverage | 歸因 | 分數 | 狀態 | 行動 |
|---|---|---:|---|---:|---|---|

不得把 HARD_BLOCKED、PENDING 與完整樣本標的硬排成 1–46 名。

僅可對符合資格與證據標準的標的進行 `Rank within eligible set`。

---

## 第十八條｜資料架構

唯一正式資料源：

```text
Neon = 唯一正式資料源
API = 評分與決策引擎
App = 操作與顯示介面
Google Sheets / Excel = 可選唯讀匯出，不參與核心判斷
```

不得建立第二套可寫入的策略真相來源。

---

## 第十九條｜禁止事項

- 禁止用短期上漲證明公司優質。
- 禁止用短期下跌證明策略失敗。
- 禁止忽略不同資產的風險差異。
- 禁止把 ETF、個股與單一公司 Token 直接混為同類。
- 禁止讓高度重複標的全部晉級。
- 禁止因已投入時間而拒絕淘汰。
- 禁止一次晉級過多造成系統臃腫。
- 禁止任何真實下單或自動交易。
- 禁止未經 Josh 明確批准修改 `/v17` 正式名單。

---

## 第二十條｜不可被推翻的七項最高原則

```text
資格問題不能被高分洗掉
證據不足不能被當成低分
系統性下跌不能被當成策略失敗
策略失敗不等於公司失敗
標的合格不等於組合需要
高分不等於自動晉級
任何正式晉級都需要 Josh 批准
```

---

## 第二十一條｜憲法修改程序

本文件為紙上交易治理最高規則。

任何修改必須：

1. 明確指出修改條文。
2. 說明修改原因與風險。
3. 不得以單次行情或單一標的結果為理由臨時放寬規則。
4. 經 Josh 明確批准後才生效。
5. 留下版本與日期紀錄。

未經批准的程式邏輯、UI 顯示或自動化結果，不得視為憲法修訂。
