# V17 Quality Audit Batch Review｜外部稽核草稿審查

來源：使用者提供的第一批/第二批/第三批 Quality Audit 草稿。

狀態：不可直接視為最終稽核結果。必須先完成來源驗證與規則校正。

## 1. 可採納方向

- 將核心標的分批稽核：核心、衛星、特殊。
- 每檔輸出客觀財務、質化條件、總分、操作權限。
- 主 App 卡片只顯示簡化結果，完整內容放在 Quality Audit Center。

## 2. 不能直接採納的部分

### 2.1 未附來源的數字不可入庫為正式結果

以下內容需要逐項來源驗證：

- FY / TTM 營收。
- 自由現金流。
- 毛利率。
- CapEx。
- 資產負債表強弱。
- ETF 權重與費用率。
- BTC 採用與監管判斷。

未驗證前只可標記為 Draft / Pending Verification。

### 2.2 Quality 通過不等於自動成為核心倉位

Quality Gate 只回答「能不能分配資金」。

部位角色仍由 Portfolio Architecture 決定：

- Core Asset
- Satellite
- Spec Watch
- Data Pending

因此 AMDon / MRVLon 即使 Quality 通過，也不自動升級為核心；仍可維持衛星角色與低優先級。

### 2.3 RKLBon 規則必須強制覆蓋草稿

RKLBon 已由系統封版：

- 不做固定 DCA。
- 只等 -50% / -65% / -80% 深折扣。
- 不進完全自動交易白名單。

即使外部草稿寫「固定 DCA 小額/降低優先」，仍以系統封版規則為準。

### 2.4 SPCXon 規則必須修正

SPCXon 現在不可再用「非上市」敘述。

系統定位：

- 新上市 / IPO 後交易歷史不足。
- 未滿 52 週，不使用完整 52 週高點框架。
- 高點基準使用上市以來高點。
- Quality 預設未檢查或觀察。
- DCA 可保留 5U。
- 逢低必須人工確認。
- 不進自動交易白名單，直到至少兩季財報與足夠交易歷史。

## 3. 第一批正式稽核輸入規格

每檔必須提供：

1. 來源清單。
2. 數字日期。
3. 客觀分數。
4. 質化分數與每項一句理由。
5. 重大失敗項檢查。
6. 既有部位處置。
7. DCA 權限。
8. 逢低權限。
9. 半自動草稿權限。
10. 自動交易白名單資格。

## 4. 正式入庫狀態

| 狀態 | 說明 |
|---|---|
| Draft | 外部 AI 或人工草稿，未驗證來源 |
| Source Verified | 數字來源已驗證 |
| Rule Checked | 已套用 Quality Gate 數字門檻與重大失敗項 |
| Approved | 可進 Quality Audit Center 正式結果 |
| Rejected | 不符合規則或資料不足 |

## 5. Project Owner 判定

這批草稿可作為稽核起點，但不可直接作為自動交易白名單依據。

下一步應建立 Quality Audit Center 與 quality-audit API，先導入 Draft 狀態，再逐檔驗證來源與規則。
