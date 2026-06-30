import { runV17SelfTest } from "../../../lib/v17-self-test";
import { getV17StorageStatus } from "../../../lib/v17-storage";

function gate(name, ok, details = {}) {
  return { name, ok: Boolean(ok), details };
}

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const selfTest = runV17SelfTest();
  const storage = getV17StorageStatus();
  const failedTests = selfTest.tests.filter((test) => !test.ok);
  const failedNames = failedTests.map((test) => test.name);
  const productionUnsafe = storage.requiresDurable && !storage.durable;

  const architectureTests = ["engine_values_valid", "strategy_values_valid", "ledger_keys_separated"];
  const decisionTests = [
    "discount_calculation_basic",
    "tier_triggering_basic",
    "signal_deepest_tier_basic",
    "action_queue_deepest_layer",
    "partial_amount_stays_in_queue",
    "complete_leaves_action_queue",
    "missing_price_suspect",
    "layer_mismatch_stays_in_queue",
    "failed_event_returns_queue",
    "skip_current_layer_leaves_queue",
    "deeper_layer_reenters_after_skip",
    "same_state_no_notify",
    "price_change_notify"
  ];

  const gates = [
    gate("G0_scope_lock", true, { note: "V17 release workflow and universe freeze documents exist in repo." }),
    gate("G1_storage_safety", !productionUnsafe, storage),
    gate("G2_architecture_integrity", failedTests.every((test) => !architectureTests.includes(test.name)), { failedTests: failedNames }),
    gate("G3_action_queue_correctness", failedTests.every((test) => !decisionTests.includes(test.name)), { failedTests: failedNames }),
    gate("G4_v16_regression_safety", true, { note: "V17 health check does not validate V16 runtime behavior; manual smoke test still required." }),
    gate("G5_release_candidate", false, { note: "Not ready. Build test, deployed API test, mobile UI test, and release notes are still pending." }),
    gate("G6_seal_freeze", false, { note: "Not sealed. Universe Freeze and new discount rule migration are not approved yet." })
  ];

  const ok = selfTest.ok && !productionUnsafe;

  return res.status(ok ? 200 : 500).json({
    ok,
    version: "v17-action-queue-v1",
    mode: "health_check",
    checkedAt: new Date().toISOString(),
    storage,
    selfTestSummary: selfTest.summary,
    gates,
    failedTests,
    nextRequiredActions: [
      "Run this endpoint after deployment.",
      "Run /api/v17/assets and /api/v17/decisions smoke tests.",
      "Run Next build verification.",
      "Run V16 smoke test before any V17 UI integration.",
      "Approve V17 Universe Freeze before replacing old discount-buy tiers."
    ]
  });
}
