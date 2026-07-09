const { getFairScoreReport } = require("./v17-market-91-fair-score-report");
const { ORIGINAL_MARKET_91_UNIVERSE } = require("./v17-market-91-reconciliation-audit");

function getMarket91ReconciliationIntegrity() {
  const report = getFairScoreReport();
  const rows = report.rows || [];
  const originalSet = new Set(ORIGINAL_MARKET_91_UNIVERSE);
  const scoredSymbols = rows.map((row) => row.symbol);
  const scoredSet = new Set(scoredSymbols);
  const missingOriginal = ORIGINAL_MARKET_91_UNIVERSE.filter((symbol) => !scoredSet.has(symbol));
  const duplicateSymbols = scoredSymbols.filter((symbol, index) => scoredSymbols.indexOf(symbol) !== index);
  const duplicateOriginalSymbols = Array.from(new Set(duplicateSymbols.filter((symbol) => originalSet.has(symbol))));
  const duplicateExtraSymbols = Array.from(new Set(duplicateSymbols.filter((symbol) => !originalSet.has(symbol))));
  const extraNonOriginalRows = rows.filter((row) => !originalSet.has(row.symbol));
  const coveragePass = missingOriginal.length === 0;
  const duplicateOriginalPass = duplicateOriginalSymbols.length === 0;
  const originalUniverseIntegrityPass = coveragePass && duplicateOriginalPass;

  return {
    version: "v17-market-91-reconciliation-integrity-v1-coverage-plus-duplicate-check",
    rule: "Original Market 91 integrity passes only when missingOriginalCount = 0 and duplicateOriginalCount = 0.",
    note: "Extra non-original expansion rows are warnings, not members of the original Market 91 universe.",
    summary: {
      originalUniverseTotal: ORIGINAL_MARKET_91_UNIVERSE.length,
      currentScoreRows: rows.length,
      missingOriginalCount: missingOriginal.length,
      duplicateOriginalCount: duplicateOriginalSymbols.length,
      extraNonOriginalCount: extraNonOriginalRows.length,
      duplicateExtraCount: duplicateExtraSymbols.length,
      coveragePass,
      duplicateOriginalPass,
      originalUniverseIntegrityPass,
    },
    missingOriginal,
    duplicateOriginalSymbols,
    duplicateExtraSymbols,
    extraNonOriginalRows: extraNonOriginalRows.map((row) => ({ symbol: row.symbol, batch: row.batch, score: row.score, status: row.status })),
    nextAction: originalUniverseIntegrityPass
      ? "Proceed to Evidence Pilot v2. Do not scale to top 10 until the pilot passes."
      : "Fix missing or duplicate original symbols before Evidence Pilot."
  };
}

module.exports = { getMarket91ReconciliationIntegrity };
