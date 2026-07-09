const EVIDENCE_CHECKLIST_V1 = [
  {
    symbol: "NVDA",
    pilotRole: "likely-pass control case",
    currentDraftScore: 16.5,
    status: "EVIDENCE_CHECKLIST_CREATED_NOT_VERIFIED",
    permission: { buy: false, dca: false, semiAuto: false, whitelist: false },
    thesis: "AI GPU / networking / CUDA ecosystem leader with strongest current Quality Gate draft score.",
    officialSourceTargets: ["Latest NVIDIA Form 10-Q / 10-K", "Latest NVIDIA quarterly earnings release", "NVIDIA earnings call transcript or official management commentary", "Segment revenue / data-center disclosure"],
    checklist: [
      { item: "Data-center revenue durability", evidenceRequired: "Official data-center revenue trend and management guidance.", passCondition: "Data-center growth remains strong without signs of material pull-forward.", failCondition: "Growth decelerates sharply or management signals order digestion / excess inventory.", impact: "Fail = reduce Quality Gate score by 0.5 to 1.5 points." },
      { item: "Gross margin durability", evidenceRequired: "Official gross margin, segment mix, and supply / pricing commentary.", passCondition: "Margins remain structurally high with clear explanation of mix and pricing power.", failCondition: "Margins compress from pricing pressure, product transition, or ASIC/TPU competition.", impact: "Fail = block any trading-permission review until next quarter." },
      { item: "Supply-chain commitments and inventory quality", evidenceRequired: "Inventory, purchase obligations, supply commitments, and management commentary.", passCondition: "Commitments are backed by visible demand and inventory quality remains healthy.", failCondition: "Commitments or inventory rise faster than confirmed demand.", impact: "Fail = reset score to draft-pass only, no strong-pass label." },
      { item: "Export-control exposure", evidenceRequired: "Official risk disclosure and management commentary on China / restricted-market exposure.", passCondition: "Restricted-market impact is contained and replacement demand remains strong.", failCondition: "Export controls materially impair revenue, margin, or inventory quality.", impact: "Fail = hard blocker for permission review." },
      { item: "Custom ASIC / TPU competition", evidenceRequired: "Management commentary, customer mix, and demand signals for GPU vs custom silicon.", passCondition: "GPU platform demand remains dominant and custom silicon is complementary, not substitutional.", failCondition: "Hyperscaler custom ASICs begin structurally reducing Nvidia growth or margins.", impact: "Fail = reduce thesis durability score." },
      { item: "FCF and capital return quality", evidenceRequired: "Cash-flow statement, buyback/dividend policy, and working-capital trend.", passCondition: "FCF remains strong after working capital and supports capital returns without balance-sheet stress.", failCondition: "FCF quality weakens despite reported earnings growth.", impact: "Fail = reduce objective score." },
    ],
    nextAction: "Collect official filing + earnings release and mark each item pass / watch / fail before any permission review.",
  },
  {
    symbol: "AVGO",
    pilotRole: "likely-pass but integration-risk case",
    currentDraftScore: 16.0,
    status: "EVIDENCE_CHECKLIST_CREATED_NOT_VERIFIED",
    permission: { buy: false, dca: false, semiAuto: false, whitelist: false },
    thesis: "AI custom silicon plus infrastructure software / VMware cashflow compounder.",
    officialSourceTargets: ["Latest Broadcom Form 10-Q / 10-K", "Latest Broadcom quarterly earnings release", "Broadcom earnings call transcript or official management commentary", "VMware integration / software segment disclosure"],
    checklist: [
      { item: "AI semiconductor revenue durability", evidenceRequired: "Official AI semiconductor revenue trend, custom silicon commentary, and customer signals.", passCondition: "AI semiconductor growth is broad enough and not solely dependent on one short-cycle customer ramp.", failCondition: "AI revenue is too concentrated or management signals cyclical pull-forward.", impact: "Fail = reduce qualitative thesis durability score." },
      { item: "VMware integration quality", evidenceRequired: "Software revenue, margin, customer retention, renewal, and integration commentary.", passCondition: "VMware improves software margin/cashflow without visible customer churn or regulatory blowback.", failCondition: "Integration creates churn, margin pressure, regulatory pressure, or weak renewals.", impact: "Fail = hard blocker for permission review." },
      { item: "FCF after VMware", evidenceRequired: "Cash-flow statement and management commentary on post-acquisition FCF.", passCondition: "FCF remains strong after integration costs and restructuring.", failCondition: "Reported earnings improve but FCF weakens or becomes less transparent.", impact: "Fail = reduce objective score by 0.5 to 1.5 points." },
      { item: "Debt paydown / leverage", evidenceRequired: "Debt schedule, interest expense, leverage commentary, capital allocation plan.", passCondition: "Debt paydown is visible and does not crowd out investment or shareholder returns.", failCondition: "Leverage remains high or refinancing / interest burden worsens.", impact: "Fail = keep score below strong-pass threshold." },
      { item: "Customer concentration", evidenceRequired: "10-K / 10-Q customer concentration disclosures and management commentary.", passCondition: "Largest customer / hyperscaler exposure remains acceptable for the growth profile.", failCondition: "One customer or program dominates AI revenue too heavily.", impact: "Fail = reduce thesis durability and block whitelist review." },
      { item: "Valuation vs FCF support", evidenceRequired: "FCF trend, growth guidance, margin trend, and market multiple review.", passCondition: "Valuation can be justified by durable FCF growth, not only AI narrative expansion.", failCondition: "Valuation assumes perfect AI and VMware execution.", impact: "Fail = no trading-permission review even if quality remains high." },
    ],
    nextAction: "Verify VMware integration, post-deal FCF, and leverage before allowing any score upgrade.",
  },
  {
    symbol: "ORCL",
    pilotRole: "negative-control / blocker test case",
    currentDraftScore: null,
    priorFairScore: 59.5,
    priorStatus: "OBJECTIVE_FINANCIAL_BLOCKED",
    status: "EVIDENCE_CHECKLIST_CREATED_FOR_BLOCKER_VALIDATION_NOT_VERIFIED",
    permission: { buy: false, dca: false, semiAuto: false, whitelist: false },
    thesis: "AI database / cloud infrastructure narrative may be strong, but objective financial quality and capital intensity must prove the story before any permission path.",
    officialSourceTargets: ["Latest Oracle Form 10-Q / 10-K", "Latest Oracle quarterly earnings release", "Oracle earnings call transcript or official management commentary", "Debt, CapEx, remaining performance obligations, and cloud infrastructure disclosures"],
    checklist: [
      { item: "Objective financial blocker validation", evidenceRequired: "Official revenue, operating margin, FCF, debt, CapEx, and cloud infrastructure disclosure.", passCondition: "Financial quality improves enough to remove objective-financial blocker.", failCondition: "Debt, CapEx, or FCF pressure confirms the original block.", impact: "Fail = keep ORCL outside Quality Gate and Permission Review." },
      { item: "Cloud / AI infrastructure revenue quality", evidenceRequired: "Official cloud infrastructure growth, backlog/RPO, customer mix, and margin commentary.", passCondition: "Cloud/AI growth is profitable, durable, and not purely backlog narrative.", failCondition: "Cloud growth requires heavy CapEx without visible FCF conversion.", impact: "Fail = research only or blocked status maintained." },
      { item: "Debt and interest burden", evidenceRequired: "Balance sheet, debt maturity schedule, interest expense, and management deleveraging commentary.", passCondition: "Leverage is manageable and does not impair reinvestment or shareholder returns.", failCondition: "Debt burden constrains FCF, reinvestment, or valuation support.", impact: "Fail = hard blocker for permission review." },
      { item: "CapEx intensity and payback", evidenceRequired: "Capital expenditure, data-center buildout, cloud capacity commitments, and FCF after CapEx.", passCondition: "CapEx has visible return path through durable cloud demand and margin expansion.", failCondition: "CapEx accelerates faster than cloud monetization and FCF.", impact: "Fail = cannot enter 18-point Quality Gate." },
      { item: "Margin quality", evidenceRequired: "Operating margin, cloud margin commentary, software support margin, and infrastructure mix.", passCondition: "Margins remain durable despite cloud infrastructure transition.", failCondition: "Cloud buildout structurally dilutes margin.", impact: "Fail = maintain objective-financial block." },
      { item: "Narrative vs evidence gap", evidenceRequired: "Compare AI/cloud narrative against official numbers: revenue, FCF, margin, debt, CapEx.", passCondition: "Official data closes the gap between AI narrative and financial reality.", failCondition: "Narrative remains stronger than evidence.", impact: "Fail = explicit negative-control proof that Evidence Verification has value." },
    ],
    nextAction: "Run official verification to confirm whether ORCL remains blocked; this is the pilot's blocker test, not a buy candidate.",
  },
];

