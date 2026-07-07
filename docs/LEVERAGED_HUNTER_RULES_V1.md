# Leveraged Hunter Rules V1

**Project:** 槓桿獵人  
**Scope:** Binance tokenized stock universe only  
**Status:** Rules Framework / Research Only / Not Live Trading  
**Owner:** Josh  
**Project Owner:** ChatGPT / Josh OS Project Owner  
**Updated:** 2026-07-07

---

## 0. V1 Non-Negotiable Rules

槓桿獵人 V1 正式鎖定為：

```text
只做現貨多單
只做 Binance 股票代幣 / xStocks / bStocks 的戰術現貨研究
不做空
不做合約
不做永續合約
不做保證金 / 借貸槓桿
不做反向 ETF
不做自動下單
```

V1 的「槓桿」不是合約槓桿，而是：

```text
戰術槓桿
資金效率
波動彈性
多頭環境下的小資金加速器
```

任何做空、合約、永續、保證金策略，都必須另開新專案，不能混入槓桿獵人 V1。

---

## 1. Core Positioning

槓桿獵人不是折價獵人的加速版，也不是全天候交易系統。

V1 定位：

```text
Bull Market Tactical Spot Engine
多頭限定戰術現貨引擎
```

它要找的是：

```text
健康
股價高
股性活潑
有成交量
代幣流動性正常
市場環境允許
```

目的不是長期攤平，而是：

```text
高品質 / 高流動性 / 高波動標的
在多頭環境中出現趨勢回踩
建立小額現貨觀察部位
有停止加碼
有退出規則
```

---

## 2. Universe Scope

V1 只允許：

```text
Binance 股票代幣 / xStocks / bStocks 已上架標的
現貨 / 代幣化股票現貨
```

暫不納入：

```text
台股 ETF
傳統美股槓桿 ETF
非代幣化個股直接交易
低價低量題材股
反向 ETF
合約
永續合約
保證金交易
借貸槓桿
做空
```

---

## 3. Research Finding as of V1.3

目前 Signal Research 結論：

```text
Signal B = 多頭回踩策略，不是全市場策略
Signal A = 扣成本後失敗，降級觀察
Signal C = 風控，不交易
```

Regime 分段結果：

```text
2015–2019 前AI多頭：通過
2020–2021 流動性多頭：勉強通過
2022 升息熊市：嚴重失敗
2023–2024 AI多頭：未達門檻
2025–至今近期驗證：失敗
```

Project Owner 判定：

```text
可以繼續研究
不可升級實盤
不可 Telegram 確認
不可下單草稿
不可自動交易
必須加入 Market Regime Filter
```

---

## 4. Current Main Research Watchlist

P1 主研究名單：

```text
QQQon / QQQB
NVDAon / NVDAB
GOOGLon
AAPLon
AXPon
TSMon
AMZNon
AVGOon
```

降級觀察：

```text
BTC：回到 BTC 獨立引擎，不進槓桿獵人主訊號
MUon / MUB：觀察
MRVLon：觀察
ARMon：觀察
```

---

## 5. Four-Gate Entry System

正式顯示任何戰術確認前，必須通過四道閘門。

### Gate 1 — 健康

```text
Quality 不可為失敗
Investment Thesis 不可破裂
重大財務或公司事件不可失控
```

### Gate 2 — 活潑

```text
波動足夠
回撤與反彈幅度足夠
不是死魚股
```

### Gate 3 — 有量

```text
原股成交量正常
Binance 代幣價格更新正常
Bid/Ask 或成交深度可接受
價格偏離不可過大
```

### Gate 4 — 風險可控

```text
單筆金額小
本月預算足夠
未超過該標的最大部位
未觸發停止加碼
未觸發 Kill Switch
```

任何一項不通過：

```text
等待確認或禁止加碼
```

---

## 6. Market Regime Filter — Required Before Trading

V1.4 必須加入市場環境濾網。

第一版最小可行濾網：

