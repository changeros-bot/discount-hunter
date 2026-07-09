const { getFairScoreReport } = require("./v17-market-91-fair-score-report");

const QUALITY_GATE_RULES = {
  version: "v17-market-91-quality-gate-queue-v12-sixteenth-batch-power-grid-enabled",
  gate: "18_point_quality_gate",
  purpose: "Only 100-point formal observation candidates can enter the 18-point Quality Gate queue. This queue does not grant trading permission.",
  objectiveLayerMax: 10, qualitativeLayerMax: 8, passThreshold: 14, strongThreshold: 16, tradingThreshold: 18,
  permissionPolicy: ["Queue status is not buy permission.", "Draft pass is not DCA permission.", "Only a fully verified 18/18 can be considered for any trading permission review.", "Any missing official filing, FCF, margin, debt, or thesis durability evidence blocks permission."],
  checks: { objective10: ["Revenue trend", "Free cash flow quality", "Margin quality", "Balance sheet / leverage", "CapEx and capital discipline"], qualitative8: ["Industry position", "Moat / switching cost / scale", "Management / capital allocation", "Thesis durability"] },
};
function buildQueueCandidate(row) {
  const candidate = { symbol: row.symbol, sourceBatch: row.batch, fairScore: row.score, fairScoreStatus: row.status, qualityGateStatus: "NOT_STARTED_OFFICIAL_VERIFICATION_REQUIRED", permission: { buy: false, dca: false, semiAuto: false, whitelist: false }, nextRequiredEvidence: ["latest official 10-Q / 10-K or shareholder letter", "revenue growth and segment trend", "free cash flow after CapEx", "margin trend and pressure points", "balance sheet / leverage / capital allocation", "thesis durability and main failure mode"] };
  const priorityMap = {
    NVDA: { priority: 1, mainRisk: "Gross margin durability, supply-chain commitments, customer concentration, export controls, and custom ASIC competition must be verified.", preliminaryGateBias: "LIKELY_STRONGEST_BUT_MARGIN_SUPPLY_CHAIN_AND_EXPORT_RISK_MUST_BE_VERIFIED" },
    AVGO: { priority: 2, mainRisk: "VMware integration, debt paydown, valuation, customer concentration, and AI custom ASIC cyclicality must be verified.", preliminaryGateBias: "LIKELY_STRONG_BUT_INTEGRATION_AND_CONCENTRATION_MUST_BE_VERIFIED" },
    MSFT: { priority: 3, mainRisk: "AI CapEx, Azure margin, Copilot monetization, OpenAI dependency, and valuation must be verified.", preliminaryGateBias: "LIKELY_STRONG_PLATFORM_BUT_AI_CAPEX_AND_MONETIZATION_MUST_BE_VERIFIED" },
    CDNS: { priority: 4, mainRisk: "Semiconductor design cycle, AI/EDA demand, backlog, margin durability, customer concentration, China/export controls, and valuation must be verified.", preliminaryGateBias: "HIGH_QUALITY_EDA_PLATFORM_BUT_DESIGN_CYCLE_EXPORT_AND_VALUATION_MUST_BE_VERIFIED" },
    SNPS: { priority: 5, mainRisk: "EDA demand, IP growth, Ansys integration, debt/financing, margin durability, China/export controls, and valuation must be verified.", preliminaryGateBias: "HIGH_QUALITY_EDA_IP_PLATFORM_BUT_INTEGRATION_AND_VALUATION_MUST_BE_VERIFIED" },
    TSM: { priority: 6, mainRisk: "Geopolitical risk, overseas fab cost, CapEx intensity, and major AI customer concentration must be verified.", preliminaryGateBias: "LIKELY_STRONG_BUT_GEOPOLITICAL_AND_CAPEX_RISK_MUST_BE_VERIFIED" },
    GOOGL: { priority: 7, mainRisk: "Search AI disruption, AI CapEx, regulatory remedies, cloud margin, and ad durability must be verified.", preliminaryGateBias: "LIKELY_STRONG_CASHFLOW_BUT_SEARCH_AI_AND_REGULATORY_RISK_MUST_BE_VERIFIED" },
    ANET: { priority: 8, mainRisk: "Cloud titan customer concentration, AI Ethernet cycle, gross margin durability, inventory, and valuation must be verified.", preliminaryGateBias: "LIKELY_STRONG_BUT_CUSTOMER_CONCENTRATION_AND_NETWORKING_CYCLE_MUST_BE_VERIFIED" },
    META: { priority: 9, mainRisk: "AI CapEx / data center spending could pressure FCF and create overbuild risk.", preliminaryGateBias: "LIKELY_STRONG_BUT_CAPEX_MUST_BE_VERIFIED" },
    AMZN: { priority: 10, mainRisk: "AWS AI CapEx, cloud margin, retail operating leverage, logistics cost, and competitive pressure must be verified.", preliminaryGateBias: "LIKELY_STRONG_MULTI_ENGINE_PLATFORM_BUT_AWS_CAPEX_AND_MARGIN_MUST_BE_VERIFIED" },
    PWR: { priority: 11, mainRisk: "Utility grid demand, transmission backlog, labor execution, margin quality, working capital, customer concentration, and valuation must be verified.", preliminaryGateBias: "AI_GRID_ENGINEERING_CANDIDATE_BUT_BACKLOG_MARGIN_AND_WORKING_CAPITAL_MUST_BE_VERIFIED" },
    CEG: { priority: 12, mainRisk: "Power price cycle, nuclear fleet availability, policy/subsidy exposure, hyperscaler contract quality, margin, capital allocation, and valuation must be verified.", preliminaryGateBias: "AI_NUCLEAR_POWER_CANDIDATE_BUT_POWER_PRICE_POLICY_AND_CONTRACT_QUALITY_MUST_BE_VERIFIED" },
    NFLX: { priority: 13, mainRisk: "Subscriber growth, ad-tier monetization, content spend, margin durability, competition, and valuation must be verified.", preliminaryGateBias: "HIGH_QUALITY_STREAMING_PLATFORM_BUT_CONTENT_SPEND_AND_VALUATION_MUST_BE_VERIFIED" },
    NOW: { priority: 14, mainRisk: "Armis acquisition, margin / FCF compression, and software growth durability must be verified.", preliminaryGateBias: "LIKELY_STRONG_BUT_MARGIN_AND_ACQUISITION_MUST_BE_VERIFIED" },
    MA: { priority: 15, mainRisk: "Consumer spending cycle, cross-border volume, regulation/interchange pressure, network competition, and valuation must be verified.", preliminaryGateBias: "HIGH_QUALITY_PAYMENT_NETWORK_BUT_REGULATION_VOLUME_AND_VALUATION_MUST_BE_VERIFIED" },
    V: { priority: 16, mainRisk: "Payments volume, cross-border recovery, regulation/interchange litigation, competition, and valuation must be verified.", preliminaryGateBias: "HIGH_QUALITY_PAYMENT_NETWORK_BUT_REGULATION_AND_VOLUME_MUST_BE_VERIFIED" },
    GEV: { priority: 17, mainRisk: "Grid demand, gas power cycle, backlog quality, margin expansion, project execution, services mix, and valuation must be verified.", preliminaryGateBias: "AI_POWER_INFRASTRUCTURE_CANDIDATE_BUT_BACKLOG_MARGIN_AND_EXECUTION_MUST_BE_VERIFIED" },
    BKNG: { priority: 18, mainRisk: "Travel demand cycle, room nights growth, take rate, marketing efficiency, regulation, and valuation must be verified.", preliminaryGateBias: "HIGH_CASHFLOW_TRAVEL_PLATFORM_BUT_CYCLE_REGULATION_AND_VALUATION_MUST_BE_VERIFIED" },
    ISRG: { priority: 19, mainRisk: "Procedure growth, system placements, recurring instrument revenue, margin durability, competition, hospital CapEx cycle, and valuation must be verified.", preliminaryGateBias: "HIGH_QUALITY_ROBOTIC_SURGERY_PLATFORM_BUT_PROCEDURE_GROWTH_AND_VALUATION_MUST_BE_VERIFIED" },
    ROP: { priority: 20, mainRisk: "Organic growth, acquisition discipline, FCF quality, leverage, software mix, and valuation must be verified.", preliminaryGateBias: "QUALITY_VERTICAL_SOFTWARE_COMPOUNDER_BUT_MA_AND_VALUATION_MUST_BE_VERIFIED" },
    MU: { priority: 21, mainRisk: "HBM ramp, pricing, margin durability, CapEx, supply growth, and customer qualification must be verified.", preliminaryGateBias: "PROMISING_AI_MEMORY_CORE_BUT_HBM_MARGIN_AND_CAPEX_MUST_BE_VERIFIED" },
    VRT: { priority: 22, mainRisk: "Backlog quality, margin durability, delivery execution, working capital, and valuation sensitivity must be verified.", preliminaryGateBias: "PROMISING_BUT_EXECUTION_AND_BACKLOG_QUALITY_MUST_BE_VERIFIED" },
    INTU: { priority: 23, mainRisk: "AI disruption in tax/accounting, TurboTax and QuickBooks growth durability, SMB cycle, margin durability, and valuation must be verified.", preliminaryGateBias: "QUALITY_VERTICAL_SOFTWARE_BUT_AI_TAX_DISRUPTION_AND_VALUATION_MUST_BE_VERIFIED" },
  };
  const detail = priorityMap[row.symbol];
  if (detail) return { ...candidate, ...detail };
  return { ...candidate, priority: 99, mainRisk: row.blocker || "No specific risk recorded.", preliminaryGateBias: "UNRANKED" };
}
function getQualityGateQueue() {
  const report = getFairScoreReport();
  const eligible = (report.groups.formalObservationCandidateOnly || []).map(buildQueueCandidate).sort((a, b) => a.priority - b.priority || Number(b.fairScore || 0) - Number(a.fairScore || 0));
  const excluded = report.rows.filter((row) => !row.status.includes("FORMAL_OBSERVATION")).map((row) => ({ symbol: row.symbol, sourceBatch: row.batch, fairScore: row.score, status: row.status, reason: "Did not pass 100-point screen as Formal Observation Candidate; cannot enter 18-point Quality Gate queue yet." }));
  return { version: QUALITY_GATE_RULES.version, policy: "queue_only_no_trading_permission", rules: QUALITY_GATE_RULES, summary: { eligible: eligible.length, excluded: excluded.length, nextReviewOrder: eligible.map((x) => x.symbol) }, eligible, excluded };
}
module.exports = { QUALITY_GATE_RULES, getQualityGateQueue };