function getEvidenceChecklistV1() {
  return {
    version: "v17-market-91-evidence-checklist-v1-nvda-avgo-orcl-pilot",
    policy: "official_evidence_checklist_only_no_trading_permission",
    purpose: "Test the Evidence Verification process with two likely-pass controls and one blocker case before expanding coverage.",
    scope: ["NVDA", "AVGO", "ORCL"],
    pilotDesign: {
      likelyPassControls: ["NVDA", "AVGO"],
      blockerTest: "ORCL",
      reason: "A pilot with only high-quality winners tests workflow smoothness but not blocking power. ORCL tests whether the process can keep narrative-heavy but financially blocked names out of Permission Review.",
    },
    permissionPolicy: [
      "Checklist created does not mean verified.",
      "Checklist pass does not automatically mean buy permission.",
      "Any fail on FCF, margin, CapEx, debt, or thesis durability blocks trading-permission review.",
      "Verified status is not permanent; it must be re-opened after new quarterly results or a thesis-breaking event.",
      "Only after official filing verification can scores be maintained, reduced, or escalated to permission review.",
    ],
    summary: { total: EVIDENCE_CHECKLIST_V1.length, verified: 0, unverified: EVIDENCE_CHECKLIST_V1.length, tradingPermission: 0 },
    rows: EVIDENCE_CHECKLIST_V1,
  };
}

module.exports = { EVIDENCE_CHECKLIST_V1, getEvidenceChecklistV1 };
