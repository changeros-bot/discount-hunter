const { getEvidencePilotV2 } = require("./v17-market-91-evidence-pilot-v2");
const { getQualityGateDrafts } = require("./v17-market-91-quality-gate-drafts");

function getEvidencePilotScoreLockDryRun() {
  const pilot = getEvidencePilotV2();
  const drafts = getQualityGateDrafts();
  const draftMap = new Map((drafts.rows || []).map((row) => [row.symbol, row]));
  const rows = pilot.pilotNames.map((item) => {
    const draft = draftMap.get(item.symbol);
    return {
      symbol: item.symbol,
      role: item.role,
      preEvidenceDraftScore: draft?.totalScore || null,
      scoreLockStatus: "NOT_LOCKED_OFFICIAL_EVIDENCE_REQUIRED",
      evidenceStatus: "NOT_STARTED",
      finalScore: null,
      finalVerdict: "BLOCKED_UNTIL_OFFICIAL_EVIDENCE",
      expectedFailureMode: item.expectedFailureMode,
      permission: { buy: false, dca: false, semiAuto: false, whitelist: false },
    };
  });
  return {
    version: "v17-market-91-evidence-pilot-score-lock-dry-run-v1",
    policy: "score_lock_dry_run_only_no_buy_no_dca_no_semi_auto_no_whitelist",
    purpose: "Prepare Final Score Lock structure for the four-name pilot without pretending official evidence has been verified.",
    hardRule: "No final score can be locked until official evidence is extracted and reviewed.",
    rows,
  };
}

module.exports = { getEvidencePilotScoreLockDryRun };
