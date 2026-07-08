# DCA 折價獵人 V17.2 Quality Manual

定位：Quality Manual 是人工封版狀態，不是自動財報評分。它決定每檔標的是否允許固定 DCA 與逢低買進。

## 狀態定義

- PASS：品質通過，照策略執行。
- WATCH：可持有與小額執行，但資金不足時優先級低於核心。
- DATA PENDING：標的可保留，但資料源或高點基準尚未完全封版。
- SPEC WATCH：高波動投機/深折扣標的，不做固定 DCA。
- FAIL：停止新增資金。

## 十檔封版

| 標的 | Quality | 固定 DCA | 逢低買進 | 操作規則 |
|---|---|---:|---:|---|
| BTC | PASS | ✅ 每月 5U | ✅ | 週期核心，照 BTC D 層。 |
| QQQon | PASS | ✅ 每月 5U | ✅ | ETF 核心，穩定 DCA。 |
| NVDAon | PASS | ✅ 每月 5U | ✅ | AI 核心。 |
| TSMon | PASS | ✅ 每月 5U | ✅ | AI 半導體核心。 |
| AVGOon | PASS | ✅ 每月 5U | ✅ | AI 基礎建設核心。 |
| GOOGLon | PASS | ✅ 每月 5U | ✅ | 平台型公司核心。 |
| AMDon | WATCH | ✅ 每月 5U | ✅ | 衛星 AI 半導體，資金不足時低於核心。 |
| MRVLon | WATCH | ✅ 每月 5U | ✅ | 衛星 AI 基礎建設，波動較高。 |
| SPCXon | DATA PENDING | ✅ 每月 5U | ⚠️ 人工確認 | 逢低只用上市以來高點，不用一般 52 週高點。 |
| RKLBon | SPEC WATCH | ❌ 不做 | ✅ 只深跌 | 只等 -50% / -65% / -80%，平常不買。 |

## 決策聯動

- PASS：固定 DCA 與逢低買進均可照規則。
- WATCH：固定 DCA 可保留；逢低可買，但資金不足時排核心後面。
- DATA PENDING：固定 DCA 可保留；逢低買進需人工確認資料源。
- SPEC WATCH：不做固定 DCA；只做指定深折扣層。
- FAIL：不新增資金。
