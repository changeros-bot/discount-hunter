const EVIDENCE_PILOT_V2_NAMES = [
  {
    symbol: "NVDA",
    role: "positive_control_high_quality_ai_compute",
    purpose: "Should pass strong quality checks if official evidence confirms margin, FCF, growth, and supply-chain durability.",
    expectedFailureMode: "Export controls, customer concentration, inventory/supply commitments, or ASIC competition can still block Permission Review.",
    permission: { buy: false, dca: false, semiAuto: false, whitelist: false },
  },
  {
    symbol: "AVGO",
    role: "positive_control_complex_integration",
    purpose: "Tests whether strong AI semiconductor and FCF evidence can coexist with VMware integration and debt risk.",
    expectedFailureMode: "VMware integration, leverage, customer concentration, or AI custom ASIC cyclicality can block Permission Review.",
    permission: { buy: false, dca: false, semiAuto: false, whitelist: false },
  },
  {
    symbol: "LLY",
    role: "positive_control_non_tech_pharma_concentration",
    purpose: "Tests whether the Evidence Gate can handle a high-quality non-tech compounder with product concentration and valuation risk.",
    expectedFailureMode: "GLP-1 concentration, manufacturing capacity, pricing/policy pressure, pipeline durability, or valuation can block Permission Review.",
    permission: { buy: false, dca: false, semiAuto: false, whitelist: false },
  },
  {
    symbol: "ORCL",
    role: "negative_control_should_be_blocked_if_financial_layer_is_weak",
    purpose: "Must test the blocking mechanism. ORCL should not be upgraded merely because the AI/cloud narrative is attractive.",
    expectedFailureMode: "Debt, CapEx, FCF pressure, margin quality, and evidence insufficiency should block upgrade if not clearly resolved by official filings.",
    permission: { buy: false, dca: false, semiAuto: false, whitelist: false },
  },
];

function getEvidencePilotV2() {
  return {
    version: "v17-market-91-evidence-pilot-v2-four-name-process-test",
    policy: "pilot_only_no_buy_no_dca_no_semi_auto_no_whitelist",
    principle: "Do not scale Evidence Verification to top 10 until this pilot proves the gate can both pass strong names and block weak/complex names.",
    stages: [
      "Official Evidence Extraction",
      "18-point Quality Gate refresh",
      "Final Score Lock",
      "Permission Review dry run",
      "Pilot pass/fail decision before scaling",
    ],
    pilotNames: EVIDENCE_PILOT_V2_NAMES,
    passCriteria: [
      "ORCL remains blocked unless official evidence clearly resolves financial-layer blockers.",
      "At least one strong positive-control name can pass Quality Gate without receiving automatic trading permission.",
      "All pilot outputs preserve No Buy / No DCA / No Semi-auto / No Whitelist until Permission Review.",
      "If evidence is missing or ambiguous, the system must choose hold/block rather than upgrade.",
    ],
    scaleRule: "Only after Evidence Pilot v2 passes should the remaining Evidence Priority names be processed in bulk.",
  };
}

module.exports = { EVIDENCE_PILOT_V2_NAMES, getEvidencePilotV2 };
