const { REGN_BIOTECH_REVIEW_DRAFT } = require("./v17-market-91-biotech-pharma-module");

const FIRST_BATCH = [
  { symbol: "NOW", score: 81.5, status: "FORMAL_OBSERVATION_CANDIDATE_ONLY", confidence: "source_mixed_needs_official_filing_check", tag: "完整度較高", blocker: "", note: "唯一超過80分；仍只是 Observation Only。Armis 併購壓縮 margin/FCF，需要後續追蹤。" },
  { symbol: "QCOM", score: 70.0, status: "RESERVE_SECOND_REVIEW", confidence: "source_mixed_needs_official_filing_check", tag: "二審保留", blocker: "", note: "車用/IoT/Edge AI 有加分，但手機週期與既有半導體曝險重疊，D 風險扣分重。" },
  { symbol: "ORCL", score: 59.5, status: "OBJECTIVE_FINANCIAL_BLOCKED", confidence: "source_mixed_needs_official_filing_check", tag: "財務層阻擋", blocker: "B2 FCF=0 + B4/B5=0", note: "AI Cloud 敘事強，但負FCF、超大CapEx、融資/負債風險觸發硬性阻擋；不進正式觀察。" },
  { symbol: "HUBB", score: 79.0, status: "DRAFT_PENDING_VERIFICATION", confidence: "partial_source_needs_latest_official_quarter", tag: "暫定分數", blocker: "", note: "接近80分，但來源仍需補最新官方季報；不得與 NOW/QCOM 同等可信度呈現。" },
  {
    symbol: "REGN",
    score: REGN_BIOTECH_REVIEW_DRAFT.moduleAdjustedScore,
    status: REGN_BIOTECH_REVIEW_DRAFT.status,
    confidence: REGN_BIOTECH_REVIEW_DRAFT.confidence,
    tag: REGN_BIOTECH_REVIEW_DRAFT.tag,
    blocker: REGN_BIOTECH_REVIEW_DRAFT.blocker,
    note: REGN_BIOTECH_REVIEW_DRAFT.note,
    biotechModule: REGN_BIOTECH_REVIEW_DRAFT,
  },
];

function getFirstBatch() {
  return {
    version: "v17-market-91-first-batch-v2-biotech-module-draft",
    policy: "draft_only_no_buy_no_dca_no_semi_auto_no_whitelist",
    summary: {
      total: FIRST_BATCH.length,
      observationOnly: FIRST_BATCH.filter((x) => x.status === "FORMAL_OBSERVATION_CANDIDATE_ONLY").length,
      reserve: FIRST_BATCH.filter((x) => x.status === "RESERVE_SECOND_REVIEW").length,
      blocked: FIRST_BATCH.filter((x) => x.status === "OBJECTIVE_FINANCIAL_BLOCKED").length,
      provisional: FIRST_BATCH.filter((x) => x.status.includes("DRAFT") || x.status.includes("PROVISIONAL") || x.status.includes("PENDING")).length,
    },
    rows: FIRST_BATCH,
  };
}

module.exports = { FIRST_BATCH, getFirstBatch };
