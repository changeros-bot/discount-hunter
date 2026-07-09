const PILOT_RESULT_SUMMARY = {
  version: "v17-market-91-pilot-result-summary-v2-provisional-results",
  title: "Market 91 Evidence Pilot Result Summary",
  purpose: "Evaluate whether the capped Final Pipeline is useful before expanding stock coverage or adding any new process layer.",
  pilotScope: ["NVDA", "AVGO", "ORCL"],
  finalConclusion: "Pilot passed as a process test: NVDA can remain a high-quality strong draft without permission, AVGO can be downgraded to watch despite high quality, and ORCL can be blocked as a narrative-heavy but financially stressed case.",
  noExpansionRule: "Do not add a tenth batch. Do not expand the Evidence workflow until these provisional results are checked against full official 10-Q/10-K and earnings materials.",
  subjects: [
    {
      symbol: "NVDA",
      role: "likely-pass control case",
      currentState: "Provisional evidence review completed; full official extraction still required.",
      processFinding: "NVDA tests whether a very high-quality name can remain under evidence review without triggering automatic buy or DCA permission.",
      result: "MAINTAIN_STRONG_DRAFT_PROVISIONAL_NO_PERMISSION",
      provisionalScore: 16.5,
      permission: { buy: false, dca: false, dipBuy: false, semiAuto: false, whitelist: false },
      nextAction: "Full official extraction for data-center revenue, margin, export controls, supply-chain commitments, ASIC/TPU competition, and FCF.",
    },
    {
      symbol: "AVGO",
      role: "likely-pass but integration-risk case",
      currentState: "Provisional evidence review completed; full official extraction still required.",
      processFinding: "AVGO proves a high-quality name can still be downgraded to watch when integration, debt, concentration, and valuation risks are not fully resolved.",
      result: "DOWNGRADE_TO_HIGH_DRAFT_WATCH_PROVISIONAL_NO_PERMISSION",
      provisionalScore: 15.5,
      priorDraftScore: 16.0,
      permission: { buy: false, dca: false, dipBuy: false, semiAuto: false, whitelist: false },
      nextAction: "Full official extraction for VMware integration, post-deal FCF, debt paydown, AI semiconductor revenue, customer concentration, and valuation support.",
    },
    {
      symbol: "ORCL",
      role: "negative-control / blocker test case",
      currentState: "Provisional fail; objective financial blocker maintained.",
      processFinding: "ORCL proves the Evidence layer has blocking power: strong AI/cloud narrative alone is not enough when CapEx, FCF, debt, and margin evidence remain problematic.",
      result: "PROVISIONAL_FAIL_BLOCKER_CONFIRMED",
      provisionalScore: 59.5,
      permission: { buy: false, dca: false, dipBuy: false, semiAuto: false, whitelist: false },
      nextAction: "Re-open only after official filings show improved FCF, debt load, CapEx payback, and margin quality.",
    },
  ],
  pipelineLessons: [
    "Evidence Verification should not be used only on likely winners; every pilot needs at least one negative-control case.",
    "A strong narrative can pass research interest but still fail permission eligibility.",
    "A high-quality name can still be downgraded to watch if evidence gaps remain material.",
    "Provisional fail may maintain a block, but cannot be used to upgrade a stock without official filing extraction.",
    "Permission Review answers eligibility only; it is still separate from actual buy decisions.",
    "No sixth layer is needed after Final Score Lock and Permission Review.",
  ],
  decisionRulesConfirmed: [
    { rule: "Created is not Verified", confirmedBy: "All pilot names still require full official extraction." },
    { rule: "Strong Draft is not Permission", confirmedBy: "NVDA remains 16.5 but receives zero permissions." },
    { rule: "High quality can still be downgraded", confirmedBy: "AVGO moves from 16.0 to provisional 15.5 watch." },
    { rule: "Narrative is not permission", confirmedBy: "ORCL remains blocked despite AI/cloud growth narrative." },
    { rule: "Official evidence is required for upgrades", confirmedBy: "No pilot name receives buy, DCA, dip-buy, semi-auto, or whitelist permission." },
  ],
  currentPermissions: { buy: 0, dca: 0, dipBuy: 0, semiAuto: 0, whitelist: 0 },
  recommendedNextStep: "Stop expansion. Perform full official filing extraction only for the three pilot names, then decide whether the Evidence workflow earns expansion.",
};

function getPilotResultSummary() {
  return PILOT_RESULT_SUMMARY;
}

module.exports = { PILOT_RESULT_SUMMARY, getPilotResultSummary };
