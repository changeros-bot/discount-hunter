const { getFairScoreReport } = require("./v17-market-91-fair-score-report");

// Source of truth: scripts/backtest_market_91_discount_hunter.py UNIVERSE, user screenshots 2026-07-08.
const ORIGINAL_MARKET_91_UNIVERSE = [
  "STLD", "PEP", "PFE", "EQT", "HUBB", "AVGO", "UNP", "PDD", "MRK", "COST",
  "UNG", "VZ", "AGG", "NVDA", "HPE", "ADBE", "ECH", "VNQ", "UBER", "LMT",
  "CMG", "MA", "STNG", "META", "SPOT", "HII", "ECO", "UMC", "INTU", "EQIX",
  "JAAA", "USFR", "ACN", "SGOV", "BIL", "BABA", "SOXS", "OXY", "BNO", "USO",
  "SQQQ", "WLK", "COP", "CVX", "XOM", "NET", "VDE", "BRLN", "BIDU", "REGN",
  "WMB", "PBR", "HAL", "ENB", "KWEB", "FXI", "BILI", "JD", "TMUS", "SLB",
  "NJ", "T", "PG", "PSON", "NUE", "SBUX", "DASH", "AAON", "UNH", "MCD",
  "DELL", "KO", "LLY", "WMT", "OIH", "PSQ", "GRAB", "TCOM", "NFLX", "PYPL",
  "QCOM", "SPYB", "MU", "TSM", "NOW", "SMCI", "ORCL", "ARM", "SPCX", "SNDK",
  "COIN",
];

function getMarket91ReconciliationAudit() {
  const report = getFairScoreReport();
  const rows = report.rows || [];
  const scoredSymbols = rows.map((row) => row.symbol);
  const scoredSet = new Set(scoredSymbols);
  const originalSet = new Set(ORIGINAL_MARKET_91_UNIVERSE);

  const scoredOriginal = ORIGINAL_MARKET_91_UNIVERSE.filter((symbol) => scoredSet.has(symbol));
  const missingOriginal = ORIGINAL_MARKET_91_UNIVERSE.filter((symbol) => !scoredSet.has(symbol));
  const extraNonOriginalRows = rows.filter((row) => !originalSet.has(row.symbol));
  const duplicateScoredSymbols = scoredSymbols.filter((symbol, index) => scoredSymbols.indexOf(symbol) !== index);

  const universeComplete = missingOriginal.length === 0 && extraNonOriginalRows.length === 0 && duplicateScoredSymbols.length === 0 && rows.length === ORIGINAL_MARKET_91_UNIVERSE.length;

  return {
    version: "v17-market-91-reconciliation-audit-v1-original-universe-vs-current-rows",
    sourceOfTruth: {
      file: "scripts/backtest_market_91_discount_hunter.py",
      note: "Source: user screenshots 2026-07-08, de-duplicated to underlying symbols.",
      originalUniverseTotal: ORIGINAL_MARKET_91_UNIVERSE.length,
    },
    correction: {
      previousCompletionClaimInvalid: true,
      reason: "rows.length reached 91, but some rows are extra non-original symbols while multiple original Market 91 symbols remain unscored.",
      rule: "Market 91 completion requires original-universe coverage, not row-count coverage.",
    },
    summary: {
      originalUniverseTotal: ORIGINAL_MARKET_91_UNIVERSE.length,
      currentScoreRows: rows.length,
      scoredOriginalCount: scoredOriginal.length,
      missingOriginalCount: missingOriginal.length,
      extraNonOriginalCount: extraNonOriginalRows.length,
      duplicateScoredCount: duplicateScoredSymbols.length,
      universeComplete,
      rowCountLooksCompleteButIsNot: rows.length === ORIGINAL_MARKET_91_UNIVERSE.length && !universeComplete,
    },
    missingOriginal,
    extraNonOriginalRows: extraNonOriginalRows.map((row) => ({ symbol: row.symbol, batch: row.batch, score: row.score, status: row.status, tag: row.tag })),
    scoredOriginal,
    duplicateScoredSymbols: Array.from(new Set(duplicateScoredSymbols)),
    nextAction: missingOriginal.length > 0
      ? "Stop expanding. Score only missingOriginal symbols from the original Market 91 universe until missingOriginalCount reaches 0."
      : "Original Market 91 universe coverage is complete; proceed to Quality Gate / Evidence Verification.",
  };
}

module.exports = { ORIGINAL_MARKET_91_UNIVERSE, getMarket91ReconciliationAudit };
