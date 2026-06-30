import { ASSET_REGISTRY, ENGINES, STRATEGIES } from "./v17-asset-registry";
import { ACTION_STATUS, buildV17Decisions } from "./v17-decision-engine";
import { getTriggeredTiers, getSignal, calculateDiscountPct } from "./v17-discount-model";
import { getV17StorageStatus, V17_STORAGE_KEYS } from "./v17-storage";

function pass(name, details = {}) { return { name, ok: true, details }; }
function fail(name, message, details = {}) { return { name, ok: false, message, details }; }
function assert(condition, name, message, details = {}) { return condition ? pass(name, details) : fail(name, message, details); }

const btcAsset = {
  symbol: "BTC",
  name: "Bitcoin",
  engine: ENGINES.INVESTMENT,
  strategy: STRATEGIES.DCA_DISCOUNT,
  status: "qualified",
  rules: [-10, -20, -30, -45],
  amounts: [5, 10, 15, 20],
  discountModel: "btc_discount_v1"
};

function btcDecision(result) { return result.decisions.find((decision) => decision.symbol === "BTC"); }

export function runV17SelfTest() {
  const tests = [];
  const storage = getV17StorageStatus();

  tests.push(assert(ASSET_REGISTRY.length > 0, "asset_registry_not_empty", "Asset Registry must contain at least one asset.", { count: ASSET_REGISTRY.length }));

  const btc = ASSET_REGISTRY.find((asset) => asset.symbol === "BTC");
  tests.push(assert(Boolean(btc), "btc_registered", "BTC must be registered in V17."));
  tests.push(assert(btc?.discountModel === "btc_discount_v1" && btc?.strategy === STRATEGIES.DCA_DISCOUNT, "btc_uses_dedicated_model", "BTC must use btc_discount_v1 and DCA + Discount strategy.", { btc }));

  const invalidAssets = ASSET_REGISTRY.filter((asset) => !asset.symbol || !asset.engine || !asset.strategy || !asset.status || !asset.reviewFrequency || !asset.reEvaluateTrigger);
  tests.push(assert(invalidAssets.length === 0, "asset_required_fields_complete", "Every asset must include required registry fields.", { invalidAssets: invalidAssets.map((asset) => asset.symbol || asset.name) }));

  const invalidEngines = ASSET_REGISTRY.filter((asset) => !Object.values(ENGINES).includes(asset.engine));
  tests.push(assert(invalidEngines.length === 0, "engine_values_valid", "All assets must use approved engine constants.", { invalidEngines: invalidEngines.map((asset) => asset.symbol) }));

  const invalidStrategies = ASSET_REGISTRY.filter((asset) => !Object.values(STRATEGIES).includes(asset.strategy));
  tests.push(assert(invalidStrategies.length === 0, "strategy_values_valid", "All assets must use approved strategy constants.", { invalidStrategies: invalidStrategies.map((asset) => asset.symbol) }));

  tests.push(assert(V17_STORAGE_KEYS.INVESTMENT_LEDGER !== V17_STORAGE_KEYS.TACTICAL_LEDGER, "ledger_keys_separated", "Investment and Tactical ledgers must use different durable storage keys.", { investmentKey: V17_STORAGE_KEYS.INVESTMENT_LEDGER, tacticalKey: V17_STORAGE_KEYS.TACTICAL_LEDGER }));

  const discount = calculateDiscountPct({ price: 80, anchorHigh: 100 });
  tests.push(assert(discount === -20, "discount_calculation_basic", "Discount calculation must return -20 for price 80 and high 100.", { discount }));

  const triggered = getTriggeredTiers({ discount: -30, rules: [-10, -20, -30, -45] });
  tests.push(assert(triggered.length === 3 && triggered[2]?.tier === "D3", "tier_triggering_basic", "A -30% discount should trigger D3 as deepest active layer.", { triggered }));

  const signal = getSignal({ discount: -30, rules: [-10, -20, -30, -45], amounts: [5, 10, 15, 20] });
  tests.push(assert(signal.level === 3 && signal.tier === "D3" && signal.amount === "15U", "signal_deepest_tier_basic", "Signal should select the deepest triggered tier.", { signal }));

  const queued = buildV17Decisions({ assets: [btcAsset], markets: { BTC: { symbol: "BTC", price: 70000, cycleHigh: 100000 } }, now: "2026-06-29T00:00:00.000Z" });
  tests.push(assert(btcDecision(queued)?.status === ACTION_STATUS.QUEUED && btcDecision(queued)?.tier === "D3" && queued.actionCount === 1, "action_queue_deepest_layer", "BTC at -30% must queue only D3, not D1/D2/D3 separately.", { decision: btcDecision(queued), actionCount: queued.actionCount }));

  const partial = buildV17Decisions({ assets: [btcAsset], markets: { BTC: { symbol: "BTC", price: 70000, cycleHigh: 100000 } }, events: [{ symbol: "BTC", price: 70000, amount: 5 }], now: "2026-06-29T00:00:00.000Z" });
  tests.push(assert(btcDecision(partial)?.status === ACTION_STATUS.PARTIAL && partial.actionCount === 1, "partial_amount_stays_in_queue", "Partial amount must remain in action queue.", { decision: btcDecision(partial), actionCount: partial.actionCount }));

  const complete = buildV17Decisions({ assets: [btcAsset], markets: { BTC: { symbol: "BTC", price: 70000, cycleHigh: 100000 } }, events: [{ symbol: "BTC", price: 70000, amount: 15 }], now: "2026-06-29T00:00:00.000Z" });
  tests.push(assert(btcDecision(complete)?.status === ACTION_STATUS.COMPLETE && complete.actionCount === 0, "complete_leaves_action_queue", "Completed amount must leave action queue.", { decision: btcDecision(complete), actionCount: complete.actionCount }));

  const suspect = buildV17Decisions({ assets: [btcAsset], markets: { BTC: { symbol: "BTC", price: 70000, cycleHigh: 100000 } }, events: [{ symbol: "BTC", amount: 5 }], now: "2026-06-29T00:00:00.000Z" });
  tests.push(assert(btcDecision(suspect)?.status === ACTION_STATUS.SUSPECT && suspect.actionCount === 1, "missing_price_suspect", "Event with amount but missing price should be suspect and stay in queue.", { decision: btcDecision(suspect), actionCount: suspect.actionCount }));

  const mismatch = buildV17Decisions({ assets: [btcAsset], markets: { BTC: { symbol: "BTC", price: 70000, cycleHigh: 100000 } }, events: [{ symbol: "BTC", price: 90000, amount: 15 }], now: "2026-06-29T00:00:00.000Z" });
  tests.push(assert(btcDecision(mismatch)?.status === ACTION_STATUS.MISMATCH && mismatch.actionCount === 1, "layer_mismatch_stays_in_queue", "Event that does not match current layer should be mismatch and stay in queue.", { decision: btcDecision(mismatch), actionCount: mismatch.actionCount }));

  const failedEvent = buildV17Decisions({ assets: [btcAsset], markets: { BTC: { symbol: "BTC", price: 70000, cycleHigh: 100000 } }, events: [{ symbol: "BTC", status: "failed", price: 70000, amount: 15 }], now: "2026-06-29T00:00:00.000Z" });
  tests.push(assert(btcDecision(failedEvent)?.status === ACTION_STATUS.FAILED && failedEvent.actionCount === 1, "failed_event_returns_queue", "Failed event should remain in action queue.", { decision: btcDecision(failedEvent), actionCount: failedEvent.actionCount }));

  const sameState = buildV17Decisions({ assets: [btcAsset], markets: { BTC: { symbol: "BTC", price: 70000, cycleHigh: 100000 } }, previousStates: { BTC: { status: ACTION_STATUS.QUEUED, tier: "D3", price: 70000 } }, now: "2026-06-29T00:00:00.000Z" });
  tests.push(assert(btcDecision(sameState)?.shouldNotify === false, "same_state_no_notify", "Same status, tier, and price should not notify again.", { decision: btcDecision(sameState) }));

  const priceChanged = buildV17Decisions({ assets: [btcAsset], markets: { BTC: { symbol: "BTC", price: 69000, cycleHigh: 100000 } }, previousStates: { BTC: { status: ACTION_STATUS.QUEUED, tier: "D3", price: 70000 } }, now: "2026-06-29T00:00:00.000Z" });
  tests.push(assert(btcDecision(priceChanged)?.shouldNotify === true, "price_change_notify", "Price change while active should notify.", { decision: btcDecision(priceChanged) }));

  const failed = tests.length - tests.filter((test) => test.ok).length;
  const passed = tests.length - failed;

  return { ok: failed === 0, version: "v17-action-queue-v1", mode: "self_test", storage, summary: { total: tests.length, passed, failed }, tests };
}
