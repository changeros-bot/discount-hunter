const DEPRECATED_MARKET_91_WORKFLOWS = {
  version: "v17-market-91-deprecated-workflows-v1-simplification-cutover",
  reason: "The user only needs long-term DCA and discount buying. The previous multi-step pilot / score lock / permission dry-run flow was over-engineered for this use case.",
  replacedBy: "/market-91-simple",
  deprecatedAsMainWorkflow: [
    {
      name: "Evidence Pilot v2",
      paths: ["/market-91-evidence-pilot-v2", "/api/v17/market-91-evidence-pilot-v2"],
      keepAs: "historical diagnostic only",
      mainWorkflow: false,
    },
    {
      name: "Score Lock dry-run",
      paths: ["/api/v17/market-91-evidence-pilot-score-lock-dry-run"],
      keepAs: "historical diagnostic only",
      mainWorkflow: false,
    },
    {
      name: "Permission Review dry-run",
      paths: ["/api/v17/market-91-evidence-pilot-permission-dry-run"],
      keepAs: "historical diagnostic only",
      mainWorkflow: false,
    },
    {
      name: "Evidence Priority top 10",
      paths: ["/market-91-evidence-next-priority", "/api/v17/market-91-evidence-next-priority"],
      keepAs: "optional research queue only, not daily operating workflow",
      mainWorkflow: false,
    },
    {
      name: "Semi-auto / Whitelist permissions",
      paths: [],
      keepAs: "frozen; not used for DCA / discount buying",
      mainWorkflow: false,
    }
  ],
  activeMainWorkflow: {
    path: "/market-91-simple",
    layers: ["Universe Integrity", "Candidate Tier", "Evidence Check Lite"],
    permissions: ["No Action", "Watch Only", "DCA Eligible", "Discount Buy Eligible"],
  },
};

function getDeprecatedMarket91Workflows() {
  return DEPRECATED_MARKET_91_WORKFLOWS;
}

module.exports = { DEPRECATED_MARKET_91_WORKFLOWS, getDeprecatedMarket91Workflows };
