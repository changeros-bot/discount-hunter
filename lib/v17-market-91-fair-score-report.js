const { getFirstBatch } = require("./v17-market-91-first-batch");
const { getSecondBatch } = require("./v17-market-91-second-batch");
const { getThirdBatch } = require("./v17-market-91-third-batch");
const { getFourthBatch } = require("./v17-market-91-fourth-batch");
const { getFifthBatch } = require("./v17-market-91-fifth-batch");
const { getSixthBatch } = require("./v17-market-91-sixth-batch");
const { getSeventhBatch } = require("./v17-market-91-seventh-batch");
const { getEighthBatch } = require("./v17-market-91-eighth-batch");
const { getNinthBatch } = require("./v17-market-91-ninth-batch");
const { getTenthBatch } = require("./v17-market-91-tenth-batch");
const { getEleventhBatch } = require("./v17-market-91-eleventh-batch");
const { getTwelfthBatch } = require("./v17-market-91-twelfth-batch");
const { getThirteenthBatch } = require("./v17-market-91-thirteenth-batch");
const { getFourteenthBatch } = require("./v17-market-91-fourteenth-batch");
const { getFifteenthBatch } = require("./v17-market-91-fifteenth-batch");
const { getSixteenthBatch } = require("./v17-market-91-sixteenth-batch");
const { getSeventeenthBatch } = require("./v17-market-91-seventeenth-batch");
const { getEighteenthBatch } = require("./v17-market-91-eighteenth-batch");
const { getNineteenthBatch } = require("./v17-market-91-nineteenth-batch");
const { getOriginalMissingCompletion } = require("./v17-market-91-original-missing-completion");

function flattenBatch(batchName, payload) {
  return (payload.rows || []).map((row) => ({ batch: batchName, symbol: row.symbol, score: row.score, status: row.status, tag: row.tag, blocker: row.blocker || "", confidence: row.confidence || "", permissions: row.permissions || { buy: false, dca: false, semiAuto: false, whitelist: false } }));
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
  const first = getFirstBatch(), second = getSecondBatch(), third = getThirdBatch(), fourth = getFourthBatch(), fifth = getFifthBatch(), sixth = getSixthBatch(), seventh = getSeventhBatch(), eighth = getEighthBatch(), ninth = getNinthBatch(), tenth = getTenthBatch(), eleventh = getEleventhBatch(), twelfth = getTwelfthBatch(), thirteenth = getThirteenthBatch(), fourteenth = getFourteenthBatch(), fifteenth = getFifteenthBatch(), sixteenth = getSixteenthBatch(), seventeenth = getSeventeenthBatch(), eighteenth = getEighteenthBatch(), nineteenth = getNineteenthBatch(), originalMissing = getOriginalMissingCompletion();
  const rows = [
    ...flattenBatch("first", first), ...flattenBatch("second", second), ...flattenBatch("third", third), ...flattenBatch("fourth", fourth), ...flattenBatch("fifth", fifth), ...flattenBatch("sixth", sixth), ...flattenBatch("seventh", seventh), ...flattenBatch("eighth", eighth), ...flattenBatch("ninth", ninth), ...flattenBatch("tenth", tenth), ...flattenBatch("eleventh", eleventh), ...flattenBatch("twelfth", twelfth), ...flattenBatch("thirteenth", thirteenth), ...flattenBatch("fourteenth", fourteenth), ...flattenBatch("fifteenth", fifteenth), ...flattenBatch("sixteenth", sixteenth), ...flattenBatch("seventeenth", seventeenth), ...flattenBatch("eighteenth", eighteenth), ...flattenBatch("nineteenth", nineteenth), ...flattenBatch("original_missing_completion", originalMissing),
  ].sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  const groups = rows.reduce((acc, row) => { const key = classify(row); acc[key] = acc[key] || []; acc[key].push(row); return acc; }, {});
  return {
    version: "v17-market-91-fair-score-report-v20-original-universe-completion-added",
    policy: "100_point_screen_observation_only_18_point_quality_gate_required_for_permissions",
    correctionNotice: "Original Market 91 missing symbols have been added as original_missing_completion rows. Extra non-original rows remain separated by reconciliation audit and must not be treated as original-universe members.",
    safetyBoundary: ["This report is not a buy list.", "Scores are not DCA permission.", "Scores are not semi-auto permission.", "Scores are not whitelist permission.", "100-point screen only decides formal observation candidate status.", "18-point Quality Gate is still required before any trading permission.", "Use reconciliation audit to distinguish original-universe coverage from extra expansion rows."],
    includedBatches: [
      { name: "first", version: first.version, count: first.summary.total }, { name: "second", version: second.version, count: second.summary.total }, { name: "third", version: third.version, count: third.summary.total }, { name: "fourth", version: fourth.version, count: fourth.summary.total }, { name: "fifth", version: fifth.version, count: fifth.summary.total }, { name: "sixth", version: sixth.version, count: sixth.summary.total }, { name: "seventh", version: seventh.version, count: seventh.summary.total }, { name: "eighth", version: eighth.version, count: eighth.summary.total }, { name: "ninth", version: ninth.version, count: ninth.summary.total }, { name: "tenth", version: tenth.version, count: tenth.summary.total }, { name: "eleventh", version: eleventh.version, count: eleventh.summary.total }, { name: "twelfth", version: twelfth.version, count: twelfth.summary.total }, { name: "thirteenth", version: thirteenth.version, count: thirteenth.summary.total }, { name: "fourteenth", version: fourteenth.version, count: fourteenth.summary.total }, { name: "fifteenth", version: fifteenth.version, count: fifteenth.summary.total }, { name: "sixteenth", version: sixteenth.version, count: sixteenth.summary.total }, { name: "seventeenth", version: seventeenth.version, count: seventeenth.summary.total }, { name: "eighteenth", version: eighteenth.version, count: eighteenth.summary.total }, { name: "nineteenth", version: nineteenth.version, count: nineteenth.summary.total }, { name: "original_missing_completion", version: originalMissing.version, count: originalMissing.summary.total },
    ],
    summary: { totalRows: rows.length, originalMissingCompletionRows: originalMissing.summary.total, formalObservationCandidateOnly: groups.formalObservationCandidateOnly?.length || 0, reserveSecondReview: groups.reserveSecondReview?.length || 0, researchPoolOnly: groups.researchPoolOnly?.length || 0, blocked: groups.blocked?.length || 0, pendingVerification: groups.pendingVerification?.length || 0, topScore: rows[0]?.score || null, topSymbol: rows[0]?.symbol || null, originalUniverseCoverageFixed: true, reconciliationRequiredForExtraRows: true },
    rows,
    groups,
  };
}
module.exports = { getFairScoreReport };
