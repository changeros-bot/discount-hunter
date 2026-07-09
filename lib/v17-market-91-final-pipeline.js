const FINAL_PIPELINE = {
  version: "v17-market-91-final-pipeline-v1-capped-process",
  principle: "Every feature is guilty until proven useful. The process itself must not self-replicate into unnecessary layers.",
  headlineRule: "Eligibility is not a buy signal. Permission is not an order. Actual buying still depends on valuation, discount trigger, cash, allocation, and whether it crowds out 0050 / VOO / QQQM.",
  processCap: "The system is capped at five decision layers. No new layer may be added unless an existing layer is removed or merged.",
  steps: [
    {
      step: 1,
      name: "100-Point Screen",
      purpose: "Decide whether a stock deserves formal observation.",
      output: ["Formal Observation Candidate", "Reserve Second Review", "Research Pool", "Blocked"],
      stopRule: "If not Formal Observation Candidate, it cannot enter Quality Gate unless explicitly re-scored with new evidence.",
    },
    {
      step: 2,
      name: "18-Point Quality Gate Draft",
      purpose: "Estimate business quality using objective and qualitative checks.",
      output: ["Strong Draft Pass", "Draft Pass", "Borderline Pass", "Fail"],
      stopRule: "Draft pass is not DCA permission and not buy permission.",
    },
    {
      step: 3,
      name: "Official Evidence Verification",
      purpose: "Verify or disprove the draft using official filings, earnings releases, and management commentary.",
      output: ["Pass", "Watch", "Fail"],
      stopRule: "Any fail on FCF, margin, CapEx, debt, or thesis durability blocks Permission Review.",
    },
    {
      step: 4,
      name: "Final Score Lock",
      purpose: "Lock a verified score only after official evidence has been checked.",
      output: ["Verified 16+", "Verified 14-15.5", "Downgraded", "Failed"],
      stopRule: "Verified status is not permanent; new quarterly results or a thesis-breaking event re-opens Evidence Verification.",
    },
    {
      step: 5,
      name: "Permission Review",
      purpose: "Decide whether the stock is eligible for a rule bucket, not whether to buy now.",
      output: ["Watch Only", "Manual Buy Review", "DCA Eligible", "Dip-Buy Eligible", "Blocked"],
      stopRule: "Permission is only eligibility. It never triggers automatic orders.",
    },
  ],
  antiBloatRules: [
    "Do not add a sixth layer.",
    "Do not expand the stock universe until the pilot proves the pipeline is useful.",
    "Do not verify more than three pilot names until the verification workflow is evaluated.",
    "If a checklist item does not affect score, permission, or downgrade, delete it.",
    "If a rule sounds reasonable but does not change an action, it is not necessary.",
  ],
  pilot: {
    scope: ["NVDA", "AVGO", "ORCL"],
    reason: "NVDA and AVGO test workflow smoothness; ORCL tests blocking power against narrative-heavy but objectively blocked cases.",
    successCriteria: [
      "The process can maintain high-quality names without granting automatic buy permission.",
      "The process can keep ORCL or similar objective-financial-blocked cases outside Permission Review if evidence fails.",
      "The process produces a clear maintain / downgrade / block decision within one page.",
      "The process does not require another layer after Final Score Lock and Permission Review.",
    ],
  },
  permissionBoundary: {
    permissionReviewQuestion: "Does this stock qualify for a rule bucket?",
    actualBuyQuestion: "Given valuation, discount trigger, cash, allocation, and 0050/VOO/QQQM priority, should I buy now?",
    boundary: "These are separate questions. The pipeline answers only the first one.",
  },
};

function getFinalPipeline() {
  return FINAL_PIPELINE;
}

module.exports = { FINAL_PIPELINE, getFinalPipeline };
