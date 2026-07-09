const { getEvidencePilotV2 } = require("./v17-market-91-evidence-pilot-v2");
const { getQualityGateDrafts } = require("./v17-market-91-quality-gate-drafts");
const { getEvidencePilotOfficialExtractionV1 } = require("./v17-market-91-evidence-pilot-official-extraction-v1");
const { getNvdaEvidenceGapDiagnosis } = require("./v17-market-91-nvda-evidence-gap-diagnosis");

function getEvidencePilotScoreLockDryRun() {
  const pilot = getEvidencePilotV2();
  const drafts = getQualityGateDrafts();
  const extraction = getEvidencePilotOfficialExtractionV1();
  const nvdaGap = getNvdaEvidenceGapDiagnosis();
  const draftMap = new Map((drafts.rows || []).map((row) => [row.symbol, row]));
  const evidenceMap = new Map((extraction.rows || []).map((row) => [row.symbol, row]));
  const rows = pilot.pilotNames.map((item) => {
    const draft = draftMap.get(item.symbol);
    const evidence = evidenceMap.get(item.symbol);
    const readyForReview = evidence?.scoreLockReadiness === "READY_FOR_SCORE_LOCK_REVIEW_NOT_LOCKED";
    const nvdaDiagnosis = item.symbol === "NVDA" ? {
      gapDiagnosisVersion: nvdaGap.version,
      gapConclusion: nvdaGap.conclusion,
      scoreLockImplication: nvdaGap.rubricAdjustmentRecommendation.scoreLockImplication,
    } : null;
    return {
      symbol: item.symbol,
      role: item.role,
      preEvidenceDraftScore: draft?.totalScore || null,
      evidenceStatus: evidence?.evidenceStatus || "NOT_STARTED",
      sourceTier: evidence?.sourceTier || "none",
      scoreLockStatus: readyForReview ? "READY_FOR_SCORE_LOCK_REVIEW_WITH_QUALITATIVE_BLOCKERS" : "NOT_LOCKED_OFFICIAL_EVIDENCE_REQUIRED",
      finalScore: null,
      finalVerdict: readyForReview ? "EVIDENCE_READY_FOR_REVIEW_BUT_NOT_LOCKED_QUALITATIVE_BLOCKERS_OPEN" : "BLOCKED_UNTIL_OFFICIAL_EVIDENCE",
      gapDiagnosis: nvdaDiagnosis,
      expectedFailureMode: item.expectedFailureMode,
      permission: { buy: false, dca: false, semiAuto: false, whitelist: false },
    };
  });
  return {
    version: "v17-market-91-evidence-pilot-score-lock-dry-run-v3-nvda-gap-diagnosis-linked",
    policy: "score_lock_dry_run_only_no_buy_no_dca_no_semi_auto_no_whitelist",
    purpose: "Connect official evidence extraction and NVDA gap diagnosis to Final Score Lock readiness without granting permissions.",
    hardRule: "No final score can be locked until official evidence is extracted and reviewed; readiness is not a lock. Qualitative blockers can remain open while score-lock review begins.",
    rows,
  };
}

module.exports = { getEvidencePilotScoreLockDryRun };
