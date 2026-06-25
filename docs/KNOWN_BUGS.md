# DCA 折價獵人已知問題

更新日期：2026-06-25

## P0：封版前必修

### 1. 首頁三區重構尚未完成

目前 `pages/v16-full.js` 仍保留舊版：

```text
今日決策
可執行買點
觀察區
```

正確應改為：

```text
今日決策
買點區標的
觀察區
```

影響：

- 已登帳標的仍可能在畫面上造成混淆
- 買點區標的與今日決策職責不清

### 2. RKLB D2 補登需重新驗證

已新增 `pages/api/reconcile-tiers.js` 並加入 Wallet Cost Gap 防呆。

仍需實測：

- RKLBon D1 已有 5U
- Wallet 成本 15U
- 目前跌幅達 D2
- 補登後 D2 是否寫入 Ledger
- 今日決策是否消失

### 3. Today Decision 需跑完整測試案例

需依 `docs/TEST_CASES.md` 驗證：

- D1 已登帳不再顯示
- D2 已登帳不再顯示
- Gap Down 多層列出
- 同層重新觸發 24 小時規則

## P1：重要但可在 P0 後處理

### 1. Telegram 尚未完整接線

目前狀態：

- `lib/telegram/notify.js` 存在
- 但 Today Decision 新增層級尚未完整觸發 sendMessage

應完成：

- 讀取 Today Decision
- 檢查 Telegram 12 小時冷卻
- 發送新增層級提醒
- 已登帳後停止提醒

### 2. Wallet 變動提醒未完成

預期事件：

- 新增持倉
- 加碼
- 減碼
- 清倉

目前尚未完整實作。

### 3. 每日持倉日報未完成

預期包含：

- 持倉成本
- 持倉市值
- 未實現損益
- 報酬率
- 各標的明細

## P2：清理與重構

### 1. 舊版 API 應標示或移除

`pages/api/reconcile-ledger.js` 是舊版 D1-only API。

後續應避免使用，優先使用：

```text
pages/api/reconcile-tiers.js
```

### 2. 文件內舊資訊需定期清理

若程式完成三區首頁、Telegram 接線，需同步更新：

- `README.md`
- `docs/PROGRESS.md`
- `docs/AI_HANDOFF.md`
- `docs/KNOWN_BUGS.md`
- `CHANGELOG.md`

## P3：封板驗證

全部修完後，需逐項跑：

```text
docs/TEST_CASES.md
```

全部通過才可標記 V16 封版。
