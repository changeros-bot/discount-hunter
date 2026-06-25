# AI 交接文件：DCA 折價獵人 V16

更新日期：2026-06-25

## 1. 接手前必讀

請先閱讀：

1. `docs/V16_SPEC.md`
2. `docs/ARCHITECTURE.md`
3. `docs/PROGRESS.md`
4. `docs/TEST_CASES.md`

不要直接改程式。

## 2. 專案一句話

DCA 折價獵人是長期 DCA + 逢低加碼決策系統，不是自動交易系統。

## 3. 不可再誤解的核心邏輯

### 3.1 DCA 與折價買入分離

- `N` = DCA 定期買入
- `D1-D4` = 折價買入

兩者互不干擾。

### 3.2 Ledger 的定位

Ledger 是：

- 歷史紀錄
- 去重依據
- 成本分類依據

Ledger 不是：

- 目前價格區間
- 當下是否仍在 D2 / D3 的唯一來源

### 3.3 價格區間是動態的

價格跌深，畫面前進；價格反彈，畫面退回。

例如 RKLBon：

- -42% 顯示 D2 → D3
- -30% 顯示 D1 → D2

即使 Ledger 歷史仍有 D2。

### 3.4 今日決策公式

```text
目前已觸發層級 - Ledger 已登帳層級 = 今日決策
```

已登帳層級不可再出現在今日決策，除非符合同層重新觸發規則。

### 3.5 同層重新觸發

必須同時滿足：

1. 離開該買點區
2. 離開後超過 24 小時
3. 再次跌回該買點區

24 小時以 `leftBuyZoneAt` 計算。

## 4. 封板區：除非使用者明確要求，禁止修改

- DCA `N` 與 D1-D4 分帳規則
- 今日決策公式
- Gap Down 多層觸發規則
- 水壺式進度條
- 同層重新觸發三條件
- Wallet Cost Gap 防呆

## 5. 可修改區

- UI 文案
- 區塊順序
- 顏色與 icon
- Telegram 訊息格式
- Debug 顯示
- 文件內容

但修改前仍需確認不影響 V16 規格。

## 6. 已知問題

### P0

- 首頁 `pages/v16-full.js` 尚未完成三區重構。
- RKLB D2 補登後，需要重新驗證今日決策是否消失。

### P1

- Telegram 發送工具存在，但尚未完整串入 Today Decision 新增層級流程。

### P2

- 舊 API `pages/api/reconcile-ledger.js` 只補 D1，後續應改用 `pages/api/reconcile-tiers.js`。

## 7. 下次接手第一件事

先不要改 UI。

第一步：

1. 打開首頁。
2. 按 `補登Ledger`。
3. 展開 Ledger 檢查。
4. 確認 RKLBon 是否同時有 D1 和 D2。
5. 確認今日決策是否消失。

如果未消失，先查：

- `pages/api/reconcile-tiers.js`
- `lib/v16-ledger.js`
- `pages/api/today-decisions.js`

## 8. 驗證順序

1. Price API 正常回傳。
2. Today Decision 正確列出未登帳層級。
3. Ledger 補登成功。
4. 已登帳層級從今日決策消失。
5. 價格反彈時進度條退回。
6. Gap Down 同時列出多層。
7. Telegram 只通知新增未登帳層級。

## 9. 封板標準

以下全部通過才可稱 V16 封板：

- Buy Ledger 正常
- DCA/N 分帳正常
- D1-D4 分帳正常
- Today Decision 正確
- Progress Bar 動態正確
- Gap Down 正確
- 同層 24 小時重開正確
- Reconcile 不誤補
- Telegram 正確通知
- 首頁三區完成
