const FUBON_MAIN_DCA_SYMBOLS = ["0050", "VOO", "QQQM"];

const ACTION_GATE_OUTPUTS = [
  "No Action",
  "Discount Add Allowed",
  "Watch Only",
  "Blocked",
];

const SIMPLE_BUCKETS = [
  {
    bucket: "AI Core / Satellite",
    purpose:
      "High-conviction AI / platform individual-stock and xStocks watchlist. This is not the user's Fubon core DCA system; it is a discount-add auxiliary system only.",
    symbols: ["NVDA", "AVGO", "TSM", "MSFT", "META", "GOOGL", "AMZN", "MU"],
    actionRule:
      "Do not chase highs. Add only when discount triggers such as -15% / -20% / -25% pass, thesis is intact, cash is available, and allocation cap allows. Never crowd out Fubon 0050 / VOO / QQQM monthly DCA.",
    evidenceRule:
      "Official evidence must support the AI/platform thesis and show no thesis-breaking event. Missing impossible granular fields become qualitative blockers, not automatic rejection.",
    actionGate: "Discount Add Allowed only when discount trigger, thesis, cash, and cap all pass; otherwise No Action.",
  },
  {
    bucket: "Discount Buy Candidate",
    purpose:
      "Quality, growth, strategic, or xStocks names that are not scheduled DCA holdings and require a clear discount before any add.",
    symbols: [
      "QCOM",
      "LLY",
      "COST",
      "NET",
      "DELL",
      "ARM",
      "COIN",
      "SPOT",
      "TMUS",
      "ACN",
      "NOW",
      "REGN",
      "HUBB",
      "UNH",
      "SMCI",
      "ORCL",
      "SPCX",
    ],
    actionRule:
      "No scheduled DCA by default. Buy only if discount trigger, thesis intact, cash allowed, and position cap allowed all pass.",
    evidenceRule:
      "Official evidence must support the core thesis and not reveal a hard blocker. ORCL remains extra strict until the financial layer improves.",
    actionGate: "Discount Add Allowed only when all gates pass; otherwise No Action.",
  },
  {
    bucket: "Watch Only",
    purpose:
      "Good companies, defensive names, or interesting businesses that are not currently needed for the user's Market 91 discount-add system.",
    symbols: [
      "NFLX",
      "MA",
      "PYPL",
      "UBER",
      "CMG",
      "MCD",
      "WMT",
      "PG",
      "KO",
      "PEP",
      "MRK",
      "PFE",
      "LMT",
      "UNP",
      "EQIX",
      "DASH",
      "AAON",
      "SBUX",
    ],
    actionRule: "Observe only. Do not buy unless the symbol is explicitly upgraded after evidence, valuation, and trigger review.",
    evidenceRule: "Brand quality, defensiveness, or popularity is not enough for Market 91 buy eligibility.",
    actionGate: "Watch Only.",
  },
  {
    bucket: "Blocked / Tool Only",
    purpose:
      "Not suitable for long-term DCA or Market 91 discount buying. Includes inverse ETFs, commodity/sector tools, cash/bond tools, China/energy/cyclical/speculative names, or source-uncertain items.",
    symbols: [
      "SQQQ",
      "SOXS",
      "PSQ",
      "UNG",
      "USO",
      "BNO",
      "AGG",
      "BIL",
      "SGOV",
      "USFR",
      "JAAA",
      "VDE",
      "VNQ",
      "KWEB",
      "FXI",
      "OIH",
      "SPYB",
      "FCX",
      "PBR",
      "STNG",
      "BILI",
      "BIDU",
      "GRAB",
      "NJ",
      "ECO",
    ],
    actionRule: "Do not use for long-term DCA or discount buying. Tool ETFs require a separate tool-specific rule set.",
    evidenceRule: "Blocked by structure, commodity exposure, inverse leverage, source uncertainty, insufficient durability, or mismatch with the user's system.",
    actionGate: "Blocked.",
  },
];

function getSimpleBuckets() {
  const symbols = SIMPLE_BUCKETS.flatMap((bucket) => bucket.symbols);
  const duplicateSymbols = Array.from(new Set(symbols.filter((symbol, index) => symbols.indexOf(symbol) !== index)));
  const forbiddenMarket91Symbols = symbols.filter((symbol) => FUBON_MAIN_DCA_SYMBOLS.includes(symbol));

  return {
    version: "v17-market-91-simple-buckets-v4-market91-discount-only",
    policy: "fubon_dca_separate_market91_individual_stocks_xstocks_discount_only_no_semi_auto_no_whitelist",
    architecture: {
      fubonMainDca: {
        symbols: FUBON_MAIN_DCA_SYMBOLS,
        role: "Main monthly long-term DCA system. Market 91 must not control, replace, or crowd it out.",
      },
      market91: {
        role: "Individual stocks / xStocks discount-add auxiliary system only.",
        mainline: ["Universe Integrity", "Strategy Bucket", "Action Gate"],
        allowedActionGateOutputs: ACTION_GATE_OUTPUTS,
        forbiddenOutputs: ["Buy", "Semi-auto", "Whitelist", "Permission dry-run"],
      },
    },
    integrity: {
      duplicateSymbols,
      duplicateCount: duplicateSymbols.length,
      forbiddenMarket91Symbols,
      forbiddenMarket91SymbolCount: forbiddenMarket91Symbols.length,
      pass: duplicateSymbols.length === 0 && forbiddenMarket91Symbols.length === 0,
      rule: "A symbol can belong to only one active simple bucket, and Fubon main DCA symbols must not appear in Market 91 buckets.",
    },
    buckets: SIMPLE_BUCKETS,
    summary: {
      bucketCount: SIMPLE_BUCKETS.length,
      aiCoreSatellite: SIMPLE_BUCKETS.find((x) => x.bucket === "AI Core / Satellite")?.symbols.length || 0,
      discountBuyCandidate: SIMPLE_BUCKETS.find((x) => x.bucket === "Discount Buy Candidate")?.symbols.length || 0,
      watchOnly: SIMPLE_BUCKETS.find((x) => x.bucket === "Watch Only")?.symbols.length || 0,
      blockedOrToolOnly: SIMPLE_BUCKETS.find((x) => x.bucket === "Blocked / Tool Only")?.symbols.length || 0,
      fubonMainDcaExcludedFromMarket91: FUBON_MAIN_DCA_SYMBOLS.length,
    },
  };
}

module.exports = {
  FUBON_MAIN_DCA_SYMBOLS,
  ACTION_GATE_OUTPUTS,
  SIMPLE_BUCKETS,
  getSimpleBuckets,
};
