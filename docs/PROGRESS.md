# DCA 折價獵人進度紀錄

## 2026-06-25

### 今日完成

- 釐清 V16 核心狀態機。
- 確認 DCA `N` 與折價買入 `D1-D4` 必須完全分帳。
- 確認 Ledger 是歷史與去重依據，不代表目前價格區間。
- 確認價格區間必須動態：跌深進入下一層，反彈則退回上一區間。
- 確認 Today Decision 公式：目前已觸發層級 - Ledger 已登帳層級。
- 確認 Gap Down 必須列出所有跨越層級，不得只列最深層。
- 新增 `pages/api/reconcile-tiers.js`，用於 D1-D4 逐層補登。
- 更新首頁補登按鈕與 `/reconcile` 手動補登頁，改呼叫 `/api/reconcile-tiers`。
- 修正同層重新開放條件：24 小時應以 `leftBuyZoneAt` 計算，不是買入時間。
- 補上 Wallet Cost Gap 防呆：Wallet 成本差額足夠，才允許補登更深層。
- 整理 GitHub 文件體系，建立 V16 規格、架構、API、狀態機、交接、測試與已知問題文件。

### 文件新增 / 更新

- `README.md`：專案入口、用途、啟動、部署、環境變數、已知問題、下一步。
- `CHANGELOG.md`：版本紀錄。
- `docs/V16_SPEC.md`：V16 規格與封版條件。
- `docs/ARCHITECTURE.md`：系統資料流與模組。
- `docs/PROGRESS.md`：進度紀錄。
- `docs/AI_HANDOFF.md`：AI 接手指南。
- `docs/TEST_CASES.md`：封板前測試案例。
- `docs/CONFIG.md`：設定參考。
- `docs/API.md`：API 參考。
- `docs/STATE_MACHINE.md`：V16 狀態機。
- `docs/KNOWN_BUGS.md`：已知問題。

### 重要決策

1. V16 不是自動交易系統。
2. 使用者手動買入，系統負責決策與提醒。
3. DCA `N` 不受折價買點影響。
4. D1-D4 每層獨立登帳。
5. 進度條採水壺模型，價格反彈時進度會下降。
6. 今日決策只顯示未登帳層級。
7. Telegram 只通知新增層級，不重複轟炸。
8. 延遲買入時，不追認舊價格，依最新價格與當下層級執行。

### 重要檔案

- `lib/v16-ledger.js`
  - Buy Ledger 核心函式
  - 同層重新觸發邏輯
  - `leftBuyZoneAt` 判定

- `pages/api/today-decisions.js`
  - 今日決策 API
  - 依 `getExecutableTiers()` 產生今日可執行項目

- `pages/api/reconcile-tiers.js`
  - D1-D4 補登 API
  - 使用 Wallet Cost Gap 防止誤補

- `pages/v16-full.js`
  - 目前主頁
  - 尚未完成三區重構

- `pages/reconcile.js`
  - 手動補登頁

### 目前卡住

1. 首頁仍是舊版區塊，尚未完成三區重構。
2. Telegram 發送工具存在，但尚未完整接上 Today Decision 流程。
3. 已知需要重新檢查 RKLB D2 補登後，今日決策是否正確消失。
4. `pages/api/reconcile-ledger.js` 是舊版，只補 D1，應避免再使用。

### 下次接手先看

1. `docs/V16_SPEC.md`
2. `docs/STATE_MACHINE.md`
3. `docs/KNOWN_BUGS.md`
4. `docs/TEST_CASES.md`
5. `docs/API.md`
6. `pages/api/reconcile-tiers.js`
7. `lib/v16-ledger.js`
8. `pages/v16-full.js`

### 下一步

1. 先驗證 `/api/reconcile-tiers` 是否能正確補登 RKLB D2。
2. 再重構 `pages/v16-full.js` 為三區：今日決策、買點區標的、觀察區。
3. 接上 Telegram：只通知新增未登帳層級。
4. 跑 `docs/TEST_CASES.md` 的案例。
5. 全部通過後再標記 V16 封板。
