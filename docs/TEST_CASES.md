# DCA 折價獵人 V16 測試案例

更新日期：2026-06-25

## Case 001：未達 D1

標的：NVDAon  
規則：D1=-15%, D2=-25%, D3=-35%, D4=-50%  
目前跌幅：-14.9%

預期：

- 今日決策：無
- Telegram：不通知
- 進度條：距離 D1 約 99%

## Case 002：剛達 D1

標的：NVDAon  
目前跌幅：-15.0%  
Ledger：D1 空

預期：

- 今日決策：NVDAon D1
- Telegram：可通知 D1
- 進度條：D1 → D2 開始

## Case 003：D1 已登帳

標的：NVDAon  
目前跌幅：-20%  
Ledger：D1 已有紀錄

預期：

- 今日決策：無
- 買點區標的：NVDAon 保留卡片
- 進度條：D1 → D2 約 50%

## Case 004：跳空到 D2

標的：RKLBon  
規則：D1=-25%, D2=-40%, D3=-60%  
目前跌幅：-43%  
Ledger：D1、D2 空

預期：

- 今日決策：RKLBon D1、RKLBon D2
- 排序：D2 在 D1 前
- Telegram：D1、D2 都可通知，但同層需受冷卻限制

## Case 005：D1 已登帳，D2 未登帳

標的：RKLBon  
目前跌幅：-43%  
Ledger：D1 已有紀錄，D2 空

預期：

- 今日決策：只顯示 RKLBon D2
- 不再顯示 D1

## Case 006：D1、D2 都已登帳

標的：RKLBon  
目前跌幅：-43%  
Ledger：D1、D2 已有紀錄

預期：

- 今日決策：無
- 買點區標的：RKLBon 保留卡片
- Ledger 顯示：D1 / D2 已登帳
- 進度條：D2 → D3

## Case 007：價格反彈

標的：RKLBon  
目前跌幅：由 -43% 回升至 -30%  
Ledger：D1、D2 已有紀錄

預期：

- 今日決策：無
- Ledger：仍保留 D1 / D2
- 目前價格區間：D1 → D2
- 進度條：退回 D1 → D2

## Case 008：同層重新觸發

標的：RKLBon  
Ledger：D2 已有紀錄  
流程：

1. 價格離開 D2 區間，例如由 -43% 回升到 -30%
2. 系統記錄 `leftBuyZoneAt`
3. 超過 24 小時
4. 價格再次跌回 -40% 以下

預期：

- 今日決策：RKLBon D2 可再次出現
- Telegram：可再次通知 D2

## Case 009：未滿 24 小時重新跌回

標的：RKLBon  
Ledger：D2 已有紀錄  
流程：

1. 價格離開 D2 區間
2. 未滿 24 小時
3. 價格再次跌回 D2

預期：

- 今日決策：不顯示 D2
- Telegram：不通知 D2

## Case 010：Wallet Cost Gap 不足

標的：RKLBon  
目前跌幅：-43%  
Ledger：D1 已有 5U  
Wallet 總成本：5U

預期：

- `reconcile-tiers` 不應補 D2
- skipped reason 應為 `insufficient_wallet_cost`

## Case 011：Wallet Cost Gap 足夠

標的：RKLBon  
目前跌幅：-43%  
Ledger：D1 已有 5U  
Wallet 總成本：15U

預期：

- `reconcile-tiers` 應補 D2 10U
- 今日決策補登後消失

## Case 012：DCA 不影響折價買點

標的：NVDAon  
Ledger：N 已有 5U  
目前跌幅：-15%  
D1 空

預期：

- 今日決策：NVDAon D1
- N 不視為 D1 已完成

## Case 013：買超過建議金額

標的：NVDAon  
D1 建議：5U  
實際買入：8U

預期：

- Ledger 記錄實際 8U
- D1 視為已完成
- 今日決策不再顯示 D1
