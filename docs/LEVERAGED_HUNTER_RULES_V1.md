# Leveraged Hunter Rules V1

**Project:** 槓桿獵人  
**Scope:** Binance tokenized universe only  
**Status:** Rules Framework / Not Live Trading  
**Owner:** Josh  
**Project Owner:** ChatGPT / Josh OS Project Owner  
**Updated:** 2026-07-06

---

## 1. Core Positioning

槓桿獵人不是折價獵人的加速版。

槓桿 / 波段要找：

```text
健康
股價高
股性活潑
有成交量
代幣流動性正常
```

目的不是長期攤平，而是：

```text
高品質 / 高流動性 / 高波動標的
進入戰術區時
建立小部位
有停止加碼
有退出規則
```

---

## 2. Universe Scope

V1 只允許：

```text
Binance 股票代幣 / xStocks / bStocks 已上架標的
```

暫不納入：

```text
台股 ETF
傳統美股槓桿 ETF
非代幣化個股
低價低量題材股
反向 ETF
```

---

## 3. P1 Main Watchlist

主觀察名單：

```text
BTC
QQQon / QQQB
NVDAon / NVDAB
TSMon
AVGOon
MUon / MUB
MRVLon
ARMon
```

這些是第一批回測與 App 觀察對象。

---

## 4. Four-Gate Entry System

正式顯示買點前，必須通過四道閘門。

### Gate 1 — 健康

條件：

```text
Quality 不可為失敗
Investment Thesis 不可破裂
重大財務或公司事件不可失控
```

狀態：

```text
通過 / 觀察 / 失敗 / 未檢查
```

規則：

```text
健康 = 失敗 → 禁止加碼
健康 = 未檢查 → 等待確認
```

---

### Gate 2 — 活潑

條件：

```text
波動足夠
回撤與反彈幅度足夠
不是死魚股
```

初期可用：

```text
20日波動率
60日波動率
近20日平均真實波幅 ATR
近60日最大回撤
近60日最大反彈
```

規則：

```text
活潑不足 → 不列入槓桿獵人主名單
```

---

### Gate 3 — 有量

條件：

```text
原股成交量正常
Binance 代幣價格更新正常
Bid/Ask 或成交深度可接受
價格偏離不可過大
```

規則：

```text
代幣流動性不足 → 只觀察，不進買點
價格偏離過大 → Kill Switch
```

---

### Gate 4 — 風險可控

條件：

```text
單筆金額小
本月預算足夠
未超過該標的最大部位
未觸發停止加碼
未觸發 Kill Switch
```

規則：

```text
任何一項不通過 → 等待確認或禁止加碼
```

---

## 5. Decision Status

| 狀態 | 意義 | App 顯示 |
|---|---|---|
| 觀察中 | 還沒進入戰術區 | 不買 |
| 允許建立小部位 | 四道閘門通過 | 可以小額，非強制 |
| 等待確認 | 價格到位但資料 / 健康 / 流動性未確認 | 需要人工確認 |
| 禁止加碼 | 品質失敗、流動性差、超限、波動失控 | 不買 |
| 退出觀察 | 到達 Exit Rule 或 Thesis 破裂 | 停止並評估退出 |

---

## 6. Entry Logic V1 — Draft

V1 不直接用「跌多少就買」。

初步訊號應該同時看：

```text
回撤
波動
趨勢
成交量
風險上限
```

### 6.1 小部位觀察進場

允許條件：

```text
價格從近期高點回撤達到候選區
但未破壞長期趨勢
且健康 / 有量 / 活潑通過
```

初期狀態：

```text
只顯示「戰術觀察」
不顯示「建議買」
```

---

## 7. Stop-Adding Rules

出現以下任一狀況，停止加碼：

```text
Quality 變成失敗
價格偏離過大
代幣成交 / 更新異常
本月預算不足
該標的部位超限
連續下跌但反彈失敗
跌破關鍵趨勢線
波動突然失控
```

---

## 8. Exit Rules — Draft

槓桿獵人一定要有退出。

退出觸發：

```text
Investment Thesis 破裂
Quality 失敗
價格回到目標反彈區但動能衰退
跌破風險線
Kill Switch 觸發
超過最大持有天數仍無反彈
```

V1 暫定：

```text
Exit 規則只顯示，不自動賣出
```

---

## 9. Position Limits V1

初期建議：

| 類型 | 上限 |
|---|---:|
| 單筆 | 5U |
| 單一 P1 標的 | 15U |
| 單一 P2 標的 | 5U |
| P3 | 不進交易 |
| 槓桿獵人總部位 | 50U 或 Josh 手動設定 |

備註：

```text
這是風控草案，不是正式買入規則。
```

---

## 10. Kill Switch

以下情況立刻停止新訊號：

```text
價格 API 異常
Wallet / 持倉資料異常
成本資料缺失
代幣價格偏離原股過大
成交量或流動性突然消失
單日波動超過系統上限
Josh 手動關閉
```

---

## 11. Automation Roadmap

### LH V1.1 — 訊號只讀

- 顯示 P1 / P2 / P3
- 顯示四道閘門狀態
- 不顯示買入建議

### LH V1.2 — 戰術觀察訊號

- 顯示「觀察中 / 等待確認 / 禁止加碼」
- 不下單

### LH V1.3 — Telegram 確認

- 傳送候選訊號
- Josh 可按：確認 / 略過 / 延後

### LH V1.4 — 下單草稿

- 產生 Binance 下單草稿
- 不直接送單

### LH V1.5 — 小額白名單半自動

- 僅限 P1
- 單筆 5U
- 必須通過 Kill Switch

---

## 12. Project Owner Decision

下一步不是再擴名單，而是讓 P1 具備可驗證規則。

優先實作：

1. App 顯示四道閘門。
2. P1 標的顯示健康 / 活潑 / 有量 / 風險四項狀態。
3. 回測 P1：BTC / QQQ / NVDA / TSM / AVGO / MU / MRVL / ARM。
4. Telegram 改成「戰術觀察」，不顯示強制買入。
