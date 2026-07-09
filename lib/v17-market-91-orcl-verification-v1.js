const ORCL_VERIFICATION_V1 = {
  version: "v17-market-91-orcl-verification-v1-blocker-test",
  symbol: "ORCL",
  sourceModule: "Evidence Checklist v1",
  pilotRole: "negative-control / blocker test case",
  verificationStatus: "PROVISIONAL_FAIL_OFFICIAL_FILING_STILL_REQUIRED",
  priorFairScore: 59.5,
  priorStatus: "OBJECTIVE_FINANCIAL_BLOCKED",
  finalScoreLock: {
    status: "FAILED_BLOCKER_CONFIRMED_PROVISIONAL",
    lockedScore: 59.5,
    action: "KEEP_OUT_OF_QUALITY_GATE_AND_PERMISSION_REVIEW",
    reason: "Latest public reporting around Oracle's FY2026 Q4 results points to strong AI/cloud growth but also confirms the exact blocker cluster: extreme CapEx, negative FCF, financing needs, debt/equity issuance, and margin/return-on-capital uncertainty.",
  },
  permissionReview: {
    status: "BLOCKED",
    buy: false,
    dca: false,
    dipBuy: false,
    semiAuto: false,
    whitelist: false,
    reason: "ORCL does not qualify for any rule bucket until official filings prove FCF, debt, CapEx payback, and margin quality are no longer hard blockers.",
  },
  checklistResults: [
    {
      item: "Objective financial blocker validation",
      result: "FAIL",
      evidenceSignal: "Revenue and cloud growth are strong, but latest reporting highlights negative FCF, elevated CapEx, and major financing needs.",
      action: "Keep objective-financial block.",
    },
    {
      item: "Cloud / AI infrastructure revenue quality",
      result: "WATCH",
      evidenceSignal: "OCI / cloud infrastructure growth and RPO/backlog appear very strong, but profitability and FCF conversion remain unproven under the new CapEx load.",
      action: "Do not convert narrative growth into Quality Gate eligibility yet.",
    },
    {
      item: "Debt and interest burden",
      result: "FAIL",
      evidenceSignal: "Public reporting indicates Oracle plans major financing through debt and equity while already carrying a capital-intensive AI buildout.",
      action: "Hard blocker for permission review.",
    },
    {
      item: "CapEx intensity and payback",
      result: "FAIL",
      evidenceSignal: "FY2026 CapEx and FY2027 projected CapEx are extremely high versus prior expectations; payback depends on durable AI/cloud contracts and customer repayment assumptions.",
      action: "Cannot enter 18-point Quality Gate.",
    },
    {
      item: "Margin quality",
      result: "WATCH",
      evidenceSignal: "Cloud infrastructure growth may pressure margins due to heavy data-center and GPU investment; official margin breakdown still required.",
      action: "Maintain blocker until official margin evidence improves.",
    },
    {
      item: "Narrative vs evidence gap",
      result: "FAIL",
      evidenceSignal: "AI/cloud narrative is strong, but official-quality evidence must first prove FCF and CapEx payback. Current public evidence supports keeping ORCL blocked.",
      action: "Negative-control test succeeded: Evidence Verification blocks narrative-heavy case.",
    }
  ],
  finalDecision: {
    maintainPriorBlock: true,
    upgradeToQualityGate: false,
    moveToPermissionReview: false,
    nextReviewTrigger: "Re-open only after latest official 10-K / 10-Q and earnings release show improved FCF, debt load, CapEx payback, and margin quality.",
  },
  evidenceLimits: [
    "This is not a full official filing extraction yet; it is a provisional blocker test based on latest public reporting of company results and spending plans.",
    "The decision is intentionally conservative: a lack of official filing extraction cannot upgrade the stock, but visible blocker evidence can keep it blocked.",
  ],
};

function getOrclVerificationV1() {
  return ORCL_VERIFICATION_V1;
}

module.exports = { ORCL_VERIFICATION_V1, getOrclVerificationV1 };
