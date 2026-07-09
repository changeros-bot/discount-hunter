const { getQualityGateQueue } = require("./v17-market-91-quality-gate-queue");
const { getQualityGateDrafts } = require("./v17-market-91-quality-gate-drafts");
const { getEvidencePilotV2 } = require("./v17-market-91-evidence-pilot-v2");

function getEvidenceNextPriority() {
  const queue = getQualityGateQueue();
  const drafts = getQualityGateDrafts();
  const pilot = getEvidencePilotV2();
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
    version: "v17-market-91-evidence-next-priority-v2-pilot-before-scale",
    policy: "priority_map_only_do_not_scale_until_pilot_passes_no_buy_no_dca_no_semi_auto_no_whitelist",
    priorityMethod: [
      "Queue priority is not pure 100-point score order.",
      "It first ranks structural importance and evidence-test value, then considers fair score and draft 18-point score.",
      "Positive controls test whether strong names can pass without automatic permission.",
      "Negative or blocker controls, especially ORCL, test whether the gate can refuse attractive narratives with weak financial evidence.",
    ],
    pilotFirst: {
      required: true,
      pilotVersion: pilot.version,
      pilotNames: pilot.pilotNames.map((x) => ({ symbol: x.symbol, role: x.role, purpose: x.purpose })),
      scaleRule: pilot.scaleRule,
    },
    summary: {
      queueEligible: queue.summary.eligible,
      draftCount: drafts.summary.total,
      topPriorityCount: top.length,
      nextStep: "Run Evidence Pilot v2 first. Do not process the top 10 in bulk until the pilot passes.",
    },
    topAfterPilot,
    get topAfterPilot() { return top; },
    top,
  };
}

module.exports = { getEvidenceNextPriority };
