import { ASSET_STATUS, ENGINES, STRATEGIES } from "./v17-asset-registry";
import { applyBtcDiscountModel, applyXstockDiscountModel, getTriggeredTiers } from "./v17-discount-model";

export function normalizeSymbol(symbol) {
  return String(symbol || "").trim().toUpperCase();
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
    for (const row of markets) {
      if (row?.symbol) map.set(normalizeSymbol(row.symbol), row);
    }
    return map;
  }

  for (const [symbol, value] of Object.entries(markets || {})) {
    map.set(normalizeSymbol(symbol), { symbol, ...(value || {}) });
  }

  return map;
}

export function getMarketForAsset(asset, marketMap) {
  const direct = marketMap.get(normalizeSymbol(asset.symbol));
  if (direct) return direct;

  const withoutOn = normalizeSymbol(asset.symbol).replace(/ON$/, "");
  return marketMap.get(withoutOn) || null;
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
      modelNote: "No market data was provided. V17 decision remains read-only and non-executable."
    };
  }

  if (asset.symbol === "BTC" || asset.discountModel === "btc_discount_v1") {
    return applyBtcDiscountModel(asset, market);
  }

  return applyXstockDiscountModel(asset, market);
}

export function buildPureDcaDecision(asset, context, now) {
  return {
    symbol: asset.symbol,
    name: asset.name,
    engine: asset.engine,
    strategy: asset.strategy,
    status: asset.status,
    action: "dca_check",
    executable: false,
    tier: "N",
    level: 0,
    amount: 0,
    command: null,
    reason: "Pure DCA asset. Execute only through the scheduled DCA plan, not discount hunting.",
    context,
    decidedAt: now
  };
}

export function buildDiscountDecision(asset, pricedAsset, context, now) {
  const triggered = getTriggeredTiers({ discount: pricedAsset.discount, rules: asset.rules });
  const deepest = triggered[triggered.length - 1] || null;
  const amount = deepest ? Number(asset.amounts?.[deepest.level - 1] || 0) : 0;
  const isQualified = asset.status === ASSET_STATUS.QUALIFIED;
  const hasMarketData = Number.isFinite(Number(pricedAsset.price)) && Number.isFinite(Number(pricedAsset.discount));
  const isTriggered = Boolean(deepest);
  const executable = Boolean(isQualified && hasMarketData && isTriggered);

  return {
    symbol: asset.symbol,
    name: asset.name,
    engine: asset.engine,
    strategy: asset.strategy,
    status: asset.status,
    action: isTriggered ? "discount_buy_review" : "wait",
    executable,
    tier: deepest?.tier || "N",
    level: deepest?.level || 0,
    rule: deepest?.rule ?? null,
    amount,
    price: pricedAsset.price ?? null,
    high: pricedAsset.high ?? pricedAsset.cycleHigh ?? null,
    discount: pricedAsset.discount ?? null,
    signal: pricedAsset.signal,
    discountModelApplied: pricedAsset.discountModelApplied,
    command: executable ? `/v17/buy ${asset.engine} ${asset.symbol} ${deepest.tier} ${amount}` : null,
    reason: executable
      ? `${asset.symbol} is Qualified, market data is available, and ${deepest.tier} was triggered by ${pricedAsset.discount}% discount.`
      : buildNonExecutableReason({ asset, hasMarketData, isTriggered }),
    modelNote: pricedAsset.modelNote || null,
    context,
    decidedAt: now,
    readOnly: true,
    ruleMigrationStatus: "blocked_until_universe_freeze_approved"
  };
}

export function buildNonExecutableReason({ asset, hasMarketData, isTriggered }) {
  if (asset.status !== ASSET_STATUS.QUALIFIED) return `${asset.symbol} is ${asset.status}; not treated as executable before Universe Freeze approval.`;
  if (!hasMarketData) return `${asset.symbol} has no usable market data.`;
  if (!isTriggered) return `${asset.symbol} has not reached any active discount tier.`;
  return `${asset.symbol} is not executable under current V17 guardrails.`;
}

export function buildTacticalDecision(asset, context, now) {
  return {
    symbol: asset.symbol,
    name: asset.name,
    engine: asset.engine,
    strategy: asset.strategy,
    status: asset.status,
    action: "tactical_review_only",
    executable: false,
    tier: "N",
    level: 0,
    amount: 0,
    command: null,
    reason: "Tactical Engine is registered but not enabled in V17 Sprint 1. Keep separate from Investment Engine.",
    context,
    decidedAt: now,
    readOnly: true
  };
}

export function buildDecisionForAsset(asset, marketMap, now = new Date().toISOString()) {
  const context = buildEngineContext(asset.engine);

  if (asset.engine === ENGINES.TACTICAL) {
    return buildTacticalDecision(asset, context, now);
  }

  if (asset.strategy === STRATEGIES.PURE_DCA) {
    return buildPureDcaDecision(asset, context, now);
  }

  if (asset.strategy === STRATEGIES.DCA_DISCOUNT || asset.strategy === STRATEGIES.DISCOUNT_ONLY) {
    const market = getMarketForAsset(asset, marketMap);
    const pricedAsset = applyDiscountModel(asset, market);
    return buildDiscountDecision(asset, pricedAsset, context, now);
  }

  return {
    symbol: asset.symbol,
    name: asset.name,
    engine: asset.engine,
    strategy: asset.strategy,
    status: asset.status,
    action: "unsupported_strategy",
    executable: false,
    reason: `Unsupported V17 strategy: ${asset.strategy}`,
    context,
    decidedAt: now,
    readOnly: true
  };
}

export function buildV17Decisions({ assets = [], markets = {}, now = new Date().toISOString() }) {
  const marketMap = normalizeMarketMap(markets);
  const decisions = assets.map((asset) => buildDecisionForAsset(asset, marketMap, now));

  return {
    ok: true,
    version: "v17",
    mode: "read_only_decision_engine",
    updatedAt: now,
    ruleMigrationStatus: "blocked_until_universe_freeze_approved",
    count: decisions.length,
    executableCount: decisions.filter((decision) => decision.executable).length,
    totalExecutableAmount: decisions.reduce((sum, decision) => sum + (decision.executable ? Number(decision.amount || 0) : 0), 0),
    decisions
  };
}
