const { getFairScoreReport } = require("./v17-market-91-fair-score-report");

const QUALITY_GATE_RULES = {
  version: "v17-market-91-quality-gate-queue-v5-ninth-batch-megacap-cloud-enabled",
  gate: "18_point_quality_gate",
  purpose: "Only 100-point formal observation candidates can enter the 18-point Quality Gate queue. This queue does not grant trading permission.",
  objectiveLayerMax: 10,
  qualitativeLayerMax: 8,
  passThreshold: 14,
  strongThreshold: 16,
  tradingThreshold: 18,
  permissionPolicy: [
    "Queue status is not buy permission.",
    "Draft pass is not DCA permission.",
    "Only a fully verified 18/18 can be considered for any trading permission review.",
    "Any missing official filing, FCF, margin, debt, or thesis durability evidence blocks permission.",
  ],
  checks: {
    objective10: ["Revenue trend", "Free cash flow quality", "Margin quality", "Balance sheet / leverage", "CapEx and capital discipline"],
    qualitative8: ["Industry position", "Moat / switching cost / scale", "Management / capital allocation", "Thesis durability"],
  },
};

function buildQueueCandidate(row) {
  const candidate = {
    symbol: row.symbol,
    sourceBatch: row.batch,
    fairScore: row.score,
    fairScoreStatus: row.status,
    qualityGateStatus: "NOT_STARTED_OFFICIAL_VERIFICATION_REQUIRED",
    permission: { buy: false, dca: false, semiAuto: false, whitelist: false },
    nextRequiredEvidence: [
      "latest official 10-Q / 10-K or shareholder letter",
      "revenue growth and segment trend",
      "free cash flow after CapEx",
      "margin trend and pressure points",
      "balance sheet / leverage / capital allocation",
      "thesis durability and main failure mode",
    ],
  };

  const priorityMap = {
    NVDA: {
      priority: 1,
      mainRisk: "Gross margin durability, supply-chain commitments, customer concentration, export controls, and custom ASIC competition must be verified.",
      preliminaryGateBias: "LIKELY_STRONGEST_BUT_MARGIN_SUPPLY_CHAIN_AND_EXPORT_RISK_MUST_BE_VERIFIED",
    },
    AVGO: {
      priority: 2,
      mainRisk: "VMware integration, debt paydown, valuation, customer concentration, and AI custom ASIC cyclicality must be verified.",
      preliminaryGateBias: "LIKELY_STRONG_BUT_INTEGRATION_AND_CONCENTRATION_MUST_BE_VERIFIED",
    },
    MSFT: {
      priority: 3,
      mainRisk: "AI CapEx, Azure margin, Copilot monetization, OpenAI dependency, and valuation must be verified.",
      preliminaryGateBias: "LIKELY_STRONG_PLATFORM_BUT_AI_CAPEX_AND_MONETIZATION_MUST_BE_VERIFIED",
    },
    TSM: {
      priority: 4,
      mainRisk: "Geopolitical risk, overseas fab cost, CapEx intensity, and major AI customer concentration must be verified.",
      preliminaryGateBias: "LIKELY_STRONG_BUT_GEOPOLITICAL_AND_CAPEX_RISK_MUST_BE_VERIFIED",
    },
    GOOGL: {
      priority: 5,
      mainRisk: "Search AI disruption, AI CapEx, regulatory remedies, cloud margin, and ad durability must be verified.",
      preliminaryGateBias: "LIKELY_STRONG_CASHFLOW_BUT_SEARCH_AI_AND_REGULATORY_RISK_MUST_BE_VERIFIED",
    },
    ANET: {
      priority: 6,
      mainRisk: "Cloud titan customer concentration, AI Ethernet cycle, gross margin durability, inventory, and valuation must be verified.",
      preliminaryGateBias: "LIKELY_STRONG_BUT_CUSTOMER_CONCENTRATION_AND_NETWORKING_CYCLE_MUST_BE_VERIFIED",
    },
    META: {
      priority: 7,
      mainRisk: "AI CapEx / data center spending could pressure FCF and create overbuild risk.",
      preliminaryGateBias: "LIKELY_STRONG_BUT_CAPEX_MUST_BE_VERIFIED",
    },
    AMZN: {
      priority: 8,
      mainRisk: "AWS AI CapEx, cloud margin, retail operating leverage, logistics cost, and competitive pressure must be verified.",
      preliminaryGateBias: "LIKELY_STRONG_MULTI_ENGINE_PLATFORM_BUT_AWS_CAPEX_AND_MARGIN_MUST_BE_VERIFIED",
    },
    NOW: {
      priority: 9,
      mainRisk: "Armis acquisition, margin / FCF compression, and software growth durability must be verified.",
      preliminaryGateBias: "LIKELY_STRONG_BUT_MARGIN_AND_ACQUISITION_MUST_BE_VERIFIED",
    },
    MU: {
      priority: 10,
      mainRisk: "HBM ramp, pricing, margin durability, CapEx, supply growth, and customer qualification must be verified.",
      preliminaryGateBias: "PROMISING_AI_MEMORY_CORE_BUT_HBM_MARGIN_AND_CAPEX_MUST_BE_VERIFIED",
    },
    VRT: {
      priority: 11,
      mainRisk: "Backlog quality, margin durability, delivery execution, working capital, and valuation sensitivity must be verified.",
      preliminaryGateBias: "PROMISING_BUT_EXECUTION_AND_BACKLOG_QUALITY_MUST_BE_VERIFIED",
    },
  };

  const detail = priorityMap[row.symbol];
  if (detail) return { ...candidate, ...detail };

  return { ...candidate, priority: 99, mainRisk: row.blocker || "No specific risk recorded.", preliminaryGateBias: "UNRANKED" };
}

function getQualityGateQueue() {
  const report = getFairScoreReport();
  const eligible = (report.groups.formalObservationCandidateOnly || [])
    .map(buildQueueCandidate)
    .sort((a, b) => a.priority - b.priority || Number(b.fairScore || 0) - Number(a.fairScore || 0));
  const excluded = report.rows
    .filter((row) => !row.status.includes("FORMAL_OBSERVATION"))
    .map((row) => ({
      symbol: row.symbol,
      sourceBatch: row.batch,
      fairScore: row.score,
      status: row.status,
      reason: "Did not pass 100-point screen as Formal Observation Candidate; cannot enter 18-point Quality Gate queue yet.",
    }));

  return {
    version: QUALITY_GATE_RULES.version,
    policy: "queue_only_no_trading_permission",
    rules: QUALITY_GATE_RULES,
    summary: {
      eligible: eligible.length,
      excluded: excluded.length,
      nextReviewOrder: eligible.map((x) => x.symbol),
    },
    eligible,
    excluded,
  };
}

module.exports = { QUALITY_GATE_RULES, getQualityGateQueue };
