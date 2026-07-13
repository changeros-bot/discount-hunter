# Josh Portfolio — 2560 戰法選股憲法

**Version:** 1.0  
**Status:** Ratified Constitution  
**Ratified Date:** 2026-07-13  
**Purpose:** 定義 2560 戰法的選股母池、量價結構、訊號分類、排除條件與系統治理原則。  
**Trading Authority:** 本憲法授權研究、掃描、排名與紙上驗證；未經 Josh 明確批准，不得自動真實下單。

---

## 0. 憲法定位

2560 戰法不是長期價值投資、不是跌深攤平、不是單純均線交叉，也不是碰到 25 日線就買。

其核心是：

> **在既有上升趨勢中，尋找價格沿 25 日均價線整理或回踩後重新啟動，並由 5 日／60 日均量結構確認資金是否真正進場。**

最高原則：

> **價格決定位置，成交量決定真假；先有趨勢，再談回踩；沒有量價共同確認，不構成完整 2560 訊號。**

---

## 1. 正確定義：2560 是兩組均線系統

### 1.1 名稱核心

- **25**：25 日均價線，作為中短期趨勢與回踩基準。
- **60**：60 日均量線，作為中期資金與成交量基準。

### 1.2 完整交易系統

2560 的實際判斷同時使用四條線：

```text
價格組：MA5_PRICE、MA25_PRICE
量能組：VMA5、VMA60
```

各自分工：

```text
MA25_PRICE = 趨勢主軸與回踩位置
MA5_PRICE  = 短期價格啟動／再啟動輔助確認
VMA5       = 短期量能狀態
VMA60      = 中期量能基準
```

禁止在文件、程式與介面中只寫模糊的 `MA5`。必須明確區分：

```text
MA5_PRICE = 5 日均價線
VMA5      = 5 日均量線
```

---

## 2. 原始戰法的共同條件

一檔股票要成為有效 2560 候選，必須先符合以下共同邏輯：

1. 25 日均價線向上，最低要求至少走平。
2. 股價原本已有明確上升波段，不是空頭中的短暫反彈。
3. 股價由 MA5_PRICE 上穿 MA25_PRICE，或上漲後回踩 MA25_PRICE 再啟動。
4. 回踩期間不得出現明顯爆量長黑或結構破壞。
5. 正式啟動時，VMA5 不得持續受壓於 VMA60 下方。
6. 價格啟動與量能確認必須同時存在。

---

## 3. 選股母池 Hard Gates

以下任一不通過，直接列為 `REJECTED`。

### 3.1 資料品質

- 價格與成交量資料完整。
- 除權息、拆股、合股等資料已正確還原。
- 台股與美股的交易時段資料不得混用。
- 美股盤前盤後量不得錯當正規盤成交量。

### 3.2 流動性

- 日均成交金額足以支撐實際部位。
- 買賣價差合理。
- 排除長期無量、成交斷續或容易被少量資金操控的標的。
- 流動性門檻依台股、美股分開設定，具體金額屬實測參數，不寫死為永久憲法。

### 3.3 趨勢背景

- MA25_PRICE 不得持續明顯向下。
- 回踩前必須存在可辨識的上升波段。
- 中期結構不得持續形成 Lower High + Lower Low。
- 不得只是空頭趨勢中的技術反彈。

### 3.4 公司重大風險

排除：

- 下市、停止交易或重大持續經營風險。
- 財報重大造假或治理危機。
- 極端稀釋、破產重整或重大信用風險。
- 流動性近乎消失的題材股。

一般估值高低、單季 EPS 波動或短期營收放緩，不直接作為 Hard Gate。

---

## 4. 價格結構：5／25 價格組

### 4.1 基本價格型態

有效價格型態至少符合其一：

```text
A. MA5_PRICE 上穿 MA25_PRICE，形成初次啟動
B. 股價已有上升波段，回踩 MA25_PRICE 後重新轉強
```

### 4.2 回踩要求

- 股價接近 MA25_PRICE，而不是遠離後追價。
- 跌破 MA25_PRICE 可以接受，但必須快速收復且未破壞前波結構。
- 回踩低點是最重要的失效參考，不得只靠固定百分比判斷。

### 4.3 距離正規化

跨股票比較優先使用：

```text
distanceToMA25ATR = (Close - MA25_PRICE) / ATR14
```

方向必須保留：

```text
距離過度為正 → EXTENDED，不追價
距離過度為負 → TOO_DEEP 或 FAILED，不得標成 EXTENDED
```

任何 ATR 門檻均屬回測參數，不列為永久憲法數值。

---

## 5. 量能結構：5／60 均量組

### 5.1 核心底線

正式啟動時：

```text
VMA5 必須上穿、貼近或位於 VMA60 上方
```

若 K 線啟動，但 VMA5 仍明顯位於 VMA60 下方且沒有上穿跡象：

```text
→ FALSE_START / REJECTED
```

這是原始戰法的重要防呆。

### 5.2 禁止錯誤簡化

以下說法不再採用：

```text
VMA5 < VMA60 就等同健康回踩
縮量 → 衝量 → 做量是固定線性流程
```

