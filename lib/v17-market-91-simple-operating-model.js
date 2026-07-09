const SIMPLE_OPERATING_MODEL = {
  version: "v17-market-91-simple-operating-model-v1-dca-discount-only",
  purpose: "Simplify Market 91 for the user's real use case: long-term DCA and discount buying. This replaces the over-engineered Evidence Pilot / Score Lock / Permission dry-run chain as the main workflow.",
  userUseCase: ["Long-term DCA", "Discount buying during drawdowns", "Avoid FOMO", "Avoid over-complex decision chains"],
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
      name: "Candidate Tier",
      purpose: "Classify each symbol into a practical DCA/discount-buying bucket.",
      outputs: ["Core DCA", "Discount Buy Candidate", "Watch Only", "Blocked / Tool Only"],
    },
    {
      step: 3,
      name: "Evidence Check Lite",
      purpose: "Use official evidence only for core thesis and hard blockers, not for impossible granular fields.",
      checks: ["Official evidence supports core thesis: yes / partial / no", "Hard blocker exists: yes / no", "Valuation or discount trigger required before action"],
      output: "No Action / Watch Only / DCA Eligible / Discount Buy Eligible",
    },
  ],
  simplifiedPermissions: {
    allowedStates: ["No Action", "Watch Only", "DCA Eligible", "Discount Buy Eligible"],
    removedOrFrozen: ["Buy", "Semi-auto", "Whitelist", "Permission dry-run", "Score Lock dry-run", "Pilot pass/fail"],
    hardRule: "Even DCA Eligible and Discount Buy Eligible still require allocation limits, cash availability, and valuation/discount trigger. No automatic buying.",
  },
  deprecatedMainWorkflowItems: [
    { name: "Evidence Pilot v2", status: "deprecated_as_main_workflow", keepAs: "historical diagnostic only" },
    { name: "Score Lock dry-run", status: "deprecated_as_main_workflow", keepAs: "historical diagnostic only" },
    { name: "Permission Review dry-run", status: "deprecated_as_main_workflow", keepAs: "historical diagnostic only" },
    { name: "Evidence Priority top 10", status: "deprecated_as_main_workflow", keepAs: "optional research queue only" },
    { name: "Semi-auto / Whitelist", status: "frozen", keepAs: "not used for user's DCA/discount strategy" },
  ],
  recommendedDailyUse: [
    "Check Core DCA list only for scheduled contributions.",
    "Check Discount Buy Candidate list only when drawdown trigger is hit.",
    "Ignore Watch Only unless a material official update changes the thesis.",
    "Never buy from Blocked / Tool Only.",
  ],
};

function getSimpleOperatingModel() {
  return SIMPLE_OPERATING_MODEL;
}

module.exports = { SIMPLE_OPERATING_MODEL, getSimpleOperatingModel };
