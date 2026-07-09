const EVIDENCE_PILOT_OFFICIAL_EXTRACTION_ROWS = [
  {
    symbol: "NVDA",
    evidenceStatus: "OFFICIAL_IR_RELEASE_EXTRACTED_PARTIAL",
    sourceTier: "official_investor_relations_press_release",
    sourceUrl: "https://investor.nvidia.com/news/press-release-details/2026/NVIDIA-Announces-Financial-Results-for-First-Quarter-Fiscal-2027/default.aspx",
    period: "Q1 FY2027 ended 2026-04-26",
    extractedFacts: {
      revenue: "$81.6B, +85% YoY, +20% QoQ",
      dataCenterRevenue: "$75.2B, +92% YoY, +21% QoQ",
      grossMarginGAAP: "74.9%",
      grossMarginNonGAAP: "75.0%",
      operatingIncomeGAAP: "$53.536B",
      netIncomeGAAP: "$58.321B",
      operatingCashFlow: "$50.344B",
      capexAndIntangiblesPurchases: "$1.757B",
      freeCashFlowApprox: "$48.587B using OCF minus purchases related to property/equipment/intangibles from release table",
      outlookRevenueNextQuarter: "$91.0B +/- 2%",
      chinaDataCenterComputeRevenueAssumption: "No Data Center compute revenue from China assumed in Q2 FY2027 outlook",
    },
    gateImplication: "Evidence supports strong revenue growth, data-center concentration, high margin and FCF quality, but export controls/customer concentration/supply commitments remain open blockers.",
    scoreLockReadiness: "READY_FOR_SCORE_LOCK_REVIEW_NOT_LOCKED",
    permission: { buy: false, dca: false, semiAuto: false, whitelist: false },
  },
  {
    symbol: "AVGO",
    evidenceStatus: "OFFICIAL_SOURCE_SEARCH_ATTEMPTED_STILL_PENDING_NOT_LOCKED",
    sourceTier: "official_required_not_yet_extracted",
    sourceUrl: null,
    searchContext: [
      "Secondary news context exists for Apple/Broadcom extension, but it is not official company evidence.",
      "Broadcom FY2025 Form 10-K references were located via external summaries, but direct official extraction was not completed in this run.",
    ],
    extractedFacts: {},
    gateImplication: "Do not lock score until official Broadcom IR release or SEC filing is extracted. Secondary media context is not enough for official evidence.",
    scoreLockReadiness: "BLOCKED_OFFICIAL_SOURCE_REQUIRED",
    permission: { buy: false, dca: false, semiAuto: false, whitelist: false },
  },
  {
    symbol: "LLY",
    evidenceStatus: "OFFICIAL_SOURCE_SEARCH_ATTEMPTED_STILL_PENDING_NOT_LOCKED",
    sourceTier: "official_required_not_yet_extracted",
    sourceUrl: null,
    searchContext: [
      "Secondary healthcare market commentary exists, but it is not official company evidence.",
      "Lilly 2025 Form 10-K references were located via external summaries, but direct official extraction was not completed in this run.",
    ],
    extractedFacts: {},
    gateImplication: "Do not lock score until official Lilly IR release or SEC filing is extracted. Product growth narrative alone is not enough.",
    scoreLockReadiness: "BLOCKED_OFFICIAL_SOURCE_REQUIRED",
    permission: { buy: false, dca: false, semiAuto: false, whitelist: false },
  },
  {
    symbol: "ORCL",
    evidenceStatus: "OFFICIAL_SOURCE_SEARCH_ATTEMPTED_NEGATIVE_CONTROL_STILL_PENDING_NOT_LOCKED",
    sourceTier: "official_required_not_yet_extracted",
    sourceUrl: null,
    searchContext: [
      "Secondary reports show strong AI/cloud revenue and RPO narrative but also major CapEx and negative FCF concerns.",
      "Because this is the negative control, secondary confirmation of blockers does not replace official filing evidence and does not unlock score lock.",
    ],
    extractedFacts: {},
    gateImplication: "Negative control remains blocked until official Oracle filing/release is extracted. AI/cloud RPO narrative cannot override debt, CapEx, FCF, and margin blockers.",
    scoreLockReadiness: "BLOCKED_OFFICIAL_SOURCE_REQUIRED_NEGATIVE_CONTROL",
    permission: { buy: false, dca: false, semiAuto: false, whitelist: false },
  },
];

function getEvidencePilotOfficialExtractionV1() {
  return {
    version: "v17-market-91-evidence-pilot-official-extraction-v2-three-source-attempts-recorded",
    policy: "official_evidence_extraction_only_no_buy_no_dca_no_semi_auto_no_whitelist",
    rule: "Only official IR releases, SEC filings, or official management commentary can support score lock. Secondary media can inform search direction but cannot lock scores.",
    summary: {
      total: EVIDENCE_PILOT_OFFICIAL_EXTRACTION_ROWS.length,
      officialExtracted: EVIDENCE_PILOT_OFFICIAL_EXTRACTION_ROWS.filter((x) => x.evidenceStatus.includes("OFFICIAL_IR_RELEASE_EXTRACTED")).length,
      officialSearchAttemptedStillPending: EVIDENCE_PILOT_OFFICIAL_EXTRACTION_ROWS.filter((x) => x.evidenceStatus.includes("SEARCH_ATTEMPTED")).length,
      officialPendingOrAttempted: EVIDENCE_PILOT_OFFICIAL_EXTRACTION_ROWS.filter((x) => x.evidenceStatus.includes("OFFICIAL_SOURCE") || x.evidenceStatus.includes("SEARCH_ATTEMPTED")).length,
      readyForScoreLockReview: EVIDENCE_PILOT_OFFICIAL_EXTRACTION_ROWS.filter((x) => x.scoreLockReadiness.includes("READY_FOR_SCORE_LOCK_REVIEW")).length,
      permissionsGranted: 0,
    },
    rows: EVIDENCE_PILOT_OFFICIAL_EXTRACTION_ROWS,
  };
}

module.exports = { EVIDENCE_PILOT_OFFICIAL_EXTRACTION_ROWS, getEvidencePilotOfficialExtractionV1 };