「衝量、做量、縮量」是三種不同模式分支，不是每檔股票都必須依序走完的三個階段。

---

## 6. 三種正式量能模式

### 6.1 衝量模式 `RUSH_VOLUME`

條件：

- 股價由 MA25_PRICE 附近啟動。
- VMA5 當下上穿 VMA60。

定位：

- 短線機會。
- 形態剛形成，穩定度相對較低。
- 不得因單日爆量就忽略長上影、開高走低或出貨跡象。

### 6.2 做量模式 `BUILT_VOLUME`

條件：

- 前一波 VMA5 已蹭上、貼近或上穿 VMA60。
- 本次股價回踩 MA25_PRICE 後再度啟動。

定位：

- 波段機會。
- 前波已有資金建量，形態成熟度高於單純衝量。
- 「前波量能歷史」是此模式不可缺少的條件。

### 6.3 縮量坑模式 `VOLUME_PIT`

條件：

- VMA5 已貼近或位於 VMA60 上方運行一段時間。
- 近一至兩日出現極低量、量坑或惜售結構。
- 股價仍守住 MA25_PRICE 附近並重新啟動。

定位：

- 強勢延續候選。
- 原始戰法稱其具有牛股／黑馬潛力，但系統不得將此敘述視為保證報酬。

重要澄清：

> 縮量坑不是要求 VMA5 整體跌到 VMA60 下方，而是在既有量能結構之上出現短暫低量凹陷。

---

## 7. 回踩品質

健康回踩應呈現：

- 回落成交量低於前段上漲量。
- 沒有連續爆量長黑。
- 價格跌幅與成交量不呈現恐慌式擴張。
- 最好出現縮量小實體、小星線或窄幅整理作過渡。

排除出貨型回踩：

- 跌破 MA25_PRICE 時爆大量。
- 下跌有量、反彈無量。
- 長黑吞噬前段上漲結構。
- 爆量長上影、開高走低或重大派發跡象。

---

## 8. 訊號架構：Gate、Stage、Risk 分離

禁止再用單一 enum 混合資格、階段與風險。

### 8.1 Gate Status

```text
PASS
CONDITIONAL
REJECTED
```

### 8.2 Stage Status

```text
WATCH
PRICE_SETUP
VOLUME_SETUP
TRIGGERED
```

### 8.3 Pattern Type

```text
RUSH_VOLUME
BUILT_VOLUME
VOLUME_PIT
NONE
```

### 8.4 Risk Status

```text
NORMAL
EXTENDED
TOO_DEEP
FAILED
EXPIRED
DISTRIBUTION_WARNING
```

同一檔股票可同時是：

```text
gateStatus = PASS
stageStatus = TRIGGERED
patternType = BUILT_VOLUME
riskStatus = NORMAL
```

---

## 9. 正式訊號定義

### 9.1 `WATCH`

- 趨勢與流動性合格。
- 尚未完成價格 5／25 結構，或尚未回踩至合理區域。

### 9.2 `PRICE_SETUP`

- 價格已接近或回踩 MA25_PRICE。
- 結構未失效。
- 等待量能模式確認。

### 9.3 `VOLUME_SETUP`

- 價格結構成立。
- VMA5 正接近、上穿或重新貼近 VMA60。
- 尚未完成正式模式判定。

### 9.4 `TRIGGERED`

必須同時符合：

```text
Liquidity PASS
Trend PASS
Price 5/25 Setup PASS
No Structural Failure
Volume Pattern = RUSH_VOLUME / BUILT_VOLUME / VOLUME_PIT
No Major Distribution Signal
Risk Status not EXTENDED / TOO_DEEP / FAILED
```

`TRIGGERED` 只表示策略訊號成立，不等同保證獲利，也不自動授權真實下單。

---

## 10. 失效與停損憲法

以下任一成立，原有 Setup 或 Trigger 應失效或降級：

1. 收盤有效跌破回踩低點。
2. 爆量長黑破壞價格結構。
3. MA25_PRICE 明顯轉為下彎。
4. VMA5 再度跌回 VMA60 下方，且價格同步轉弱。
5. 啟動後在設定交易日內沒有延續，形成時間失效。
6. 價格遠高於合理觸發區，風險報酬惡化。
7. 出現重大公司或市場事件，使歷史量價結構失真。

停損優先順序：

```text
第一優先：回踩低點／結構停損
第二優先：ATR 波動停損
第三優先：時間失效
```

固定跌破 MA25 多少百分比，不列為永久憲法。

---

## 11. 排名憲法

候選名單不得按單日漲幅排序。

排序應服務於：

> **找出最接近「順勢回踩後，由量能確認二次啟動」的標的。**

主要排名因子：

1. MA25_PRICE 趨勢品質。
2. 價格回踩位置與風險報酬。
3. 5／25 價格結構完整度。
4. 量能模式成熟度。
5. 前波做量歷史。
6. 是否出現量坑惜售。
7. 相對大盤與產業強度。
8. 流動性與可成交性。
9. 出貨與過度延伸風險。

原則上：

