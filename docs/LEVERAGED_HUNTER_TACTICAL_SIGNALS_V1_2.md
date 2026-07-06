# Leveraged Hunter V1.2 — Tactical Signal Framework

**Project:** 槓桿獵人  
**Scope:** Binance tokenized universe only  
**Status:** Signal Framework / Read-only  
**Owner:** Josh  
**Project Owner:** ChatGPT / Josh OS Project Owner  
**Updated:** 2026-07-06

---

## 1. Purpose

V1.2 的目的不是開買點，而是讓 P1 標的開始具備「戰術觀察訊號」。

核心原則：

```text
健康 + 高價 + 活潑 + 有量
再看：回撤 / 趨勢 / 波動 / 成交量 / 動能
```

V1.2 仍然是：

```text
Read-only
不下單
不顯示強制買入
不自動交易
```

---

## 2. Tactical Signal Inputs

### 2.1 回撤位置

看標的距離近期高點的回撤。

用途：

```text
判斷是否進入戰術觀察區
```

不是：

```text
跌很多就買
```

---

### 2.2 趨勢狀態

看價格是否仍在可交易趨勢內。

初期可用：

```text
MA20
MA50
MA200
高低點結構
```

原則：

```text
趨勢完全破壞 → 禁止加碼
趨勢仍在 → 可觀察
```

---

### 2.3 波動狀態

看股性是否夠活潑，但不能失控。

初期可用：

```text
20日波動率
60日波動率
ATR
近60日最大反彈
近60日最大回撤
```

原則：

```text
太安靜 → 不適合槓桿獵人
太失控 → 禁止加碼
適中活潑 → 可觀察
```

---

### 2.4 成交量 / 流動性

看原股與 Binance 代幣是否都有量。

初期可用：

```text
原股成交量
代幣價格更新頻率
代幣成交狀態
價格偏離
```

原則：

```text
沒量 → 不進買點
價格偏離大 → Kill Switch
```

---

### 2.5 動能 / 反彈確認

看下跌後是否出現反彈跡象。

初期可用：

```text
最近 3 / 5 / 10 日報酬
是否站回 MA20
是否連續轉強
是否放量反彈
```

---

## 3. V1.2 Signal Status

| 狀態 | 意義 |
|---|---|
| 未進戰術區 | 不觀察買點 |
| 戰術觀察 | 進入可觀察區，但不代表買 |
| 等待確認 | 有條件接近，但資料或趨勢未確認 |
| 禁止加碼 | 趨勢破壞、流動性異常、風險失控 |
| 退出觀察 | 觸發 Exit / Kill Switch |

---

## 4. P1 Tactical Focus

| Token | 主要觀察 |
|---|---|
| BTC | Cycle High 回撤、波動、動能反彈 |
| QQQon / QQQB | 科技大盤回撤、趨勢、反彈確認 |
| NVDAon / NVDAB | AI 龍頭回撤、動能、成交量 |
| TSMon | 趨勢與回撤，波動通常較 NVDA 低 |
| AVGOon | 高價核心，重視趨勢未破壞 |
| MUon / MUB | 股性活潑，重視停止加碼與週期風險 |
| MRVLon | 高 beta，重視波動失控風險 |
| ARMon | 題材集中，重視估值與波動 |

---

## 5. No Trade Rule

V1.2 不允許：

```text
直接顯示建議買入
直接產生下單草稿
自動交易
P2 / P3 自動交易
忽略 Kill Switch
```

---

## 6. Next Step

V1.3 才能開始 Telegram 確認流程：

```text
戰術觀察訊號
→ Telegram 通知
→ Josh 選擇：確認 / 略過 / 延後
```
