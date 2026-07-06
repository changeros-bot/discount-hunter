# Leveraged Hunter Candidate Watchlist

**Project:** 槓桿獵人  
**Status:** Binance Tokenized Universe Only / Not Buy List  
**Owner:** Josh  
**Project Owner:** ChatGPT / Josh OS Project Owner  
**Updated:** 2026-07-06

---

## 1. Principle

槓桿獵人第一階段只使用 Binance 股票代幣 / xStocks 名單內已有標的。

不納入：

- 台股 ETF：00631L / 00647L 等先移除。
- 傳統美股槓桿 ETF：SSO / QLD / TQQQ / SOXL 等先移除。
- 非代幣化個股。
- 反向 ETF。

原因：

1. 目前 App 的資料源、持倉、成本與 Telegram 都圍繞 Binance / xStocks。
2. 先保持同一套資料源，降低開發複雜度。
3. 槓桿獵人可以與折價獵人共用資料，但不能共用買入規則。
4. 未完成交易 API 與安全閘門前，不擴大到台股或傳統美股槓桿 ETF。

---

## 2. Core Rule

槓桿獵人不是折價獵人的加速版。

在 Binance 代幣名單內，槓桿獵人只代表：

```text
高波動戰術觀察
小部位
有停止加碼
有退出規則
不是長期 DCA
不是無限攤平
```

---

## 3. Candidate Classification

### Priority 1 — 先做回測與 App 觀察

| Token | 中文名稱 / 定位 | 分類 | 初步用途 | 狀態 |
|---|---|---|---|---|
| BTC | 比特幣 | 獨立加密引擎 | Cycle High 回撤與風險上限 | Priority 1 |
| QQQon | Nasdaq-100 代幣 | 核心 ETF 代幣 | 科技大盤代理 | Priority 1 |
| NVDAon | NVIDIA 代幣 | AI 基礎建設 | AI 高波動龍頭 | Priority 1 |
| TSMon | 台積電 ADR 代幣 | AI 基礎建設 | AI 供應鏈核心 | Priority 1 |
| AVGOon | Broadcom 代幣 | AI 基礎建設 | AI 網通 / ASIC 核心 | Priority 1 |

### Priority 2 — 回測後再決定

| Token | 中文名稱 / 定位 | 分類 | 初步用途 | 狀態 |
|---|---|---|---|---|
| AMDon | AMD 代幣 | AI 基礎建設 | 高 beta 候選 | Priority 2 |
| MRVLon | Marvell 代幣 | AI 基礎建設 | 高 beta 候選 | Priority 2 |
| GOOGLon | Alphabet 代幣 | 平台型公司 | 平台核心候選 | Priority 2 |

### Priority 3 — 文件觀察，不進自動交易

| Token | 中文名稱 / 定位 | 分類 | 初步用途 | 狀態 |
|---|---|---|---|---|
| RKLBon | Rocket Lab 代幣 | 高成長深折扣 | 小部位觀察 | Priority 3 |
| SPCXon | SpaceX 代幣 | 高成長深折扣 | 歷史資料短，僅觀察 | Priority 3 |

---

## 4. Removed From Leveraged Hunter V1

以下標的從槓桿獵人 V1 移除：

```text
00631L
00647L
SSO
QLD
UPRO
SPXL
TQQQ
USD
TECL
SOXL
FNGU
BULZ
```

它們可以留在未來研究，但不進目前 App 主畫面，不進自動交易開發線。

---

## 5. Leveraged Hunter Decision Framework

槓桿獵人的決策狀態與折價獵人不同。

| 狀態 | 意義 |
|---|---|
| 觀察中 | 尚未進入策略區 |
| 允許建立小部位 | 回撤 / 波動 / 風險條件通過 |
| 等待確認 | 價格到位但資料或風險未確認 |
| 禁止加碼 | 波動過大、超過部位上限、資料異常 |
| 退出觀察 | 到達停損 / 停利 / Exit Rule |

---

## 6. Required Rules Before Buy

正式買入前必須定義：

1. 進場規則
2. 停止加碼規則
3. 退出規則
4. 最大部位
5. 單筆上限
6. 月度上限
7. 最大回撤容忍
8. 是否允許長持
9. 價格偏離 / 流動性檢查
10. Kill Switch

---

## 7. Project Owner Decision

槓桿獵人 V1 只做 Binance tokenized universe。

下一步：

1. 回測 Priority 1：BTC / QQQon / NVDAon / TSMon / AVGOon。
2. App 中只顯示 tokenized candidates。
3. 先建立停止加碼與退出規則，不開啟買點提示。
4. 自動化交易只允許從訊號只讀開始，後續才進 Telegram 確認與下單草稿。
