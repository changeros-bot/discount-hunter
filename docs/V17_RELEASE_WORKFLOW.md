# Discount Hunter V17 Release Workflow

V17 goal: architecture first, fewer features, cleaner boundaries, durable state, and verifiable release quality.

Core rule:

> Every feature is guilty until proven useful.

V17 is not complete when features are added. V17 is complete only when the system is checked, corrected, verified, and sealed.

---

## 0. Release Gates

| Gate | Purpose | Pass Criteria | Owner |
|---|---|---|---|
| G0: Scope Lock | Prevent feature creep | V17 scope matches architecture brief | Josh + GPT |
| G1: Storage Safety | Prevent V16 storage mistake | No mutable state writes to runtime files | GPT |
| G2: Architecture Integrity | Ensure clean engine/strategy separation | Investment and Tactical are structurally independent | GPT |
| G3: Decision Correctness | Ensure buy signals are understandable | BTC and xStocks decisions are deterministic and explainable | GPT |
| G4: Regression Safety | Protect V16 behavior | Existing V16 routes and dashboard remain untouched or verified | GPT |
| G5: Release Candidate | Prepare sealable version | Manual checklist passes | Josh + GPT |
| G6: Seal / Freeze | V17封板 | No critical issue, docs updated, release target met | Josh |

---

## 1. V17新增流程表

| Phase | 新增項目 | 目的 | 儲存規則 | 完成標準 | 狀態 |
|---|---|---|---|---|---|
| 1 | V17 Storage Policy | 防止 V16 檔案儲存錯誤 | Mutable state must use durable KV | Production without KV fails loudly | Done |
| 2 | V17 Storage Guard | 程式層防呆 | No runtime file fallback in production | `v17-storage.js` ready | Done |
| 3 | Asset Registry v1 | 建立資產宇宙 | Static registry in repo allowed | Asset has ticker/engine/strategy/tags/review fields | Done |
| 4 | Strategy Definitions | 建立三分法 | Static constants | Pure DCA / DCA + Discount / Discount Only ready | Done |
| 5 | Engine Definitions | Investment / Tactical 分離 | Static constants | Same asset can exist in two engines but ledger separated | Done |
| 6 | BTC Discount Model v1 | BTC 正式加入 | Static model; no mutable state | BTC has its own model entry, not ETF copy-paste | In Progress |
| 7 | V17 Decision Engine | 產生決策輸出 | Read-only; no ledger writes | `/api/v17/decisions` returns explainable actions | Pending |
| 8 | V17 Asset API | 讓前端/測試可讀 registry | Read-only | `/api/v17/assets` works | Done |
| 9 | V17 Storage Status API | 檢查正式環境儲存安全 | Read-only | `/api/v17/storage-status` works | Done |
| 10 | Investment Ledger v17 | 建立長期引擎登帳 | Durable KV only | Separate from Tactical ledger | Pending |
| 11 | Tactical Ledger v17 | 建立戰術引擎登帳 | Durable KV only | Separate from Investment ledger | Pending |
| 12 | Review Framework | Quarterly Review / Trigger / Queue | Durable KV for mutable status | No auto research, no auto scoring | Pending |
| 13 | V17 Dashboard Slice | V17 最小可視化 | Reads APIs only | Shows assets, strategy, storage status, decisions | Pending |
| 14 | Regression Tests | 保護既有功能 | No production mutation | V16 critical APIs still work | Pending |
| 15 | Release Notes | 封板紀錄 | Docs only | V17 release scope and known limits documented | Pending |

---

## 2. 檢查流程表

| Check | 檢查內容 | 不通過時處理 |
|---|---|---|
| Storage Check | 是否有任何 V17 mutable state 寫入 `/data/*.json` 或 runtime file | 立即移除，改走 `v17-storage.js` |
| KV Check | Production 是否缺 Upstash KV | 不允許 silent fallback；直接報錯 |
| Registry Check | Asset 是否有完整欄位 | 不完整不得進 Qualified Universe |
| Strategy Check | Asset strategy 是否只屬於允許清單 | 不允許臨時字串 |
| Engine Check | Investment / Tactical 是否混用 ledger | 必須拆開 storage key |
| BTC Model Check | BTC 是否使用專屬 discount model | 不得直接套 ETF model 名稱 |
| Parameter Check | 是否新增過多 score / 指標 | 移除，保留最少參數 |
| Scope Check | 是否加入 AI Berkshire / 自動研究 / 自動評分 | 移出 V17 scope |
| V16 Safety Check | 是否修改 V16 主畫面或既有 API | 只有必要才改，且需 regression |
| Explainability Check | 每個 decision 是否能說明 reason | 無 reason 不得顯示為可執行 |

