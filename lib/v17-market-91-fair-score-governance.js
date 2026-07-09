const FAIR_SCORE_GOVERNANCE = {
  version: "v17-market-91-fair-score-governance-v1",
  status: "draft_governance_no_ticker_approval",
  pipeline: [
    { step: 1, name: "Market 91 Universe", purpose: "User screenshot universe only; not a recommendation source." },
    { step: 2, name: "Price Backtest Screen", purpose: "Creates research pool labels only." },
    { step: 3, name: "100-point Fair Observation Screen", purpose: "Decides whether a ticker deserves Formal Observation Candidate status." },
    { step: 4, name: "18-point Quality Gate", purpose: "Decides actual permissions: DCA, buy-the-dip, semi-auto, whitelist." },
  ],
  priorityRules: [
    "100-point screen and 18-point Quality Gate are sequential, not parallel.",
    "A ticker that passes the 100-point screen still has no trading permission until it passes the 18-point Quality Gate.",
    "If narrative conflicts with FCF, balance sheet, CapEx, or financing risk, objective financial layer wins.",
  ],
  totalScore: {
    A_backtest: 40,
    B_objectiveFinancial: 30,
    C_sectorQuality: 20,
    D_portfolioRiskFit: 10,
  },
  cutoffs: [
    { range: "80+", result: "Formal Observation Candidate only, if no hard blocker" },
    { range: "65-79", result: "Reserve / second review" },
    { range: "50-64", result: "Research pool only" },
    { range: "<50", result: "Exclude from current workflow" },
  ],
  hardBlockers: [
    "Objective financial layer below 18/30",
    "Negative FCF plus material CapEx or financing need",
    "Unknown symbol or weak data maturity",
    "Missing sector-specific checklist for the asset type",
  ],
  A_backtest: {
    sampleSize: [
      [">=20 events", 8], ["10-19 events", 6], ["5-9 events", 3], ["<5 events", 0],
    ],
    avgRet126d: [[">=25%", 10], ["15%-25%", 8], ["8%-15%", 6], [">0%-8%", 3], ["<=0%", 0]],
    winRate126d: [[">=70%", 10], ["60%-70%", 8], ["55%-60%", 5], ["50%-55%", 2], ["<50%", 0]],
    adverseMove: [[">= -10%", 8], ["-20% to -10%", 6], ["-30% to -20%", 3], ["< -30%", 0]],
    ret252dValidation: [["avg_ret_252d > 0 and win_rate_252d >= 55%", 4], ["avg_ret_252d > 0 and win_rate_252d >= 45%", 2], ["otherwise", 0]],
  },
  B_objectiveFinancial: {
    formula: "raw_objective_score_0_to_10 / 10 * 30",
    checks: [
      { name: "Revenue trend", pass2: "latest quarter and TTM/FY positive or clearly recovering", watch1: "mixed / flat / cycle-sensitive", fail0: "negative trend without credible recovery" },
      { name: "Free cash flow", pass2: "positive TTM/FY FCF and sustainable FCF margin", watch1: "positive but weak or volatile", fail0: "negative FCF or dependent on external financing" },
      { name: "Margin quality", pass2: "stable or improving", watch1: "mild compression or mixed", fail0: "severe compression / structurally weak" },
      { name: "Balance sheet", pass2: "net cash / low leverage / no funding stress", watch1: "elevated but manageable leverage", fail0: "debt stress or expected debt/equity financing need" },
      { name: "CapEx / capital discipline", pass2: "funded by operating cash flow with credible return path", watch1: "elevated but manageable", fail0: "CapEx drives negative FCF or future financing is required" },
    ],
    hardBlocker: "If FCF = 0 and either balance sheet = 0 or CapEx discipline = 0, cannot become Formal Observation Candidate.",
  },
  C_sectorQuality: {
    formula: "raw_quality_score_0_to_8 / 8 * 20",
    warning: "Scores are for within-bucket comparison first, not blind cross-sector ranking.",
    checks: ["Industry position", "Moat / switching cost / scale", "Management / capital allocation", "Thesis durability"],
    sectorModulesRequired: ["Software/cloud", "Semiconductor", "Industrial/power", "Energy", "Biotech/pharma", "ETF"],
  },
  D_portfolioRiskFit: {
    formula: "Start at 10 and deduct only for measurable risk. No preference bonus is allowed.",
    deductions: [
      { condition: "Bucket concentration after inclusion exceeds limit", points: -3 },
      { condition: "Same supply-chain / same factor as two or more existing holdings", points: -2 },
      { condition: "Single-name cyclicality or factor risk requires special rule", points: -2 },
      { condition: "Low liquidity / short history / weak data maturity", points: -2 },
      { condition: "Vehicle / tax / regulatory / currency complexity", points: -1 },
    ],
    forbiddenBonuses: ["fits AI", "fits current taste", "looks exciting", "matches previous narrative"],
  },
  market91BacktestAudit: {
    universeSource: "User screenshots 2026-07-08, de-duplicated to underlying symbols.",
    scriptPolicy: "Broad research screen, not approval list.",
    referenceMode: "252-day rolling high with 120-day minimum.",
    strongCandidate: "events>=5, avg_ret_126d>0, win_rate_ret_126d>=60%, avg_max_adverse_252d>-25% or missing",
    researchCandidate: "events>=5, avg_ret_126d>0, win_rate_ret_126d>=55%, avg_max_adverse_252d>-35% or missing",
    warning: "This is more objective than manual curation, but thresholds are still selected rules; therefore it is a research filter, not truth.",
  },
};

function getFairScoreGovernance() {
  return FAIR_SCORE_GOVERNANCE;
}

module.exports = { FAIR_SCORE_GOVERNANCE, getFairScoreGovernance };
