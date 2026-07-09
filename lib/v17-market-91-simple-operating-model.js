const SIMPLE_OPERATING_MODEL = {
  version: "v17-market-91-simple-operating-model-v2-core-etf-dca-plus-satellite-discount",
  purpose: "Simplify Market 91 for the user's real use case: core ETF long-term DCA plus satellite / discount buying. This replaces the over-engineered Evidence Pilot / Score Lock / Permission dry-run chain as the main workflow.",
  userUseCase: ["Core ETF long-term DCA", "AI satellite discount add", "Individual-stock discount buying", "Avoid FOMO", "Avoid over-complex decision chains"],
  activeWorkflow: [
    {
      step: 1,
      name: "Universe Integrity",
      purpose: "Make sure the symbol universe is correct before any scoring.",
      checks: ["missingOriginalCount = 0", "duplicateOriginalCount = 0", "extra non-original symbols separated as expansion rows"],
      output: "universe_ok / universe_fix_required",
    },
    {
      step: 2,
      name: "Strategy Bucket",
      purpose: "Classify each symbol into the user's actual investing buckets.",
      outputs: ["Core DCA", "AI Satellite / Discount Add", "Discount Buy Candidate", "Watch Only", "Blocked / Tool Only"],
    },
    {
      step: 3,
      name: "Action Gate",
      purpose: "Decide whether action is allowed today based on bucket, trigger, valuation, cash, and allocation cap.",
      checks: ["Core DCA follows schedule", "AI Satellite requires drawdown trigger", "Discount Buy requires trigger + thesis check", "Watch/Blocked cannot buy"],
      output: "No Action / Scheduled DCA / Discount Add Allowed / Watch Only / Blocked",
    },
  ],
  simplifiedPermissions: {
    allowedStates: ["No Action", "Scheduled DCA", "Discount Add Allowed", "Watch Only", "Blocked"],
    removedOrFrozen: ["Buy", "Semi-auto", "Whitelist", "Permission dry-run", "Score Lock dry-run", "Pilot pass/fail"],
    hardRule: "Even Scheduled DCA and Discount Add Allowed still require allocation limits, cash availability, and no thesis-breaking event. No automatic buying.",
  },
  deprecatedMainWorkflowItems: [
    { name: "Evidence Pilot v2", status: "deprecated_as_main_workflow", keepAs: "historical diagnostic only" },
    { name: "Score Lock dry-run", status: "deprecated_as_main_workflow", keepAs: "historical diagnostic only" },
    { name: "Permission Review dry-run", status: "deprecated_as_main_workflow", keepAs: "historical diagnostic only" },
    { name: "Evidence Priority top 10", status: "deprecated_as_main_workflow", keepAs: "optional research queue only" },
    { name: "Semi-auto / Whitelist", status: "frozen", keepAs: "not used for user's DCA/discount strategy" },
  ],
  recommendedDailyUse: [
    "Check Core DCA only on scheduled contribution dates: 0050 / VOO / QQQM.",
    "Check AI Satellite / Discount Add only when drawdown trigger is hit.",
    "Check Discount Buy Candidate only when valuation and discount trigger both matter.",
    "Ignore Watch Only unless a material official update changes the thesis.",
    "Never buy from Blocked / Tool Only.",
  ],
};

function getSimpleOperatingModel() {
  return SIMPLE_OPERATING_MODEL;
}

module.exports = { SIMPLE_OPERATING_MODEL, getSimpleOperatingModel };
