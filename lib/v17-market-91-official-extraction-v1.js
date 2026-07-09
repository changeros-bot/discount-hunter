const OFFICIAL_EXTRACTION_V1 = {
  version: "v17-market-91-official-extraction-v1-nvda-avgo-orcl",
  policy: "official_extraction_summary_only_no_trading_permission",
  purpose: "Close the Evidence pilot quickly by extracting the minimum necessary official/primary-source evidence for NVDA and AVGO, while keeping ORCL blocked because no official extraction sufficient for upgrade is available.",
  extractionStatus: {
    NVDA: "OFFICIAL_EARNINGS_RELEASE_EXTRACTED",
    AVGO: "OFFICIAL_EARNINGS_RELEASE_EXTRACTED",
    ORCL: "OFFICIAL_SOURCE_NOT_EXTRACTED_BLOCK_MAINTAINED_BY_CONSERVATIVE_RULE",
  },
  permission: { buy: false, dca: false, dipBuy: false, semiAuto: false, whitelist: false },
  rows: [
    {
      symbol: "NVDA",
      sourceType: "Official NVIDIA newsroom earnings release, Q1 FY2027",
      officialEvidence: [
        "Revenue $81.6B, up 85% YoY.",
        "Data Center revenue $75.2B, up 92% YoY.",
        "GAAP gross margin 74.9%, non-GAAP gross margin 75.0%.",
        "Q2 FY2027 revenue outlook $91.0B +/- 2%, with no Data Center compute revenue from China assumed.",
        "$20.0B returned to shareholders in Q1; additional $80.0B share repurchase authorization; dividend raised to $0.25 per share.",
        "Operating cash flow $50.344B; purchases related to property/equipment/intangibles $1.757B; cash and equivalents $13.237B plus marketable debt securities $37.098B.",
        "Inventories rose to $25.797B from $21.403B sequentially, requiring continued watch.",
      ],
      checklistResults: [
        { item: "Data-center revenue durability", result: "PASS_OFFICIAL", reason: "Official Data Center revenue growth remains exceptional." },
        { item: "Gross margin durability", result: "PASS_OFFICIAL_WITH_WATCH", reason: "Official margin is high and guided stable, but competitive and supply-chain risk remains." },
        { item: "Supply-chain commitments and inventory quality", result: "WATCH", reason: "Inventory increased; full 10-Q purchase obligation review still needed." },
        { item: "Export-control exposure", result: "WATCH", reason: "Q2 outlook assumes no Data Center compute revenue from China, so China/export exposure remains visible." },
        { item: "Custom ASIC / TPU competition", result: "WATCH", reason: "Official release supports platform demand but does not eliminate substitution risk." },
        { item: "FCF and capital return quality", result: "PASS_OFFICIAL", reason: "Official operating cash flow and capital returns are very strong." },
      ],
      finalScoreLock: { status: "VERIFIED_16_PLUS_NO_PERMISSION", score: 16.5, action: "MAINTAIN_STRONG_CORE_OBSERVATION" },
      permissionReview: { status: "WATCH_ONLY_HIGH_QUALITY", buy: false, dca: false, dipBuy: false, semiAuto: false, whitelist: false, reason: "Quality verified enough to maintain 16.5, but export, inventory/supply-chain, customer concentration, and ASIC/TPU watch items block permissions." },
    },
    {
      symbol: "AVGO",
      sourceType: "Official Broadcom Q2 FY2026 earnings release",
      officialEvidence: [
        "Q2 FY2026 revenue $22.187B, up 48% YoY.",
        "GAAP net income $9.310B; non-GAAP net income $12.074B.",
        "Adjusted EBITDA $15.244B, 69% of revenue.",
        "Cash from operations $10.493B; capex $231M; free cash flow $10.262B, 46% of revenue.",
        "AI semiconductor revenue $10.8B, up 143% YoY; Q3 AI semiconductor revenue expected to grow over 200% YoY to $16.0B.",
        "Q3 FY2026 total revenue guidance $29.4B; non-GAAP operating income guidance about 67% of revenue.",
        "Risk factors include significant customer risk, demand timing, outsourced supply chain, software competitiveness, VMware-related tax liabilities, and significant indebtedness.",
      ],
      checklistResults: [
        { item: "AI semiconductor revenue durability", result: "PASS_OFFICIAL", reason: "Official AI semiconductor revenue is very strong and guided higher." },
        { item: "VMware integration quality", result: "WATCH", reason: "Official release shows infrastructure software revenue but does not fully resolve VMware retention/integration/regulatory risk." },
        { item: "FCF after VMware", result: "PASS_OFFICIAL_WITH_WATCH", reason: "Official FCF is strong, but post-VMware long-term integration still requires continued watch." },
        { item: "Debt paydown / leverage", result: "WATCH", reason: "Official risk disclosure still highlights significant indebtedness." },
        { item: "Customer concentration", result: "WATCH", reason: "Official risk language includes significant customer and demand-timing risk." },
        { item: "Valuation vs FCF support", result: "WATCH", reason: "FCF supports quality, but valuation and AI expectation sensitivity remain market-level risks." },
      ],
      finalScoreLock: { status: "VERIFIED_16_MINUS_WATCH_NO_PERMISSION", score: 15.5, action: "MAINTAIN_HIGH_DRAFT_WATCH" },
      permissionReview: { status: "WATCH_ONLY_HIGH_QUALITY_WITH_INTEGRATION_RISK", buy: false, dca: false, dipBuy: false, semiAuto: false, whitelist: false, reason: "Official data improves confidence in FCF and AI revenue, but VMware, debt, customer concentration, and valuation risk keep permissions false." },
    },
    {
      symbol: "ORCL",
      sourceType: "Official source not extracted in this pass; Reuters/secondary blocker evidence preserved separately",
      officialEvidence: [
        "Official extraction not completed, so no upgrade is allowed.",
        "Conservative rule: lack of official source cannot upgrade a stock; visible blocker evidence can maintain a block.",
      ],
      checklistResults: [
        { item: "Objective financial blocker validation", result: "BLOCK_MAINTAINED", reason: "No official evidence sufficient to remove the prior blocker." },
        { item: "CapEx / FCF / debt", result: "BLOCK_MAINTAINED", reason: "Secondary evidence indicates the blocker cluster persists; official filing is still required before any re-open." },
      ],
      finalScoreLock: { status: "FAILED_BLOCKER_MAINTAINED", score: 59.5, action: "KEEP_OUT_OF_QUALITY_GATE_AND_PERMISSION_REVIEW" },
      permissionReview: { status: "BLOCKED", buy: false, dca: false, dipBuy: false, semiAuto: false, whitelist: false, reason: "ORCL remains blocked until official filings prove FCF, debt, CapEx payback, and margin quality are no longer hard blockers." },
    },
  ],
  finalPilotOutcome: {
    complete: true,
    expandStockPoolAllowed: true,
    nextAction: "Resume Market 91 stock pool screening with the remaining 46 names, but keep all permissions at zero unless future official extraction and Permission Review say otherwise.",
    permissionsRemainZero: true,
  },
};

function getOfficialExtractionV1() {
  return OFFICIAL_EXTRACTION_V1;
}

module.exports = { OFFICIAL_EXTRACTION_V1, getOfficialExtractionV1 };
