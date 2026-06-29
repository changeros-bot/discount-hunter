import { ASSET_REGISTRY, ASSET_STATUS, ENGINES, STRATEGIES } from "./v17-asset-registry";
import { buildV17Decisions } from "./v17-decision-engine";
import { getTriggeredTiers, getSignal, calculateDiscountPct } from "./v17-discount-model";
import { getV17StorageStatus, V17_STORAGE_KEYS } from "./v17-storage";

function pass(name, details = {}) {
  return { name, ok: true, details };
}

function fail(name, message, details = {}) {
  return { name, ok: false, message, details };
}

function assert(condition, name, message, details = {}) {
  return condition ? pass(name, details) : fail(name, message, details);
}

export function runV17SelfTest() {
  const tests = [];
  const storage = getV17StorageStatus();

  tests.push(assert(
    ASSET_REGISTRY.length > 0,
    "asset_registry_not_empty",
    "Asset Registry must contain at least one asset.",
    { count: ASSET_REGISTRY.length }
  ));

  const btc = ASSET_REGISTRY.find((asset) => asset.symbol === "BTC");
  tests.push(assert(
    Boolean(btc),
    "btc_registered",
    "BTC must be registered in V17."
  ));

  tests.push(assert(
    btc?.discountModel === "btc_discount_v1" && btc?.strategy === STRATEGIES.DCA_DISCOUNT,
    "btc_uses_dedicated_model",
    "BTC must use btc_discount_v1 and DCA + Discount strategy.",
    { btc }
  ));

  const invalidAssets = ASSET_REGISTRY.filter((asset) => !asset.symbol || !asset.engine || !asset.strategy || !asset.status || !asset.reviewFrequency || !asset.reEvaluateTrigger);
  tests.push(assert(
    invalidAssets.length === 0,
    "asset_required_fields_complete",
    "Every asset must include symbol, engine, strategy, status, reviewFrequency, and reEvaluateTrigger.",
    { invalidAssets: invalidAssets.map((asset) => asset.symbol || asset.name) }
  ));

  const invalidEngines = ASSET_REGISTRY.filter((asset) => !Object.values(ENGINES).includes(asset.engine));
  tests.push(assert(
    invalidEngines.length === 0,
    "engine_values_valid",
    "All assets must use approved engine constants.",
    { invalidEngines: invalidEngines.map((asset) => asset.symbol) }
  ));

  const invalidStrategies = ASSET_REGISTRY.filter((asset) => !Object.values(STRATEGIES).includes(asset.strategy));
  tests.push(assert(
    invalidStrategies.length === 0,
    "strategy_values_valid",
    "All assets must use approved strategy constants.",
    { invalidStrategies: invalidStrategies.map((asset) => asset.symbol) }
  ));

  const investmentKey = V17_STORAGE_KEYS.INVESTMENT_LEDGER;
  const tacticalKey = V17_STORAGE_KEYS.TACTICAL_LEDGER;
  tests.push(assert(
    investmentKey !== tacticalKey,
    "ledger_keys_separated",
    "Investment and Tactical ledgers must use different durable storage keys.",
    { investmentKey, tacticalKey }
  ));

  const discount = calculateDiscountPct({ price: 80, anchorHigh: 100 });
  tests.push(assert(
    discount === -20,
    "discount_calculation_basic",
    "Discount calculation must return -20 for price 80 and high 100.",
    { discount }
  ));

  const triggered = getTriggeredTiers({ discount: -30, rules: [-10, -20, -30, -45] });
  tests.push(assert(
    triggered.length === 3 && triggered[2]?.tier === "D3",
    "tier_triggering_basic",
    "A -30% discount should trigger D1, D2, and D3 for [-10,-20,-30,-45].",
    { triggered }
  ));

  const signal = getSignal({ discount: -30, rules: [-10, -20, -30, -45], amounts: [5, 10, 15, 20] });
  tests.push(assert(
    signal.level === 3 && signal.tier === "D3" && signal.amount === "15U",
    "signal_deepest_tier_basic",
    "Signal should select the deepest triggered tier.",
    { signal }
  ));

  const sample = buildV17Decisions({
    assets: ASSET_REGISTRY.filter((asset) => asset.symbol === "BTC" || asset.symbol === "00631L"),
    markets: {
      BTC: { symbol: "BTC", price: 70000, cycleHigh: 100000 }
    },
    now: "2026-06-29T00:00:00.000Z"
  });

  const btcDecision = sample.decisions.find((decision) => decision.symbol === "BTC");
  tests.push(assert(
    btcDecision?.readOnly === true && btcDecision?.ruleMigrationStatus === "blocked_until_universe_freeze_approved",
    "decision_engine_read_only_guardrail",
    "V17 decisions must remain read-only and rule migration must be blocked before Universe Freeze approval.",
    { btcDecision }
  ));

  const tacticalDecision = sample.decisions.find((decision) => decision.symbol === "00631L");
  tests.push(assert(
    tacticalDecision?.executable === false && tacticalDecision?.context?.ledgerKey === tacticalKey,
    "tactical_engine_not_executable_in_sprint1",
    "Tactical Engine must be registered but non-executable in V17 Sprint 1.",
    { tacticalDecision }
  ));

  const watchExecutable = buildV17Decisions({
    assets: ASSET_REGISTRY.filter((asset) => asset.status === ASSET_STATUS.WATCH),
    markets: Object.fromEntries(ASSET_REGISTRY.filter((asset) => asset.status === ASSET_STATUS.WATCH).map((asset) => [asset.symbol, { symbol: asset.symbol, price: 50, high: 100, cycleHigh: 100 }]))
  }).decisions.filter((decision) => decision.executable);

  tests.push(assert(
    watchExecutable.length === 0,
    "watch_assets_not_executable",
    "Watch assets must not become executable before Universe Freeze approval.",
    { watchExecutable }
  ));

  const passed = tests.filter((test) => test.ok).length;
  const failed = tests.length - passed;

  return {
    ok: failed === 0,
    version: "v17",
    mode: "self_test",
    storage,
    summary: { total: tests.length, passed, failed },
    tests
  };
}
