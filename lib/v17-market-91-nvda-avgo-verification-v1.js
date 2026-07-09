const NVDA_AVGO_VERIFICATION_V1 = {
  version: "v17-market-91-nvda-avgo-verification-v1-provisional",
  sourceModule: "Evidence Checklist v1",
  verificationStatus: "PROVISIONAL_EVIDENCE_REVIEW_NOT_FULL_OFFICIAL_EXTRACTION",
  purpose: "Run provisional evidence marking for NVDA and AVGO to compare with ORCL's blocker test before expanding the Evidence workflow.",
  globalPermission: { buy: false, dca: false, dipBuy: false, semiAuto: false, whitelist: false },
  evidenceLimits: [
    "This is a provisional evidence pass/watch/fail marking based on latest public reporting and earnings coverage, not a full official SEC filing extraction.",
    "A provisional review can maintain or watch a score but cannot grant trading permission or whitelist status.",
    "Any full upgrade requires official 10-Q/10-K extraction and official earnings materials.",
  ],
  subjects: [
    {
      symbol: "NVDA",
      currentDraftScore: 16.5,
      provisionalScoreLock: 16.5,
      finalScoreLockStatus: "MAINTAIN_STRONG_DRAFT_PROVISIONAL_NO_PERMISSION",
      permission: { buy: false, dca: false, dipBuy: false, semiAuto: false, whitelist: false },
      verdict: "NVDA remains the strongest draft case. Latest public evidence supports revenue durability and FCF/capital-return strength, but export controls, supply-chain commitments, customer concentration, and custom ASIC/TPU competition still require full official extraction.",
      checklistResults: [
        { item: "Data-center revenue durability", result: "PASS_PROVISIONAL", evidenceSignal: "Latest reporting shows Q1 FY2027 revenue above expectations and strong Q2 guidance driven by AI demand.", action: "Maintain revenue-trend strength, but require official segment extraction." },
        { item: "Gross margin durability", result: "WATCH", evidenceSignal: "Analyst coverage points to margin durability concerns around memory costs and custom-chip competition; no fail yet, but official margin detail is required.", action: "Keep strong draft, do not upgrade to permission review." },
        { item: "Supply-chain commitments and inventory quality", result: "WATCH", evidenceSignal: "Public reporting highlights very large supply-chain commitments; demand appears strong but commitments require official inventory/purchase-obligation check.", action: "No whitelist until commitments are checked against confirmed demand." },
        { item: "Export-control exposure", result: "WATCH", evidenceSignal: "Trade complexity with China remains a visible risk in public coverage.", action: "Maintain blocker watch; no permission review until official risk disclosure is checked." },
        { item: "Custom ASIC / TPU competition", result: "WATCH", evidenceSignal: "Custom silicon from hyperscalers remains a core risk to GPU growth/margins.", action: "Keep thesis durability under watch." },
        { item: "FCF and capital return quality", result: "PASS_PROVISIONAL", evidenceSignal: "Latest coverage reports a major buyback expansion and dividend increase, implying strong expected cash generation.", action: "Maintain objective strength, pending official cash-flow extraction." }
      ],
      nextAction: "Full official extraction: latest 10-Q/10-K, earnings release, data-center segment, gross margin, inventory/purchase obligations, export-control disclosure, customer concentration, FCF and capital returns.",
    },
    {
      symbol: "AVGO",
      currentDraftScore: 16.0,
      provisionalScoreLock: 15.5,
      finalScoreLockStatus: "DOWNGRADE_TO_HIGH_DRAFT_WATCH_PROVISIONAL_NO_PERMISSION",
      permission: { buy: false, dca: false, dipBuy: false, semiAuto: false, whitelist: false },
      verdict: "AVGO remains high quality, but provisional evidence justifies a watch downgrade from 16.0 to 15.5 because AI growth is strong while expectations, VMware/regulatory scrutiny, concentration, valuation, and near-term AI-revenue digestion risks remain unresolved.",
      checklistResults: [
        { item: "AI semiconductor revenue durability", result: "PASS_PROVISIONAL_WITH_WATCH", evidenceSignal: "Latest coverage reports strong AI chip revenue growth and large future AI revenue expectations, but also investor disappointment and possible near-term slowdown risk.", action: "Keep AI thesis, but downgrade from strong-pass to high-draft watch until official details confirm durability." },
        { item: "VMware integration quality", result: "WATCH", evidenceSignal: "VMware-related software revenue is material, but integration/regulatory and customer-friction concerns remain visible in public reporting.", action: "No permission review until official VMware margin/retention/integration data is checked." },
        { item: "FCF after VMware", result: "WATCH", evidenceSignal: "Cash-flow quality after VMware remains a required official extraction item; public coverage is insufficient for a pass.", action: "Do not upgrade; require official cash-flow extraction." },
        { item: "Debt paydown / leverage", result: "WATCH", evidenceSignal: "Post-VMware leverage and debt paydown remain a core evidence gap.", action: "No whitelist or DCA eligibility." },
        { item: "Customer concentration", result: "WATCH", evidenceSignal: "Apple partnership through 2031 reduces one replacement concern but also confirms a large customer exposure that must be monitored.", action: "Keep concentration watch." },
        { item: "Valuation vs FCF support", result: "WATCH", evidenceSignal: "AI expectations are high and recent market reaction shows valuation sensitivity despite strong AI growth.", action: "Keep out of permission review until valuation is supported by official FCF trend." }
      ],
      nextAction: "Full official extraction: latest 10-Q/10-K, Q2 FY2026 results, AI semiconductor revenue, VMware segment margin/retention, FCF after integration, debt paydown, customer concentration, valuation vs FCF.",
    }
  ],
  combinedDecision: {
    nvda: "Maintain 16.5 strong draft; no permission.",
    avgo: "Provisional downgrade 16.0 -> 15.5 high-draft watch; no permission.",
    orclComparison: "ORCL remains blocked; this contrast shows the Evidence workflow can distinguish strong pending cases from blocker cases.",
    expandWorkflow: false,
    reason: "Evidence workflow has process value, but official extraction is still required before expanding beyond the pilot or granting any rule-bucket eligibility.",
  },
};

function getNvdaAvgoVerificationV1() {
  return NVDA_AVGO_VERIFICATION_V1;
}

module.exports = { NVDA_AVGO_VERIFICATION_V1, getNvdaAvgoVerificationV1 };
