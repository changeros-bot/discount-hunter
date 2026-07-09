const { getFirstBatch } = require("./v17-market-91-first-batch");
const { getSecondBatch } = require("./v17-market-91-second-batch");

function flattenBatch(batchName, payload) {
  return (payload.rows || []).map((row) => ({
    batch: batchName,
    symbol: row.symbol,
    score: row.score,
    status: row.status,
    tag: row.tag,
    blocker: row.blocker || "",
    confidence: row.confidence || "",
    permissions: row.permissions || { buy: false, dca: false, semiAuto: false, whitelist: false },
  }));
}

function classify(row) {
  if (row.status.includes("FORMAL_OBSERVATION")) return "formalObservationCandidateOnly";
  if (row.status.includes("RESERVE")) return "reserveSecondReview";
  if (row.status.includes("RESEARCH_POOL")) return "researchPoolOnly";
  if (row.status.includes("BLOCK")) return "blocked";
  if (row.status.includes("DRAFT") || row.status.includes("PROVISIONAL") || row.status.includes("PENDING")) return "pendingVerification";
  return "other";
}

function getFairScoreReport() {
  const first = getFirstBatch();
  const second = getSecondBatch();
  const rows = [
    ...flattenBatch("first", first),
    ...flattenBatch("second", second),
  ].sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  const groups = rows.reduce((acc, row) => {
    const key = classify(row);
    acc[key] = acc[key] || [];
    acc[key].push(row);
    return acc;
  }, {});
  return {
    version: "v17-market-91-fair-score-report-v1-first-second-batch",
    policy: "100_point_screen_observation_only_18_point_quality_gate_required_for_permissions",
    safetyBoundary: [
      "First and second batch scores are not a buy list.",
      "Scores are not DCA permission.",
      "Scores are not semi-auto permission.",
      "Scores are not whitelist permission.",
      "100-point screen only decides formal observation candidate status.",
      "18-point Quality Gate is still required before any trading permission.",
    ],
    includedBatches: [
      { name: "first", version: first.version, count: first.summary.total },
      { name: "second", version: second.version, count: second.summary.total },
    ],
    summary: {
      total: rows.length,
      formalObservationCandidateOnly: groups.formalObservationCandidateOnly?.length || 0,
      reserveSecondReview: groups.reserveSecondReview?.length || 0,
      researchPoolOnly: groups.researchPoolOnly?.length || 0,
      blocked: groups.blocked?.length || 0,
      pendingVerification: groups.pendingVerification?.length || 0,
      topScore: rows[0]?.score || null,
      topSymbol: rows[0]?.symbol || null,
    },
    rows,
    groups,
  };
}

module.exports = { getFairScoreReport };
