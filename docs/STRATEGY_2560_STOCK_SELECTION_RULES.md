# Josh Portfolio — 2560 戰法選股條件

**Status:** Draft for Ratification  
**Effective Date:** 2026-07-13  
**Purpose:** 建立 2560 戰法的候選股掃描、篩選與訊號確認規格。  
**Trading Authority:** 研究與紙上驗證優先；未經 Josh 明確批准，不得自動真實下單。

---

## 0. 舊版 2056 說明作廢

先前將「2056」誤解為持有到 2056 年的長期選股專案，該方向正式作廢。

正確專案名稱為：

> **2560 戰法**

本策略不是一般長期價值選股，也不是單純跌深買進，而是：

> **順勢股回踩 25 日均線後，等待 5 日均線重新轉強，並以相對 60 日均量的量能變化確認二次啟動。**

---

## 1. 2560 的定義

- **25**：25 日移動平均線，判斷中短期趨勢與回踩支撐區。
- **5**：5 日移動平均線，判斷短線是否止跌、轉平、轉上。
- **60**：60 日平均成交量，判斷量能是否縮減與重新放大。

三者分工：

```text
25 日線 = 位置
5 日線  = 轉折
60 日均量 = 資金確認
```

---

## 2. 策略核心

2560 不是「碰到 25 日線就買」。

完整邏輯：

```text
原本已有上升趨勢
        ↓
股價回踩 25 日均線附近
        ↓
回踩過程量縮
        ↓
5 日均線止跌、走平、轉上
        ↓
股價重新站回短期均線
        ↓
成交量重新放大，且相對 60 日均量具確認力
        ↓
形成 2560 候選訊號
```

最高原則：

> **先有趨勢，再等回踩；先看縮量，再等轉強；沒有量價確認，不視為完整訊號。**

---

## 3. 第一層：基礎選股母池

候選股先通過以下基本條件：

### 3.1 流動性

- 日均成交量充足。
- 買賣價差合理。
- 排除長期無量、成交斷續、容易被少量資金扭曲的標的。
- 紙上回測必須使用可合理成交的價格，不得假設全部成交在最低點。

### 3.2 趨勢背景

至少符合大部分條件：

- 25 日均線走平或向上。
- 股價在回踩前曾有一段明確上漲。
- 中期結構不是連續破底。
- 近期高點與低點仍大致維持抬高或橫向整理。
- 不得只是空頭趨勢中的技術反彈。

### 3.3 價格位置

- 股價回到 25 日均線附近，而不是遠離 25 日線後追價。
- 可設定候選距離區間，例如股價與 MA25 差距約 ±3%，實際參數需回測後鎖定。
- 若已大幅跌破 MA25，必須先確認是否屬假跌破及快速收復；否則不列入標準候選。

---

## 4. 第二層：回踩品質條件

### 4.1 回踩必須量縮

健康回踩應呈現：

- 股價回落時成交量逐步縮小。
- 回踩量低於前一段上漲量。
- 最理想情況是回踩量低於或接近 60 日均量。
- 不應出現連續大量長黑。

### 4.2 排除出貨型回踩

以下任一狀況應降級或排除：

- 跌破 25 日線時爆大量。
- 連續高量下跌。
- 大量長黑吞噬前段上漲。
- 回踩時主動賣壓明顯強於買盤。
- 股價反彈無量、下跌有量。

---

## 5. 第三層：5 日均線轉強條件

不能因股價碰到 MA25 就直接進場，必須等待 MA5 出現轉折。

有效訊號包括：

- MA5 由下彎轉平。
- MA5 由平轉上。
- MA5 斜率連續改善。
- 股價重新站上 MA5。
- 短均線重新形成多方排列或黃金交叉。

必要防呆：

- MA5 仍明顯向下時，不得視為完成訊號。
- 僅單日反彈，但 MA5 尚未改善，列為 `WATCH`，不得列為 `TRIGGERED`。
- 黃金交叉若無成交量配合，只能視為弱確認。

---

## 6. 第四層：60 日均量確認

60 日均量不是單純「超過就買」，而是作為量能基準。

### 6.1 回踩階段

- 回踩量應縮小。
- 可用當日量 / 60 日均量作為量縮比。
- 建議先追蹤：

```text
pullbackVolumeRatio = currentVolume / avgVolume60
```

候選參考：

```text
pullbackVolumeRatio < 1.0
```

更嚴格版本可測試：

```text
pullbackVolumeRatio <= 0.8
```

### 6.2 轉強階段

- 股價轉強時成交量應明顯高於近期回踩量。
- 放量最好接近或超過 60 日均量。
- 建議追蹤：

```text
breakoutVolumeRatio = currentVolume / avgVolume60
```

候選參考：

```text
breakoutVolumeRatio >= 1.0
```

