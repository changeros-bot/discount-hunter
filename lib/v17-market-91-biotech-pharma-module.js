const BIOTECH_PHARMA_MODULE = {
  version: "v17-market-91-biotech-pharma-module-v1",
  status: "sector_module_ready_draft_only",
  purpose: "Provide a sector-specific review layer for commercial-stage biotech / pharma names before any 100-point score can become a formal observation candidate.",
  safetyPolicy: "This module never grants buy, DCA, semi-auto, or whitelist permission. It only removes the missing-sector-module blocker when enough official source data is available.",
  requiredInputs: [
    "Latest 10-Q / 10-K or official earnings release",
    "Revenue by major product / collaboration",
    "Patent / exclusivity and biosimilar risk notes",
    "Late-stage pipeline and major clinical readouts",
    "FDA / EMA regulatory status and manufacturing issues",
    "Free cash flow and balance sheet self-funding capacity",
  ],
  hardBlockers: [
    "Single-product or single-franchise dependence without credible replacement path",
    "Major patent / exclusivity cliff within the review window with no offsetting pipeline",
    "Repeated regulatory rejection or manufacturing issue affecting a core product",
    "Negative FCF or financing dependence for a commercial-stage company",
    "Material trial failure in the only credible growth replacement asset",
  ],
  score20: {
    productConcentration: { max: 4, pass: "Diversified products or two-plus durable growth engines", watch: "One dominant franchise but credible transition path", fail: "One core product with visible erosion and no offset" },
    patentAndExclusivity: { max: 4, pass: "Long runway or well-managed IP / settlement structure", watch: "Known LOE / biosimilar risk but manageable", fail: "Near-term cliff dominates valuation" },
    pipelineDurability: { max: 4, pass: "Multiple late-stage shots with clear commercial relevance", watch: "Pipeline exists but timing / replacement power uncertain", fail: "Thin or recently impaired pipeline" },
    regulatoryExecution: { max: 4, pass: "Clean FDA / EMA execution and no material manufacturing drag", watch: "Manageable delays or product-specific issues", fail: "Core product blocked by regulatory / manufacturing problem" },
    financialSelfFunding: { max: 4, pass: "Positive FCF, strong balance sheet, internally funded R&D", watch: "Positive but volatile FCF or rising investment burden", fail: "External funding required" },
  },
};

const REGN_BIOTECH_REVIEW_DRAFT = {
  symbol: "REGN",
  module: "Biotech / Pharma",
  status: "MODULE_REVIEWED_DRAFT_PENDING_OFFICIAL_FILING_CHECK",
  previousScore: 71.5,
  moduleAdjustedScore: 69.5,
  confidence: "mixed_sources_needs_latest_official_10q_or_ir_verification",
  tag: "生技模組重評草稿",
  blocker: "官方財報 / 產品收入 / 專利與監管資料尚未完成逐項驗證",
  note: "REGN 從『缺生技模組』改為『已用生技模組重評草稿』。Dupixent 需求是正面，但 Eylea / Eylea HD 轉換、核心產品集中度、FDA / 製造議題與 pipeline 替代力仍需官方資料驗證。暫不升為正式觀察候選。",
  score20Draft: {
    productConcentration: { score: 2, max: 4, reason: "Dupixent 成長正面，但 Eylea franchise 仍是關鍵風險來源；需官方產品收入表確認集中度。" },
    patentAndExclusivity: { score: 2, max: 4, reason: "需補 patent / exclusivity / biosimilar 風險表；未驗證前只能給 watch。" },
    pipelineDurability: { score: 3, max: 4, reason: "研發平台與多管線具規模，但部分臨床 / 時程資訊需官方更新。" },
    regulatoryExecution: { score: 2, max: 4, reason: "Eylea HD 相關製造 / regulatory timing 需要列為扣分風險。" },
    financialSelfFunding: { score: 4, max: 4, reason: "商業化公司且具自我研發資金能力；仍需最新 10-Q 現金流確認。" },
    total: 13,
    max: 20,
  },
  permissions: {
    buy: false,
    dca: false,
    semiAuto: false,
    whitelist: false,
    formalObservationCandidate: false,
  },
  nextVerification: [
    "補最新官方 10-Q / earnings release",
    "拆 Eylea / Eylea HD / Dupixent / Libtayo / other revenue exposure",
    "補 patent / exclusivity / biosimilar watch table",
    "補 FDA / manufacturing / major trial readout status",
    "再決定 69.5 是否上調、下調或維持二審保留",
  ],
};

function getBiotechPharmaModule() {
  return BIOTECH_PHARMA_MODULE;
}

function getRegnBiotechReviewDraft() {
  return REGN_BIOTECH_REVIEW_DRAFT;
}

module.exports = {
  BIOTECH_PHARMA_MODULE,
  REGN_BIOTECH_REVIEW_DRAFT,
  getBiotechPharmaModule,
  getRegnBiotechReviewDraft,
};
