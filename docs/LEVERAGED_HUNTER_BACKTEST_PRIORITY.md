# Leveraged Hunter Backtest Priority

**Project:** 槓桿獵人  
**Version:** V1.2 → V1.3 Preparation  
**Scope:** Binance tokenized universe + Buffett Quality Pool  
**Status:** Backtest Queue / Not Trading Rule  
**Owner:** Josh  
**Project Owner:** ChatGPT / Josh OS Project Owner  
**Updated:** 2026-07-06

---

## 1. Purpose

這份文件把槓桿獵人主觀察名單與巴菲特品質池整理成回測優先序。

目標不是找最高報酬，而是找：

```text
健康
高價
活潑
有量
可控回撤
可執行小部位波段
```

---

## 2. Backtest Batch A — P1 主觀察名單

第一批優先回測：

| Priority | Token | Underlying | 分類 | 回測重點 |
|---|---|---|---|---|
| A1 | BTC | BTC | 獨立加密引擎 | Cycle High 回撤、反彈確認、波動失控 |
| A2 | QQQon / QQQB | QQQ | 科技大盤 | 大盤科技趨勢、回撤與反彈 |
| A3 | NVDAon / NVDAB | NVDA | AI 基礎建設 | 高價活潑、AI 龍頭動能 |
| A4 | TSMon | TSM | AI 基礎建設 | 健康核心、波動較穩 |
| A5 | AVGOon | AVGO | AI 基礎建設 | 高價核心、趨勢未破壞 |
| A6 | MUon / MUB | MU | AI 記憶體 | 股性活潑、週期風險、停止加碼 |
| A7 | MRVLon | MRVL | AI 基礎建設 | 高 beta、波動與風險上限 |
| A8 | ARMon | ARM | 半導體 IP | 高價活潑、估值敏感 |

---

## 3. Backtest Batch B — Buffett Quality P1

第二批回測：品質高，但要確認股性是否足夠活潑。

| Priority | Token | Underlying | 分類 | 回測重點 |
|---|---|---|---|---|
| B1 | AAPLon | AAPL | 巴菲特品質池 | 品質高，但近年股性是否足夠 |
| B2 | AXPon | AXP | 巴菲特品質池 | 高價金融消費，波段性可能較佳 |
| B3 | GOOGLon | GOOGL | 巴菲特品質池 / 平台 | 健康、有量，股性偏穩 |
| B4 | AMZNon | AMZN | 巴菲特品質池 / 平台 | 雲端與消費平台，波段中等 |

---

## 4. Backtest Batch C — P2 高活躍候選

第三批只做候選，不進自動交易。

```text
AMD
META
MSFT
COIN
HOOD
CRCL
PLTR
TSLA
MSTR
COHR
CAMT
MKSI
```

用途：

```text
找出哪些適合升級為 P1
哪些只適合留候選觀察
哪些應降級為 P3
```

---

## 5. Metrics

每檔回測輸出：

```text
近高點回撤
MA20 / MA50 / MA200 趨勢狀態
20日 / 60日波動
ATR
近 3 / 5 / 10 日動能
觸發後 5 / 10 / 20 / 60 日報酬
觸發後最大續跌
反彈失敗次數
等待確認次數
禁止加碼次數
```

---

## 6. Tactical Entry Test

初版測三類訊號，不直接推正式買點：

### Signal A — 回撤反彈型

```text
從近期高點回撤到候選區
但 MA50 / MA200 未完全破壞
出現 3~5 日反彈
```

### Signal B — 趨勢回踩型

```text
強勢標的回踩 MA20 / MA50
未破壞高低點結構
成交量正常
```

### Signal C — 過度波動禁止型

```text
跌幅太快
價格偏離過大
波動失控
即使便宜也禁止加碼
```

---

## 7. Promotion Rules

升級為槓桿獵人 P1 需要：

```text
回測觸發次數足夠
反彈確認有效
最大續跌可控
成交量 / 流動性可接受
Quality 不是失敗
可設定明確停止加碼與退出規則
```

降級條件：

```text
股性不活潑
反彈失敗率高
續跌過深
資料不足
流動性不足
Quality 失敗
```

---

## 8. Project Owner Decision

下一步執行順序：

1. 建立 Batch A 回測設定。
2. App 保持 V1.2 只讀。
3. V1.3 先做 Telegram 確認流程，不下單。
4. 回測結果出來前，不開買點。
