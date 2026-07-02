import { ASSET_STATUS, ENGINES, STRATEGIES } from "./v17-asset-registry";
import { applyBtcDiscountModel, applyXstockDiscountModel, getTriggeredTiers } from "./v17-discount-model";

export const ACTION_STATUS = Object.freeze({
  NONE: "none",
  QUEUED: "queued",
  PARTIAL: "partial",
  COMPLETE: "complete",
  SUSPECT: "suspect",
  MISMATCH: "mismatch",
  FAILED: "failed",
  SKIPPED: "skipped",
  REVIEW_ONLY: "review_only"
});

const AMOUNT_TOLERANCE_USD = 0.05;

export function normalizeSymbol(symbol) {
  return String(symbol || "").trim().toUpperCase();
}

export function baseSymbol(symbol) {
  return normalizeSymbol(symbol).replace(/ON$/, "");
}

export function toNumber(value, fallback = null) {
  const n = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

export function buildEngineContext(engine) {
  if (engine === ENGINES.TACTICAL) {
    return {
      engine,
      ledgerKey: "discount-hunter:v17:tactical-ledger",
      costBasisScope: "tactical_only",
      rule: "Tactical cost, lots, and performance must not mix with Investment Engine."
    };
  }

  return {
    engine: ENGINES.INVESTMENT,
    ledgerKey: "discount-hunter:v17:investment-ledger",
    costBasisScope: "investment_only",
    rule: "Investment cost, lots, and performance must not mix with Tactical Engine."
  };
}

export function normalizeMarketMap(markets = {}) {
  const map = new Map();

  if (Array.isArray(markets)) {
    for (const row of markets) if (row?.symbol) map.set(normalizeSymbol(row.symbol), row);
    return map;
  }

  for (const [symbol, value] of Object.entries(markets || {})) {
    map.set(normalizeSymbol(symbol), { symbol, ...(value || {}) });
  }

  return map;
}

export function normalizeEventList(events = []) {
  if (Array.isArray(events)) return events;
  if (events && typeof events === "object") return Object.values(events).flat();
  return [];
}

export function getMarketForAsset(asset, marketMap) {
  const direct = marketMap.get(normalizeSymbol(asset.symbol));
  if (direct) return direct;
  return marketMap.get(baseSymbol(asset.symbol)) || null;
}

export function getEventsForAsset(asset, events = []) {
  const target = baseSymbol(asset.symbol);
  return normalizeEventList(events).filter((event) => {
    const symbol = baseSymbol(event?.symbol || event?.asset || event?.tokenSymbol);
    return symbol && target && symbol === target;
  });
}

export function applyDiscountModel(asset, market) {
  if (!market) {
    return {
      ...asset,
      price: null,
      high: null,
      discount: null,
      signal: { text: "資料未就緒", amount: "0U", level: 0, tier: "N" },
      discountModelApplied: asset.discountModel || null,
      modelNote: "No market data was provided."
    };
  }

  if (asset.symbol === "BTC" || asset.discountModel === "btc_discount_v1") return applyBtcDiscountModel(asset, market);
  return applyXstockDiscountModel(asset, market);
}

export function getEventLayer(event, asset) {
  const type = String(event?.type || event?.eventType || "").toLowerCase();
  if (type === "skip_layer" || type === "skipped_layer") {
    const skipLayer = toNumber(event?.layer ?? event?.level, 0);
    return skipLayer >= 1 ? Math.min(4, skipLayer) : 0;
  }

  const explicitLayer = toNumber(event?.layer ?? event?.level, null);
  if (explicitLayer && explicitLayer >= 1) return Math.min(4, explicitLayer);

  const price = toNumber(event?.price ?? event?.fillPrice ?? event?.eventPrice, null);
  const high = toNumber(asset?.high, null);
  if (!price || !high) return 0;

  const discount = ((price - high) / high) * 100;
  const triggered = getTriggeredTiers({ discount, rules: asset.rules || [] });
  return triggered.length ? triggered[triggered.length - 1].level : 0;
}

export function isSkipLayerEvent(event, layer) {
  const type = String(event?.type || event?.eventType || "").toLowerCase();
  const status = String(event?.status || "").toLowerCase();
  if (type !== "skip_layer" && type !== "skipped_layer" && status !== "skipped") return false;
  return getEventLayer(event, { rules: [] }) === layer || toNumber(event?.layer ?? event?.level, null) === layer;
}

export function summarizeAssetEvents({ asset, layer, events }) {
  const requiredAmount = Number(asset.amounts?.[layer - 1] || 0);
  let totalAmount = 0;
  let priceMissing = false;
  let failed = false;
  let skipped = false;
  const matched = [];
  const mismatch = [];
  const skippedEvents = [];

  for (const event of events) {
    if (isSkipLayerEvent(event, layer)) {
      skipped = true;
      skippedEvents.push(event);
      continue;
    }

    if (event?.status === "failed") {
      failed = true;
      continue;
    }

    const eventLayer = getEventLayer(event, asset);
    const amount = toNumber(event?.amount ?? event?.notional ?? event?.usdValue ?? event?.value, 0) || 0;
    const hasPrice = toNumber(event?.price ?? event?.fillPrice ?? event?.eventPrice, null) !== null;

    if (amount > 0 && eventLayer === 0) {
      priceMissing = true;
      continue;
    }
    if (!hasPrice && amount > 0) {
      priceMissing = true;
      continue;
    }

    if (eventLayer === layer) {
      totalAmount += amount;
      matched.push({ ...event, layer: eventLayer, amount, priceMissing: !hasPrice });
    } else if (eventLayer > 0) {
      const isPriorLayerDone =
        eventLayer < layer &&
        amount <= Number(asset.amounts?.[eventLayer - 1] || 0) + AMOUNT_TOLERANCE_USD;

      if (!isPriorLayerDone) {
        mismatch.push({ ...event, layer: eventLayer, expectedLayer: layer });
      }
    }
  }

  const complete = requiredAmount > 0 && totalAmount + AMOUNT_TOLERANCE_USD >= requiredAmount;
  const partial = totalAmount > 0 && !complete;

  return {
    requiredAmount,
    totalAmount: Number(totalAmount.toFixed(6)),
    complete,
    partial,
    failed,
    skipped,
    priceMissing,
    amountLow: partial,
    amountHigh: requiredAmount > 0 && totalAmount > requiredAmount + AMOUNT_TOLERANCE_USD,
    matched,
    mismatch,
    skippedEvents
  };
}

export function createActionId({ symbol, tier, now }) {
  const compactTime = String(now || new Date().toISOString()).replace(/[^0-9]/g, "").slice(0, 14);
  return `${baseSymbol(symbol)}-${tier}-${compactTime}`;
}

export function buildStateDecision({ asset, pricedAsset, context, events, previousState, now }) {
  const triggered = getTriggeredTiers({ discount: pricedAsset.discount, rules: asset.rules });
  const deepest = triggered[triggered.length - 1] || null;
  const isQualified = asset.status === ASSET_STATUS.QUALIFIED;
  const hasMarketData = Number.isFinite(Number(pricedAsset.price)) && Number.isFinite(Number(pricedAsset.discount));

  if (!deepest || !hasMarketData) {
    return {
      symbol: asset.symbol,
      name: asset.name,
      engine: asset.engine,
      strategy: asset.strategy,
      assetStatus: asset.status,
      status: ACTION_STATUS.NONE,
      tier: "N",
      level: 0,
      amount: 0,
      price: pricedAsset.price ?? null,
      high: pricedAsset.high ?? pricedAsset.cycleHigh ?? null,
      discount: pricedAsset.discount ?? null,
      reason: "No active decision layer.",
      shouldNotify: previousState?.status !== ACTION_STATUS.NONE,
      context,
      decidedAt: now
    };
  }

  const amount = Number(asset.amounts?.[deepest.level - 1] || 0);
  const summary = summarizeAssetEvents({ asset: { ...asset, high: pricedAsset.high ?? pricedAsset.cycleHigh ?? asset.high }, layer: deepest.level, events });
  let status = ACTION_STATUS.QUEUED;
  let reason = "Active layer waiting for matching event.";

  if (!isQualified) {
    status = ACTION_STATUS.REVIEW_ONLY;
    reason = `${asset.symbol} is not Qualified.`;
  } else if (summary.skipped) {
    status = ACTION_STATUS.SKIPPED;
    reason = "Current layer was skipped by user.";
  } else if (summary.failed) {
    status = ACTION_STATUS.FAILED;
    reason = "Previous attempt failed; remains in action queue.";
  } else if (summary.complete) {
    status = ACTION_STATUS.COMPLETE;
    reason = "Required amount completed by matched events.";
  } else if (summary.priceMissing) {
    status = ACTION_STATUS.SUSPECT;
    reason = "Event detected but price is missing; pending confirmation.";
  } else if (summary.mismatch.length > 0) {
    status = ACTION_STATUS.MISMATCH;
    reason = "Detected event does not match current layer or suggestion.";
  } else if (summary.partial) {
    status = ACTION_STATUS.PARTIAL;
    reason = "Partial amount detected; amount is below suggestion.";
  }

  const shouldNotify = status !== ACTION_STATUS.SKIPPED && (!previousState || previousState.status !== status || previousState.tier !== deepest.tier || previousState.price !== pricedAsset.price);

  return {
    symbol: asset.symbol,
    name: asset.name,
    engine: asset.engine,
    strategy: asset.strategy,
    assetStatus: asset.status,
    status,
    tier: deepest.tier,
    level: deepest.level,
    rule: deepest.rule,
    amount,
    price: pricedAsset.price ?? null,
    high: pricedAsset.high ?? pricedAsset.cycleHigh ?? null,
    discount: pricedAsset.discount ?? null,
    signal: pricedAsset.signal,
    actionId: createActionId({ symbol: asset.symbol, tier: deepest.tier, now }),
    reason,
    eventSummary: summary,
    shouldNotify,
    context,
    decidedAt: now,
    sourceOfTruth: "market_price_and_transaction_events"
  };
}

export function buildPureDcaDecision(asset, context, now) {
  return {
    symbol: asset.symbol,
    name: asset.name,
    engine: asset.engine,
    strategy: asset.strategy,
    assetStatus: asset.status,
    status: ACTION_STATUS.REVIEW_ONLY,
    tier: "N",
    level: 0,
    amount: 0,
    reason: "Pure DCA asset. Not part of discount action queue.",
    shouldNotify: false,
    context,
    decidedAt: now
  };
}

export function buildTacticalDecision(asset, context, now) {
  return {
    symbol: asset.symbol,
    name: asset.name,
    engine: asset.engine,
    strategy: asset.strategy,
    assetStatus: asset.status,
    status: ACTION_STATUS.REVIEW_ONLY,
    tier: "N",
    level: 0,
    amount: 0,
    reason: "Tactical Engine is registered but not enabled in V17 Sprint 1.",
    shouldNotify: false,
    context,
    decidedAt: now
  };
}

export function buildDecisionForAsset(asset, marketMap, eventList, previousStates = {}, now = new Date().toISOString()) {
  const context = buildEngineContext(asset.engine);

  if (asset.engine === ENGINES.TACTICAL) return buildTacticalDecision(asset, context, now);
  if (asset.strategy === STRATEGIES.PURE_DCA) return buildPureDcaDecision(asset, context, now);

  if (asset.strategy === STRATEGIES.DCA_DISCOUNT || asset.strategy === STRATEGIES.DISCOUNT_ONLY) {
    const market = getMarketForAsset(asset, marketMap);
    const pricedAsset = applyDiscountModel(asset, market);
    const events = getEventsForAsset(asset, eventList);
    return buildStateDecision({ asset, pricedAsset, context, events, previousState: previousStates[asset.symbol] || previousStates[baseSymbol(asset.symbol)] || null, now });
  }

  return {
    symbol: asset.symbol,
    name: asset.name,
    engine: asset.engine,
    strategy: asset.strategy,
    assetStatus: asset.status,
    status: ACTION_STATUS.REVIEW_ONLY,
    reason: `Unsupported V17 strategy: ${asset.strategy}`,
    context,
    decidedAt: now
  };
}

export function buildV17Decisions({ assets = [], markets = {}, events = [], previousStates = {}, now = new Date().toISOString() }) {
  const marketMap = normalizeMarketMap(markets);
  const eventList = normalizeEventList(events);
  const decisions = assets.map((asset) => buildDecisionForAsset(asset, marketMap, eventList, previousStates, now));
  const queueStatuses = new Set([ACTION_STATUS.QUEUED, ACTION_STATUS.PARTIAL, ACTION_STATUS.SUSPECT, ACTION_STATUS.MISMATCH, ACTION_STATUS.FAILED]);
  const actionQueue = decisions.filter((decision) => queueStatuses.has(decision.status));

  return {
    ok: true,
    version: "v17-action-queue-v1",
    mode: "event_driven_action_queue",
    updatedAt: now,
    count: decisions.length,
    actionCount: actionQueue.length,
    notifyCount: decisions.filter((decision) => decision.shouldNotify).length,
    totalActionAmount: actionQueue.reduce((sum, decision) => sum + Number(decision.amount || 0), 0),
    actionQueue,
    decisions
  };
}
