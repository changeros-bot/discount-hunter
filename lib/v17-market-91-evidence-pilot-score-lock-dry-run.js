const { getEvidencePilotV2 } = require("./v17-market-91-evidence-pilot-v2");
const { getQualityGateDrafts } = require("./v17-market-91-quality-gate-drafts");
const { getEvidencePilotOfficialExtractionV1 } = require("./v17-market-91-evidence-pilot-official-extraction-v1");

function getEvidencePilotScoreLockDryRun() {
  const pilot = getEvidencePilotV2();
  const drafts = getQualityGateDrafts();
  const extraction = getEvidencePilotOfficialExtractionV1();
  const draftMap = new Map((drafts.rows || []).map((row) => [row.symbol, row]));
  const evidenceMap = new Map((extraction.rows || []).map((row) => [row.symbol, row]));
  const rows = pilot.pilotNames.map((item) => {
    const draft = draftMap.get(item.symbol);
    const evidence = evidenceMap.get(item.symbol);
    const readyForReview = evidence?.scoreLockReadiness === "READY_FOR_SCORE_LOCK_REVIEW_NOT_LOCKED";
    return {
      symbol: item.symbol,
      role: item.role,
      preEvidenceDraftScore: draft?.totalScore || null,
      evidenceStatus: evidence?.evidenceStatus || "NOT_STARTED",
      sourceTier: evidence?.sourceTier || "none",
      scoreLockStatus: readyForReview ? "READY_FOR_SCORE_LOCK_REVIEW_NOT_LOCKED" : "NOT_LOCKED_OFFICIAL_EVIDENCE_REQUIRED",
      finalScore: null,
      finalVerdict: readyForReview ? "EVIDENCE_READY_FOR_REVIEW_BUT_NOT_LOCKED" : "BLOCKED_UNTIL_OFFICIAL_EVIDENCE",
      expectedFailureMode: item.expectedFailureMode,
      permission: { buy: false, dca: false, semiAuto: false, whitelist: false },
    };
  });
  return {
    version: "v17-market-91-evidence-pilot-score-lock-dry-run-v2-official-extraction-linked",
    policy: "score_lock_dry_run_only_no_buy_no_dca_no_semi_auto_no_whitelist",
    purpose: "Connect official evidence extraction to Final Score Lock readiness without granting permissions.",
    hardRule: "No final score can be locked until official evidence is extracted and reviewed; readiness is not a lock.",
    rows,
  };
}

module.exports = { getEvidencePilotScoreLockDryRun };
