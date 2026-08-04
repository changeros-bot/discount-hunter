import { getAssetRegistry, ASSET_STATUS } from "./v17-asset-registry";
import { AUTO_TRADE_WHITELIST } from "./v17-risk-gate";
import { WRITABLE_AUTO_MODES_V1 } from "./v17-auto-mode";
import { getAutomationSecurityStatus } from "./v17-automation-security";
import { canTransitionOrder, requiresOrderReconciliation } from "./v17-order-state";

function sameStrings(left, right) {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

function test(name, ok, detail) {
  return { name, ok: Boolean(ok), detail };
}

export function runAutomationStaticSelfTest() {
  const registry = getAssetRegistry();
  const eligible = registry
    .filter((asset) => asset.status === ASSET_STATUS.QUALIFIED && asset.automation?.draftEligible === true)
    .map((asset) => asset.symbol);
  const unsafeWatch = registry.filter(
    (asset) => asset.status !== ASSET_STATUS.QUALIFIED && asset.automation?.draftEligible === true
  );
  const realRoutes = registry.filter((asset) => asset.automation?.route === "binance_spot");
  const security = getAutomationSecurityStatus();

  const tests = [
    test("registry_is_automation_source", sameStrings(eligible, AUTO_TRADE_WHITELIST), { eligible, whitelist: AUTO_TRADE_WHITELIST }),
    test("watch_assets_never_auto_eligible", unsafeWatch.length === 0, unsafeWatch.map((asset) => asset.symbol)),
    test("spcx_paused", registry.find((asset) => asset.symbol === "SPCXon")?.automation?.draftEligible === false, "SPCX requires reliable history."),
    test("rklb_watch_blocked", registry.find((asset) => asset.symbol === "RKLBon")?.automation?.draftEligible === false, "RKLB is Watch."),
    test("btc_only_canary_route", realRoutes.length === 1 && realRoutes[0].symbol === "BTC" && realRoutes[0].automation?.canaryEligible === true, realRoutes.map((asset) => asset.symbol)),
    test("real_modes_locked", !WRITABLE_AUTO_MODES_V1.includes("SEMI_AUTO") && !WRITABLE_AUTO_MODES_V1.includes("AUTO"), WRITABLE_AUTO_MODES_V1),
    test("unknown_order_requires_reconciliation", requiresOrderReconciliation("UNKNOWN"), "UNKNOWN must be queried before retry."),
    test("unsafe_order_transition_rejected", !canTransitionOrder("FILLED", "SUBMITTING"), "A filled order cannot be resubmitted."),
    test("real_orders_disabled", security.realOrdersEnabled === false, security),
    test("writes_fail_closed", security.failClosed === true && security.writeAuthRequired === true, security),
  ];

  return {
    ok: tests.every((item) => item.ok),
    summary: {
      total: tests.length,
      passed: tests.filter((item) => item.ok).length,
      failed: tests.filter((item) => !item.ok).length,
    },
    security,
    tests,
  };
}
