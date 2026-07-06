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

槓桿 / 波段只找：

```text
公司健康
股價高
股性活潑
有成交量
代幣流動性可接受
```

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

## 3. Selection Filters

正式進入槓桿獵人候選前，必須通過以下篩選。

| 條件 | 中文定義 | 初期判斷 |
|---|---|---|
| 健康 | 公司基本面不能明顯破壞 | Quality 至少不是失敗 |
| 股價高 | 不是低價垃圾股或流動性差標的 | 美股原股價格具備機構參與度 |
| 股性活潑 | 有足夠波動，適合波段 | 歷史波動 / 回撤 / 反彈幅度足夠 |
| 有量 | 原股與代幣都要有足夠交易量 | Binance 代幣成交與價格更新正常 |
| 資料正常 | 價格、成本、持倉、API 不可缺失 | 缺資料只能觀察，不能進買點 |

---

## 4. Candidate Classification

### Priority 1 — 先做回測與 App 觀察

| Token | 中文名稱 / 定位 | 分類 | 篩選理由 | 狀態 |
|---|---|---|---|---|
| BTC | 比特幣 | 獨立加密引擎 | 有量、波動大、資料充足 | Priority 1 |
| QQQon | Nasdaq-100 代幣 | 核心 ETF 代幣 | 科技大盤代理，活潑但比個股穩 | Priority 1 |
| NVDAon | NVIDIA 代幣 | AI 基礎建設 | 健康、股價高、股性活潑、有量 | Priority 1 |
| TSMon | 台積電 ADR 代幣 | AI 基礎建設 | 健康、有量、波動較可控 | Priority 1 |
| AVGOon | Broadcom 代幣 | AI 基礎建設 | 健康、股價高、機構參與度高 | Priority 1 |

### Priority 2 — 回測後再決定

| Token | 中文名稱 / 定位 | 分類 | 篩選理由 | 狀態 |
|---|---|---|---|---|
| AMDon | AMD 代幣 | AI 基礎建設 | 股性活潑，但需檢查趨勢與品質 | Priority 2 |
| MRVLon | Marvell 代幣 | AI 基礎建設 | 活潑但波動較高，需嚴格停止加碼 | Priority 2 |
| GOOGLon | Alphabet 代幣 | 平台型公司 | 健康、有量，但股性相對不夠活潑 | Priority 2 |

### Priority 3 — 文件觀察，不進自動交易

| Token | 中文名稱 / 定位 | 分類 | 篩選理由 | 狀態 |
|---|---|---|---|---|
| RKLBon | Rocket Lab 代幣 | 高成長深折扣 | 股性活潑，但健康與波動風險需更嚴格 | Priority 3 |
| SPCXon | SpaceX 代幣 | 高成長深折扣 | 非公開市場代理，歷史資料短 | Priority 3 |

---

## 5. Removed From Leveraged Hunter V1

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

## 6. Leveraged Hunter Decision Framework

槓桿獵人的決策狀態與折價獵人不同。

| 狀態 | 意義 |
|---|---|
| 觀察中 | 尚未進入策略區 |
| 允許建立小部位 | 健康 / 股性 / 有量 / 回撤 / 風險條件通過 |
| 等待確認 | 價格到位但資料或風險未確認 |
| 禁止加碼 | 品質失敗、波動過大、超過部位上限、資料異常 |
| 退出觀察 | 到達停損 / 停利 / Exit Rule |

---

## 7. Required Rules Before Buy

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
11. 健康 / 股價 / 股性 / 成交量篩選

---

## 8. Project Owner Decision

槓桿獵人 V1 只做 Binance tokenized universe。

選股不是找最便宜，而是找：

```text
健康 + 高價 + 活潑 + 有量
```

下一步：

1. 回測 Priority 1：BTC / QQQon / NVDAon / TSMon / AVGOon。
2. App 中只顯示 tokenized candidates。
3. 先建立健康 / 股價 / 股性 / 成交量篩選。
4. 先建立停止加碼與退出規則，不開啟買點提示。
5. 自動化交易只允許從訊號只讀開始，後續才進 Telegram 確認與下單草稿。