強確認版本可測試：

```text
breakoutVolumeRatio >= 1.2
```

上述數值為初始回測參數，不得未經回測直接定為永久憲法。

---

## 7. 完整 2560 候選條件

一檔股票要進入 `2560_CANDIDATE`，至少需符合：

```text
Liquidity PASS
Trend Background PASS
MA25 Position PASS
Pullback Volume PASS
MA5 Turnaround WATCH or PASS
No Major Distribution Signal
```

要進入 `2560_TRIGGERED`，至少需符合：

```text
Liquidity PASS
Trend Background PASS
Price near / reclaimed MA25
Pullback volume contracted
MA5 turned flat-to-up
Price reclaimed MA5
Volume expansion confirmed versus pullback phase
No major breakdown or distribution signal
```

---

## 8. 建議訊號分級

| 狀態 | 意義 |
|---|---|
| REJECTED | 趨勢、流動性或量價結構不符 |
| WATCH | 接近 MA25，但尚未完成 MA5 轉強 |
| SETUP | 回踩量縮成立，等待價格與 MA5 確認 |
| TRIGGERED | 5 日線轉強且量能確認 |
| EXTENDED | 已離 MA25 或訊號點太遠，不追價 |
| FAILED | 跌破關鍵支撐或放量轉弱，訊號失效 |

---

## 9. 排除條件

以下標的不應列為有效 2560 訊號：

- 25 日均線持續明顯向下。
- 股價持續創低，沒有既存上升趨勢。
- 只因碰到 MA25 就判定買點。
- MA5 仍下彎。
- 回踩放量、反彈無量。
- 大量長黑破壞結構。
- 跌破 MA25 後無法快速收復。
- 訊號出現後已大幅上漲，距離合理進場區太遠。
- 流動性太差。
- 因單日新聞拉抬造成異常量價。

---

## 10. 排名方式

候選名單不得只按單日漲幅排序。

建議排名因子：

1. 趨勢品質。
2. 距離 MA25 的合理程度。
3. 回踩縮量品質。
4. MA5 斜率改善程度。
5. 轉強日相對 60 日均量。
6. 是否存在爆量出貨風險。
7. 訊號是否過度延伸。
8. 流動性。

排名目的：

> 找出最接近「順勢回踩後二次啟動」的標的，不是找當天漲最多的股票。

---

## 11. 系統所需資料欄位

每檔至少保存：

```text
symbol
name
close
volume
ma5
ma25
avgVolume60
ma5Slope
ma25Slope
distanceToMA25Pct
pullbackVolumeRatio
breakoutVolumeRatio
trendStatus
pullbackStatus
volumeStatus
signalStatus
signalDate
invalidReason
```

---

## 12. 後端判斷範例

```javascript
function evaluate2560(row) {
  if (!row.liquidityPass) return "REJECTED";
  if (row.ma25Slope < 0 && row.structureLowerLow) return "REJECTED";
  if (Math.abs(row.distanceToMA25Pct) > 3) return "EXTENDED";
  if (row.pullbackVolumeRatio >= 1.0) return "WATCH";
  if (row.ma5Slope <= 0) return "SETUP";
  if (!row.priceAboveMA5) return "SETUP";
  if (row.breakoutVolumeRatio < 1.0) return "SETUP";
  if (row.majorDistributionSignal) return "FAILED";
  return "TRIGGERED";
}
```

數值門檻必須透過回測與紙上驗證調整，不得把範例直接視為最終參數。

---

## 13. 與折價獵人的分工

```text
2560 戰法 = 短線／波段的量價轉強掃描
折價獵人 = 品質資產的折價分層買入系統
```

兩者不得混用：

- 2560 的技術訊號不得直接修改 `/v17` 正式名單。
- 折價獵人的 52 週高點與 DCA 層級，不得被當成 2560 訊號。
- 任何整合都須 Josh 明確批准。

---

## 14. 專案第一階段事項

1. 建立 `/2560` 獨立研究頁。
2. 將 2560 加入 Project Pager 第四張卡。
3. 建立每日候選掃描。
4. 顯示 MA5、MA25、60 日均量及斜率。
5. 顯示回踩量縮比與轉強放量比。
6. 使用 WATCH / SETUP / TRIGGERED / FAILED 分級。
7. 建立紙上訊號紀錄，不做真實交易。
8. 回測不同距離 MA25 與量比門檻。
9. 驗證訊號後 5、10、20 個交易日表現。
10. 由 Josh 審核後，才決定是否封版為正式規格。

---

## 15. 不可被誤解的五項原則

```text
碰到 25 日線不等於買點
5 日線未轉強不算完成
回踩放量不是健康整理
上漲無量不是完整確認
訊號已過度延伸不得追價
```
