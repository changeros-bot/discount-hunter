const { getQualityGateQueue } = require("./v17-market-91-quality-gate-queue");
const { getQualityGateDrafts } = require("./v17-market-91-quality-gate-drafts");

function getEvidenceNextPriority() {
  const queue = getQualityGateQueue();
  const drafts = getQualityGateDrafts();
  const draftMap = new Map((drafts.rows || []).map((row) => [row.symbol, row]));
  const top = (queue.eligible || []).slice(0, 10).map((item, index) => {
    const draft = draftMap.get(item.symbol);
    return {
      rank: index + 1,
      symbol: item.symbol,
      fairScore: item.fairScore,
      draft18Score: draft?.totalScore || null,
      sourceBatch: item.sourceBatch,
      mainRisk: item.mainRisk,
      preliminaryGateBias: item.preliminaryGateBias,
      nextRequiredEvidence: item.nextRequiredEvidence,
      permission: { buy: false, dca: false, semiAuto: false, whitelist: false },
    };
  });
  return {
    version: "v17-market-91-evidence-next-priority-v1-top10-official-verification-plan",
    policy: "evidence_priority_only_no_buy_no_dca_no_semi_auto_no_whitelist",
    summary: {
      queueEligible: queue.summary.eligible,
      draftCount: drafts.summary.total,
      topPriorityCount: top.length,
      nextStep: "Run official evidence extraction for top-priority names before any Permission Review.",
    },
    top,
  };
}

module.exports = { getEvidenceNextPriority };