```text
BUILT_VOLUME 與高品質 VOLUME_PIT
通常優先於剛形成、尚未穩定的 RUSH_VOLUME
```

但最終排序權重必須由回測決定。

---

## 12. 大盤、產業與基本面角色

### 大盤／產業

- 作為 Soft Filter 與排名因子。
- 大盤弱勢時，提高訊號門檻或降低倉位，不必一律封殺個股。
- 逆勢仍維持強勢的個股，可獲相對強度加分。

### 基本面

- 重大風險屬 Hard Gate。
- 一般基本面品質可作排名加分。
- 估值高低暫不作 2560 的核心條件，除非回測證明具有明顯區分力。

---

## 13. 台股與美股治理

核心邏輯共用：

```text
Common 2560 Engine
```

市場參數分開：

```text
Taiwan Market Profile
US Market Profile
```

至少分開處理：

- 流動性門檻。
- 漲跌停與處置制度。
- 跳空與財報日。
- 盤前盤後成交量。
- ATR 與停損寬度。
- 重大事件與除權息資料。

---

## 14. 系統必要欄位

```text
symbol
market
close
volume
ma5Price
ma25Price
ma60Price
vma5
vma60
atr14
ma25PriceSlope
distanceToMA25ATR
priceCross5Above25
priceRetest25AndRebound
priorVma5TouchedOrCrossed60
vma5CrossAbove60
vma5SustainedAbove60
recentVolumePit
pullbackLow
pullbackLowBroken
majorDistributionSignal
gateStatus
stageStatus
patternType
riskStatus
signalDate
invalidReason
```

---

## 15. 憲法級決策骨架

```python
def evaluate_2560(context):
    if not context.data_valid:
        return reject("DATA_INVALID")

    if not context.liquidity_pass:
        return reject("LIQUIDITY_FAIL")

    if context.critical_company_risk:
        return reject("COMPANY_RISK")

    if context.pullback_low_broken or context.major_distribution_signal:
        return fail("STRUCTURE_BROKEN")

    if context.ma25_price_slope_is_strongly_negative:
        return reject("MA25_NOT_UP")

    if context.distance_to_ma25_atr > context.extension_limit:
        return risk("EXTENDED")

    if context.distance_to_ma25_atr < context.deep_damage_limit:
        return risk("TOO_DEEP")

    price_setup = (
        context.ma5_price_cross_above_ma25
        or context.price_retested_ma25_and_rebounded
    )

    if not price_setup:
        return watch("PRICE_SETUP_INCOMPLETE")

    if context.vma5_cross_above_vma60:
        return trigger("RUSH_VOLUME")

    if (
        context.prior_vma5_touched_or_crossed_vma60
        and context.price_retested_ma25_and_rebounded
    ):
        return trigger("BUILT_VOLUME")

    if (
        context.vma5_sustained_above_vma60
        and context.recent_volume_pit
        and context.price_turning_up
    ):
        return trigger("VOLUME_PIT")

    if context.vma5 < context.vma60:
        return reject("VOLUME_BELOW_60_FALSE_START")

    return setup("WAITING_FOR_VOLUME_CONFIRM")
```

此為邏輯憲法，不是最終程式碼。所有數值門檻由回測設定檔管理，不得硬寫入憲法。

---

## 16. 與其他專案的邊界

```text
2560 戰法 = 順勢回踩後的短線／波段量價啟動系統
DCA 折價獵人 = 品質資產的折價分層買入系統
富邦長期台美股 DCA = 長期定期定額核心資產配置
```

不得因某標的同時存在於其他專案，就混用買點、停損或持有邏輯。

---

## 17. 治理與修改程序

### 已正式定案的憲法核心

1. 2560 使用價格 5／25 與成交量 5／60 兩組系統。
2. 名稱核心來自 25 日均價線與 60 日均量線。
3. MA25_PRICE 必須向上或至少走平。
4. 價格結構與量能結構必須共同確認。
5. 啟動時 VMA5 長期位於 VMA60 下方，視為假啟動或不合格。
6. 衝量、做量、縮量坑是三種模式分支，不是固定線性流程。
7. 向上延伸與向下跌深必須分開判斷。
8. Gate、Stage、Pattern、Risk 必須分離。
9. 結構失效優先於所有觸發判斷。
10. 未經 Josh 明確批准，不得自動真實下單。

### 尚未永久定案的參數

- 流動性金額門檻。
- ATR 合理區間。
- 快速收復所需天數。
- 時間失效天數。
- 量坑定義。
- 模式排名權重。
- 台股與美股的市場別參數。

上述參數必須經歷：

```text
歷史案例標註
→ 回測
→ 紙上交易
→ 風險審查
→ Josh 批准
```

才能升級為正式執行參數。

---

## 最終憲法摘要

> **2560 戰法以 MA25_PRICE 判斷趨勢與回踩位置，以 MA5_PRICE 輔助確認價格啟動，再由 VMA5／VMA60 判斷資金是否真實進場。正式訊號分為衝量、做量與縮量坑三種模式；任何價格破壞、出貨量價或量能仍受壓於 VMA60 的假啟動，均不得列為有效買點。**
