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
    status: "CONFIRMED_MAIN_LIST",
    purpose:
      "Confirmed Market 91 main list for high-conviction AI / platform individual stocks and xStocks. This is not the user's Fubon core DCA system; it is a discount-add auxiliary system only.",
    symbols: ["NVDA", "AVGO", "TSM", "MSFT", "META", "GOOGL", "AMZN", "MU"],
    actionRule:
      "Do not chase highs. Add only when discount triggers such as -15% / -20% / -25% pass, thesis is intact, cash is available, and allocation cap allows. Never crowd out Fubon 0050 / VOO / QQQM monthly DCA.",
    evidenceRule:
      "Official evidence must support the AI/platform thesis and show no thesis-breaking event. MU is treated as AI infrastructure / HBM core, not a traditional pure cycle label.",
    actionGate: "Discount Add Allowed only when discount trigger, thesis, cash, and cap all pass; otherwise No Action.",
  },
  {
    bucket: "Confirmed Discount Buy Candidate",
    status: "CONFIRMED_MAIN_LIST",
    purpose:
      "Confirmed Market 91 main-list candidates for AI infrastructure, cloud, semiconductor, crypto-financial infrastructure, or strategic xStocks exposure.",
    symbols: ["QCOM", "DELL", "ARM", "ORCL", "NET", "NOW", "HUBB", "COIN", "SPCX"],
    actionRule:
      "No scheduled DCA by default. Buy only if discount trigger, thesis intact, cash allowed, and position cap allowed all pass.",
    evidenceRule:
      "Official evidence must support the core thesis and not reveal a hard blocker. ORCL remains extra strict until the financial layer improves. SPCX requires source/liquidity checks because tokenized SpaceX is not a normal listed equity.",
    actionGate: "Discount Add Allowed only when all gates pass; otherwise No Action.",
  },
  {
    bucket: "Secondary Watch",
    status: "DEFERRED_NOT_MAIN_LIST",
    purpose:
      "Good or interesting names that are not confirmed for the Market 91 main list. Keep visible for later review, but do not allow discount add by default.",
    symbols: ["LLY", "COST", "SPOT", "TMUS", "ACN", "REGN", "UNH", "SMCI"],
    actionRule:
      "No buy action by default. Re-promote only after a focused thesis review and explicit approval.",
    evidenceRule:
      "These names are either outside the AI/xStocks core lane, require healthcare/policy-specific review, are general quality stocks rather than discount-hunter names, or carry elevated governance/volatility concerns.",
    actionGate: "Watch Only unless explicitly upgraded.",
  },
  {
    bucket: "Watch Only",
    status: "WATCH_ONLY",
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
    status: "BLOCKED_OR_TOOL_ONLY",
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

function getBucketByName(name) {
  return SIMPLE_BUCKETS.find((x) => x.bucket === name);
}

function getSimpleBuckets() {
  const symbols = SIMPLE_BUCKETS.flatMap((bucket) => bucket.symbols);
  const duplicateSymbols = Array.from(new Set(symbols.filter((symbol, index) => symbols.indexOf(symbol) !== index)));
  const forbiddenMarket91Symbols = symbols.filter((symbol) => FUBON_MAIN_DCA_SYMBOLS.includes(symbol));
  const confirmedSymbols = [
    ...(getBucketByName("AI Core / Satellite")?.symbols || []),
    ...(getBucketByName("Confirmed Discount Buy Candidate")?.symbols || []),
  ];

  return {
    version: "v17-market-91-final-list-v1-17-confirmed",
    policy: "fubon_dca_separate_market91_17_confirmed_individual_stocks_xstocks_discount_only_no_semi_auto_no_whitelist",
    architecture: {
      fubonMainDca: {
        symbols: FUBON_MAIN_DCA_SYMBOLS,
        role: "Main monthly long-term DCA system. Market 91 must not control, replace, or crowd it out.",
      },
      market91: {
        role: "Individual stocks / xStocks discount-add auxiliary system only.",
        confirmedMainListSymbols: confirmedSymbols,
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
      confirmedMainListCount: confirmedSymbols.length,
      pass: duplicateSymbols.length === 0 && forbiddenMarket91Symbols.length === 0 && confirmedSymbols.length === 17,
      rule: "A symbol can belong to only one active simple bucket, Fubon main DCA symbols must not appear in Market 91 buckets, and the confirmed Market 91 main list must contain exactly 17 symbols.",
    },
    buckets: SIMPLE_BUCKETS,
    summary: {
      bucketCount: SIMPLE_BUCKETS.length,
      confirmedMainList: confirmedSymbols.length,
      aiCoreSatellite: getBucketByName("AI Core / Satellite")?.symbols.length || 0,
      confirmedDiscountBuyCandidate: getBucketByName("Confirmed Discount Buy Candidate")?.symbols.length || 0,
      secondaryWatch: getBucketByName("Secondary Watch")?.symbols.length || 0,
      watchOnly: getBucketByName("Watch Only")?.symbols.length || 0,
      blockedOrToolOnly: getBucketByName("Blocked / Tool Only")?.symbols.length || 0,
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
