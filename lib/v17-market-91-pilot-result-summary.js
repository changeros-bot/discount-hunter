const PILOT_RESULT_SUMMARY = {
  version: "v17-market-91-pilot-result-summary-v3-official-extraction-complete",
  title: "Market 91 Evidence Pilot Result Summary",
  purpose: "Close the capped Evidence pilot and allow stock-pool screening to resume without granting any trading permission.",
  pilotScope: ["NVDA", "AVGO", "ORCL"],
  finalConclusion: "Evidence pilot complete: NVDA is verified 16.5 watch-only, AVGO is verified 15.5 high-draft watch, and ORCL remains blocked. The workflow can now resume stock-pool screening, but permissions remain zero.",
  expansionRule: "Stock-pool screening may resume, but Evidence workflow should not expand to more names until a new formal-observation candidate needs it. No trading permission carries over from this pilot.",
  subjects: [
    {
      symbol: "NVDA",
      role: "likely-pass control case",
      currentState: "Official earnings release extracted; full SEC 10-Q can still be used for future quarterly refresh.",
      processFinding: "NVDA confirms the workflow can maintain a very high-quality name without triggering automatic buy or DCA permission.",
      result: "VERIFIED_16_PLUS_WATCH_ONLY_NO_PERMISSION",
      finalScore: 16.5,
      permission: { buy: false, dca: false, dipBuy: false, semiAuto: false, whitelist: false },
      nextAction: "Quarterly refresh only; monitor export controls, inventory/supply-chain commitments, customer concentration, and custom ASIC/TPU risk.",
    },
    {
      symbol: "AVGO",
      role: "likely-pass but integration-risk case",
      currentState: "Official earnings release extracted; score locked at 15.5 watch.",
      processFinding: "AVGO proves a high-quality name can still be downgraded to watch when integration, debt, concentration, and valuation risks remain material.",
      result: "VERIFIED_HIGH_DRAFT_WATCH_NO_PERMISSION",
      finalScore: 15.5,
      priorDraftScore: 16.0,
      permission: { buy: false, dca: false, dipBuy: false, semiAuto: false, whitelist: false },
      nextAction: "Quarterly refresh only; monitor VMware integration, FCF, indebtedness, customer concentration, and valuation vs FCF.",
    },
    {
      symbol: "ORCL",
      role: "negative-control / blocker test case",
      currentState: "Official extraction not sufficient for upgrade; blocker maintained.",
      processFinding: "ORCL confirms that narrative strength is not permission when CapEx, FCF, debt, and margin evidence remain problematic.",
      result: "FAILED_BLOCKER_MAINTAINED_NO_PERMISSION",
      finalScore: 59.5,
      permission: { buy: false, dca: false, dipBuy: false, semiAuto: false, whitelist: false },
      nextAction: "Re-open only after official filings show improved FCF, debt load, CapEx payback, and margin quality.",
    },
  ],
  pipelineLessons: [
    "Evidence Verification should not be used only on likely winners; every pilot needs at least one negative-control case.",
    "A strong narrative can pass research interest but still fail permission eligibility.",
    "A high-quality name can still be downgraded to watch if evidence gaps remain material.",
    "Official extraction can maintain or downgrade a score, but does not grant automatic permission.",
    "Permission Review answers eligibility only; it is separate from actual buy decisions.",
    "No sixth layer is needed after Final Score Lock and Permission Review.",
  ],
  decisionRulesConfirmed: [
    { rule: "Verified is not Permission", confirmedBy: "NVDA is verified 16.5 but buy/DCA/dip-buy/semi-auto/whitelist remain false." },
    { rule: "High quality can still be downgraded", confirmedBy: "AVGO moves from 16.0 draft to 15.5 official watch." },
    { rule: "Narrative is not permission", confirmedBy: "ORCL remains blocked despite AI/cloud growth narrative." },
    { rule: "Evidence workflow has value", confirmedBy: "The pilot produced three different outcomes: maintain, downgrade, and block." },
    { rule: "Stock pool can resume only after pilot closure", confirmedBy: "Pilot is closed and no permission was granted." },
  ],
  currentPermissions: { buy: 0, dca: 0, dipBuy: 0, semiAuto: 0, whitelist: 0 },
  recommendedNextStep: "Resume Market 91 stock-pool screening with the remaining 46 names. Start with the tenth batch, but keep all permissions false.",
};

function getPilotResultSummary() {
  return PILOT_RESULT_SUMMARY;
}

module.exports = { PILOT_RESULT_SUMMARY, getPilotResultSummary };
