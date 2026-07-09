const { getEvidencePilotScoreLockDryRun } = require("./v17-market-91-evidence-pilot-score-lock-dry-run");

function getEvidencePilotPermissionDryRun() {
  const scoreLock = getEvidencePilotScoreLockDryRun();
  const rows = scoreLock.rows.map((row) => ({
    symbol: row.symbol,
    role: row.role,
    evidenceStatus: row.evidenceStatus,
    scoreLockStatus: row.scoreLockStatus,
    permissionReviewStatus: "NOT_ELIGIBLE_SCORE_NOT_LOCKED",
    buy: false,
    dca: false,
    semiAuto: false,
    whitelist: false,
    reason: "Permission Review cannot start until official evidence is verified and Final Score Lock is complete.",
  }));
  return {
    version: "v17-market-91-evidence-pilot-permission-dry-run-v1",
    policy: "permission_dry_run_only_no_buy_no_dca_no_semi_auto_no_whitelist",
    principle: "Even a strong Quality Gate draft pass does not create trading permission.",
    rows,
    summary: {
      total: rows.length,
      buyAllowed: rows.filter((x) => x.buy).length,
      dcaAllowed: rows.filter((x) => x.dca).length,
      semiAutoAllowed: rows.filter((x) => x.semiAuto).length,
      whitelistAllowed: rows.filter((x) => x.whitelist).length,
    },
  };
}

module.exports = { getEvidencePilotPermissionDryRun };
