const PILOT_RESULT_SUMMARY = {
  version: "v17-market-91-pilot-result-summary-v1",
  title: "Market 91 Evidence Pilot Result Summary",
  purpose: "Evaluate whether the capped Final Pipeline is useful before expanding stock coverage or adding any new process layer.",
  pilotScope: ["NVDA", "AVGO", "ORCL"],
  finalConclusion: "Pilot passed as a process test: the system can keep high-quality controls under evidence review without granting automatic permission, and it can block a narrative-heavy but financially stressed case from Permission Review.",
  noExpansionRule: "Do not expand beyond this pilot until NVDA and AVGO receive official pass/watch/fail markings and ORCL's provisional fail is reviewed against official filings.",
  subjects: [
    {
      symbol: "NVDA",
      role: "likely-pass control case",
      currentState: "Evidence checklist created; official verification not completed.",
      processFinding: "NVDA tests whether a very high-quality name can remain under evidence review without triggering automatic buy or DCA permission.",
      result: "PENDING_OFFICIAL_VERIFICATION",
      permission: { buy: false, dca: false, dipBuy: false, semiAuto: false, whitelist: false },
      nextAction: "Run official filing and earnings release extraction for data-center revenue, margin, export controls, supply-chain commitments, ASIC/TPU competition, and FCF.",
    },
    {
      symbol: "AVGO",
      role: "likely-pass but integration-risk case",
      currentState: "Evidence checklist created; official verification not completed.",
      processFinding: "AVGO tests whether a high-quality name with real integration/debt/concentration risk can be kept under evidence review before permission review.",
      result: "PENDING_OFFICIAL_VERIFICATION",
      permission: { buy: false, dca: false, dipBuy: false, semiAuto: false, whitelist: false },
      nextAction: "Run official filing and earnings release extraction for VMware integration, post-deal FCF, debt paydown, AI semiconductor revenue, customer concentration, and valuation support.",
    },
    {
      symbol: "ORCL",
      role: "negative-control / blocker test case",
      currentState: "Provisional fail; objective financial blocker maintained.",
      processFinding: "ORCL proves the Evidence layer has blocking power: strong AI/cloud narrative alone is not enough when CapEx, FCF, debt, and margin evidence remain problematic.",
      result: "PROVISIONAL_FAIL_BLOCKER_CONFIRMED",
      permission: { buy: false, dca: false, dipBuy: false, semiAuto: false, whitelist: false },
      nextAction: "Re-open only after official filings show improved FCF, debt load, CapEx payback, and margin quality.",
    },
  ],
  pipelineLessons: [
    "Evidence Verification should not be used only on likely winners; every pilot needs at least one negative-control case.",
    "A strong narrative can pass research interest but still fail permission eligibility.",
    "Provisional fail may maintain a block, but cannot be used to upgrade a stock without official filing extraction.",
    "Permission Review answers eligibility only; it is still separate from actual buy decisions.",
    "No sixth layer is needed after Final Score Lock and Permission Review.",
  ],
  decisionRulesConfirmed: [
    {
      rule: "Created is not Verified",
      confirmedBy: "NVDA and AVGO remain pending despite high draft scores.",
    },
    {
      rule: "Narrative is not permission",
      confirmedBy: "ORCL remains blocked despite AI/cloud growth narrative.",
    },
    {
      rule: "Visible blocker evidence can maintain a block",
      confirmedBy: "ORCL provisional fail keeps it outside Quality Gate and Permission Review.",
    },
    {
      rule: "Official evidence is required for upgrades",
      confirmedBy: "No pilot name receives buy, DCA, dip-buy, semi-auto, or whitelist permission.",
    },
  ],
  currentPermissions: {
    buy: 0,
    dca: 0,
    dipBuy: 0,
    semiAuto: 0,
    whitelist: 0,
  },
  recommendedNextStep: "Do not add a tenth batch. Run official extraction for NVDA and AVGO, then compare all three pilot outcomes before expanding the Evidence workflow.",
};

function getPilotResultSummary() {
  return PILOT_RESULT_SUMMARY;
}

module.exports = { PILOT_RESULT_SUMMARY, getPilotResultSummary };
