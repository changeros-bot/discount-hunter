const SIMPLE_BUCKETS = [
  {
    bucket: "Core DCA",
    purpose: "True long-term scheduled buying. This is the user's main engine and should not be crowded out by individual stocks.",
    symbols: ["0050", "VOO", "QQQM"],
    actionRule: "Scheduled monthly DCA only. Do not stop because of short-term market noise.",
    evidenceRule: "ETF/index core does not require individual-company Evidence Check; only check product availability, fee structure, and whether it still matches the long-term portfolio plan.",
  },
  {
    bucket: "AI Satellite / Discount Add",
    purpose: "High-conviction AI / platform satellites. Not the core engine; add only on drawdown triggers or small capped satellite DCA if separately approved.",
    symbols: ["NVDA", "AVGO", "TSM", "MSFT", "META", "GOOGL", "AMZN", "MU"],
    actionRule: "No large lump-sum. Add only when -15% / -20% / -25% style discount trigger, valuation, cash, and allocation cap all pass.",
    evidenceRule: "Official evidence must support core thesis and no thesis-breaking event. Missing impossible granular fields become qualitative blockers, not automatic rejection.",
  },
  {
    bucket: "Discount Buy Candidate",
    purpose: "Quality, growth, or strategic names that are not core DCA and require a clear discount before buying.",
    symbols: ["QCOM", "LLY", "COST", "NET", "DELL", "ARM", "COIN", "SPOT", "TMUS", "ACN", "NOW", "REGN", "HUBB", "UNH", "SMCI", "ORCL", "SPCX"],
    actionRule: "No scheduled DCA by default. Buy only if discount trigger, valuation, cash, allocation cap, and thesis check all pass.",
    evidenceRule: "Official evidence must support core thesis and not reveal a hard blocker. ORCL remains blocked/extra strict until financial layer improves.",
  },
  {
    bucket: "Watch Only",
    purpose: "Good companies or defensive names, but not currently needed for the user's DCA/discount system.",
    symbols: ["NFLX", "MA", "PYPL", "UBER", "CMG", "MCD", "WMT", "PG", "KO", "PEP", "MRK", "PFE", "LMT", "UNP", "EQIX", "DASH", "AAON", "SBUX"],
    actionRule: "Observe only. Upgrade only after official evidence and valuation/trigger review.",
    evidenceRule: "Brand quality, defensiveness, or popularity is not enough for DCA eligibility.",
  },
  {
    bucket: "Blocked / Tool Only",
    purpose: "Not suitable for long-term DCA/discount buying. May be ETF/cash tool, inverse ETF, commodity ETF, source-uncertain, or high-risk cyclicality/speculation.",
    symbols: ["SQQQ", "SOXS", "PSQ", "UNG", "USO", "BNO", "AGG", "BIL", "SGOV", "USFR", "JAAA", "VDE", "VNQ", "KWEB", "FXI", "OIH", "SPYB", "FCX", "PBR", "STNG", "BILI", "BIDU", "GRAB", "NJ", "ECO"],
    actionRule: "Do not use for long-term DCA. Treat ETFs only as tools if separately approved in portfolio rules.",
    evidenceRule: "Blocked by structure, commodity exposure, inverse leverage, source uncertainty, or insufficient durability.",
  },
];

function getSimpleBuckets() {
  const symbols = SIMPLE_BUCKETS.flatMap((bucket) => bucket.symbols);
  const duplicateSymbols = Array.from(new Set(symbols.filter((symbol, index) => symbols.indexOf(symbol) !== index)));
  return {
    version: "v17-market-91-simple-buckets-v3-core-etf-dca-plus-satellite-discount",
    policy: "core_etf_dca_plus_satellite_discount_buying_no_semi_auto_no_whitelist",
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
      aiSatelliteDiscountAdd: SIMPLE_BUCKETS.find((x) => x.bucket === "AI Satellite / Discount Add")?.symbols.length || 0,
      discountBuyCandidate: SIMPLE_BUCKETS.find((x) => x.bucket === "Discount Buy Candidate")?.symbols.length || 0,
      watchOnly: SIMPLE_BUCKETS.find((x) => x.bucket === "Watch Only")?.symbols.length || 0,
      blockedOrToolOnly: SIMPLE_BUCKETS.find((x) => x.bucket === "Blocked / Tool Only")?.symbols.length || 0,
    },
  };
}

module.exports = { SIMPLE_BUCKETS, getSimpleBuckets };