---

## 3. 修正流程表

| 問題類型 | 修正原則 | 優先級 |
|---|---|---|
| 資料可能遺失 | 先修 storage，再做功能 | P0 |
| Investment / Tactical 混帳 | 立即拆 ledger / key / command | P0 |
| V16 被破壞 | 立即 rollback 或 isolate | P0 |
| BTC 模型過度簡化 | 先標註 limitation，不假裝完整 | P1 |
| Asset Registry 太膨脹 | 移到 Watch / Research Queue | P1 |
| 參數太多 | 刪除，不加分數系統 | P1 |
| API 輸出不清楚 | 加 `reason`, `modelNote`, `storageStatus` | P2 |
| UI 太複雜 | 回到最小 dashboard slice | P2 |
| 文件與程式不同步 | 更新 docs 或調整程式 | P2 |

---

## 4. 驗證流程表

| 驗證項目 | 方法 | 通過標準 |
|---|---|---|
| V17 Storage Guard | Call `/api/v17/storage-status` | Production without KV returns unsafe/fail; with KV returns durable |
| Asset Registry API | Call `/api/v17/assets` | Returns V17 assets with engine/strategy/status |
| Qualified Filter | Call `/api/v17/assets?status=qualified` | Only qualified assets returned |
| BTC Registry | Inspect `/api/v17/assets` | BTC exists with `btc_discount_v1` and modes `dca`, `discount_buy` |
| xStocks Registry | Inspect `/api/v17/assets` | xStocks have strategy and discount model assigned |
| Tactical Separation | Inspect registry and storage keys | Tactical assets do not share Investment ledger |
| Decision API | Call `/api/v17/decisions` after implemented | Each decision has action, reason, tier, amount, command |
| No Auto Research | Search code for auto scoring/research | No auto-add, no AI score, no quality score |
| No Runtime File State | Search V17 code for fs writes | No V17 mutable write to file |
| V16 Smoke Test | Open V16 dashboard / critical APIs | Existing V16 behavior still works |
| Build Test | Run Next build | Build succeeds |
| Manual UX Test | Open dashboard on mobile | Readable, simple, not overbuilt |

---

## 5. V17 封板條件

V17 can be sealed only when all conditions below are true:

| Condition | Required |
|---|---|
| BTC is officially registered | Yes |
| BTC has its own discount model entry | Yes |
| Asset Universe v1 exists | Yes |
| Strategy三分法 exists | Yes |
| Investment / Tactical separation exists | Yes |
| V17 mutable state does not use runtime files | Yes |
| Production storage missing fails loudly | Yes |
| Decision output is explainable | Yes |
| V16 critical behavior is not broken | Yes |
| Release notes are written | Yes |

---

## 6. Explicit Non-Goals Before V17 Seal

Do not add these before V17 seal:

- Master Asset Database
- AI Berkshire Integration
- Auto research
- Auto scoring
- Auto add to universe
- Quality Score
- Discount Score
- AI Score
- Momentum Score
- Auto trading
- Complex backtest engine

---

## 7. Final Release Sequence

1. Finish V17 Decision Engine.
2. Add `/api/v17/decisions`.
3. Add minimal V17 dashboard slice.
4. Add durable Investment Ledger only if needed for V17 seal.
5. Keep Tactical Ledger registered but not overbuilt.
6. Run storage verification.
7. Run V16 smoke test.
8. Run build test.
9. Fix P0/P1 issues.
10. Write `docs/V17_RELEASE_NOTES.md`.
11. Josh approves封板.

---

## 8. Operating Principle

If a new feature does not improve execution, reduce risk, or clarify decisions, it does not belong in V17.