```text
QQQ > MA200：允許 Signal B 進入研究
QQQ < MA200：Signal B 休眠，只觀察
```

進階濾網候選：

```text
SPY > MA200
QQQ 20日報酬不為極弱
VIX 不在恐慌區
最近 6 個月 Profit Factor >= 1
```

如果 Market Regime 不允許：

```text
不做多
不做空
不開合約
保留現金
```

---

## 7. Signal Policy

### Signal B — 趨勢回踩型

目前主研究訊號。

```text
60日高點回撤 -3% 到 -15%
價格在 MA200 上方
30日持有 / 12% 停利 / 8% 停損
扣除 70 bps 來回成本
```

但 Signal B 只有在 Market Regime Filter 通過後，才可進入候選研究。

### Signal A — 回撤反彈型

```text
降級觀察
不交易
不進 Telegram 確認
```

### Signal C — 過度波動禁止型

```text
風控訊號
不交易
出現時停止新訊號
```

---

## 8. Decision Status

| 狀態 | 意義 | App 顯示 |
|---|---|---|
| 觀察中 | 還沒進入戰術區 | 不買 |
| 戰術候選 | 市場允許 + Signal B + 閘門初步通過 | 研究用，非買入 |
| 等待確認 | 價格到位但資料 / 健康 / 流動性未確認 | 需要人工確認 |
| 禁止加碼 | 品質失敗、流動性差、超限、波動失控 | 不買 |
| 休眠 | 市場環境不允許 | 不交易 |
| 退出觀察 | 到達 Exit Rule 或 Thesis 破裂 | 停止並評估退出 |

---

## 9. Stop-Adding Rules

出現以下任一狀況，停止加碼：

```text
Market Regime Filter 失效
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

## 10. Exit Rules

槓桿獵人一定要有退出。

退出觸發：

```text
Investment Thesis 破裂
Quality 失敗
Market Regime 轉弱
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

## 11. Position Limits V1

| 類型 | 上限 |
|---|---:|
| 單筆 | 5U |
| 單一 P1 標的 | 15U |
| 單一 P2 標的 | 5U |
| P3 | 不進交易 |
| 槓桿獵人總部位 | 50U 或 Josh 手動設定 |

備註：

```text
這是研究沙盒上限，不是正式買入規則。
```

---

## 12. Kill Switch

以下情況立刻停止新訊號：

```text
Market Regime Filter 失效
價格 API 異常
Wallet / 持倉資料異常
成本資料缺失
代幣價格偏離原股過大
成交量或流動性突然消失
單日波動超過系統上限
Josh 手動關閉
```

---

## 13. Automation Roadmap — Revised

### LH V1.3 — Regime Research

- 顯示 Sandbox / Signal Research / Regime 分段
- Signal B 保留研究
- Signal A 降級
- Signal C 風控
- 不下單

### LH V1.4 — Market Regime Filter

- 加入 QQQ / SPY 市場濾網
- 市場不允許時休眠
- 不做空
- 不開合約

### LH V1.5 — Telegram 觀察通知

- 僅通知「研究候選」
- Josh 可按：觀察 / 略過 / 延後
- 不顯示強制買入

### LH V1.6 — 現貨下單草稿

- 僅限現貨多單
- 僅產生草稿
- 不直接送單

### LH V1.7 — 小額白名單半自動研究

- 僅限 P1
- 單筆 5U
- 必須通過 Market Regime Filter + Kill Switch
- 仍不得做空 / 合約 / 永續 / 保證金

---

## 14. Project Owner Decision

下一步不是再擴名單，也不是加槓桿。

優先實作：

```text
1. Market Regime Filter：QQQ > MA200 才允許 Signal B
2. App 顯示市場狀態：多頭允許 / 休眠
3. 回測 Signal B + Regime Filter 後的結果
4. 若 2025 近期驗證仍失敗，槓桿獵人維持研究，不升級
```

正式封板：

```text
槓桿獵人 V1 = 多頭限定、現貨多單、研究優先的戰術引擎。
```
