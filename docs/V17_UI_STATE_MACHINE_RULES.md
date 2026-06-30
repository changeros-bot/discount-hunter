# V17 UI State Machine Rules

封板日期：2026-06-30

本文件是 V17 的 Architecture Constitution。任何 V17 修改前，必須先檢查是否符合本文件。

---

## 1. Universe 固定

Universe 永遠只有目前封版名單。

目前共 9 檔：

- NVDA
- AVGO
- TSM
- AMD
- MRVL
- RKLB
- SPCX
- QQQ
- GOOGL

除非正式改版，不會因股價變動增減。

---

## 2. 三大區域唯一分類

每檔股票同一時間只能存在一個區域。

### 2.1 今日決策 Decision

條件：

- 進入新的 D 層（D1-D4）
- 該層尚未完成
- 該層尚未略過

操作：

- 已完成
- 略過本層

### 2.2 持倉區 Holding

條件：

- 已持倉
- 位於 D1-D4
- 並且沒有正在等待處理的 Decision

只要仍在 D1-D4，且該層沒有待處理決策，就存在於持倉區。

### 2.3 觀察區 Watch

只有 D0 進入觀察區。

任何 D1-D4 一律不得出現在觀察區。

---

## 3. Decision State Machine

標準流程：

```text
第一次跌到 D1
→ 今日決策
→ 已完成
→ 持倉區 D1
→ 跌到 D2
→ 重新進今日決策
→ 完成
→ 持倉區 D2
→ 跌到 D3
→ 重新今日決策
```

---

## 4. 略過本層

範例：

```text
D1
→ 略過本層
→ 仍在 D1
→ 不再提醒
→ 跌到 D2
→ 重新今日決策
```

---

## 5. UI 原則

V17 不重新設計 UI。

核心原則：

```text
V16 外觀 + V17 State Machine
```

UI 區塊維持：

- Hero
- 今日決策
- 鏈上持倉
- 持倉區
- 觀察區
- Footer

只替換資料來源與分類邏輯。

---

## 6. V17 開發規範

禁止修改：

```text
v16-full.js
```

V16 僅作為 UI 參考模板。

V17 所有新功能只能新增或修改於：

- components/
- lib/
- pages/v17.js
- pages/v17/
- pages/api/v17/
- docs/

任何單一檔案不得超過 200 行；超過必須拆分模組。

---

## 7. Single Source of Truth

所有 UI 都只能根據同一份 State 計算。

例如：

```text
symbol
currentLevel
highestCompletedLevel
skippedLevels
position
decision
section
```

Hero、Decision、Holding、Watch 不得各自重新判斷。

---

## 8. Pure State Rendering

UI 不做商業邏輯。

禁止：

```text
Component 內直接用 price 判斷 D1-D4
```

正確流程：

```text
State Engine
→ Classified Rows
→ UI Render
```

UI 只負責顯示。

---

## 9. State Transition Only

所有狀態只能經由 State Machine 改變。

禁止 Component 直接修改資料。

標準流程：

```text
Action
→ Reducer / State Engine
→ State
→ UI
```

---

## 10. 下一個 Sprint

完成 UI 封板後，依序開發：

1. BTC 引擎
2. 新標的管理（Universe 可配置）
3. 多策略引擎（Strategy Engine）
4. 多 Portfolio 支援
5. 自動交易模組

---

## 11. 封板原則

已封板規則不得因單一案例臨時修改。

只有證明整體架構有缺陷時，才能透過新版本修訂，例如 V18。
