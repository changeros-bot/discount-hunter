const SIMPLE_BUCKETS = [
  {
    bucket: "Core DCA",
    purpose: "Long-term scheduled buying only. These are not tactical trade signals.",
    symbols: ["NVDA", "AVGO", "MSFT", "TSM", "META", "GOOGL", "AMZN"],
    actionRule: "DCA only within allocation cap. No lump-sum unless discount trigger also qualifies.",
    evidenceRule: "Official evidence must not show thesis break; impossible granular fields become qualitative blockers rather than hard numeric requirements.",
  },
  {
    bucket: "Discount Buy Candidate",
    purpose: "Quality or strategic names that require a drawdown/discount trigger before buying.",
    symbols: ["MU", "NOW", "QCOM", "ORCL", "REGN", "HUBB", "LLY", "COST", "SPOT", "TMUS", "ACN", "NET", "DELL", "UNH", "SMCI", "ARM", "COIN", "SPCX"],
    actionRule: "No scheduled DCA by default. Buy only if discount trigger, valuation, cash, and allocation rules all pass.",
    evidenceRule: "Official evidence must support core thesis and not reveal a hard blocker. ORCL remains discount-only/blocked until financial layer improves.",
  },
  {
    bucket: "Watch Only",
    purpose: "Potentially useful but not currently eligible for DCA or discount buy.",
    symbols: ["NFLX", "MA", "PYPL", "UBER", "CMG", "MCD", "WMT", "PG", "KO", "PEP", "MRK", "PFE", "LMT", "UNP", "EQIX", "DASH", "AAON", "SBUX"],
    actionRule: "Observe only. Upgrade only after official evidence and valuation/trigger review.",
    evidenceRule: "Good brand or defensive quality is not enough for DCA eligibility.",
  },
  {
    bucket: "Blocked / Tool Only",
    purpose: "Not suitable for long-term DCA/discount buying. May be ETF/cash tool, inverse ETF, commodity ETF, or high-risk cyclicality/speculation.",
    symbols: ["SQQQ", "SOXS", "PSQ", "UNG", "USO", "BNO", "AGG", "BIL", "SGOV", "USFR", "JAAA", "VDE", "VNQ", "KWEB", "FXI", "OIH", "SPYB", "FCX", "PBR", "STNG", "BILI", "BIDU", "GRAB", "NJ", "ECO"],
    actionRule: "Do not use for long-term DCA. Treat ETFs only as tools if separately approved in portfolio rules.",
    evidenceRule: "Blocked by structure, commodity exposure, inverse leverage, source uncertainty, or insufficient durability.",
  },
];

function getSimpleBuckets() {
  const symbols = SIMPLE_BUCKETS.flatMap((bucket) => bucket.symbols);
  const duplicateSymbols = Array.from(new Set(symbols.filter((symbol, index) => symbols.indexOf(symbol) !== index)));
  return {
    version: "v17-market-91-simple-buckets-v2-unique-bucket-membership",
    policy: "dca_and_discount_buying_only_no_semi_auto_no_whitelist",
    integrity: {
      duplicateSymbols,
      duplicateCount: duplicateSymbols.length,
      pass: duplicateSymbols.length === 0,
      rule: "A symbol can belong to only one active simple bucket.",
    },
    buckets: SIMPLE_BUCKETS,
    summary: {
      bucketCount: SIMPLE_BUCKETS.length,
      coreDca: SIMPLE_BUCKETS.find((x) => x.bucket === "Core DCA")?.symbols.length || 0,
      discountBuyCandidate: SIMPLE_BUCKETS.find((x) => x.bucket === "Discount Buy Candidate")?.symbols.length || 0,
      watchOnly: SIMPLE_BUCKETS.find((x) => x.bucket === "Watch Only")?.symbols.length || 0,
      blockedOrToolOnly: SIMPLE_BUCKETS.find((x) => x.bucket === "Blocked / Tool Only")?.symbols.length || 0,
    },
  };
}

module.exports = { SIMPLE_BUCKETS, getSimpleBuckets };
