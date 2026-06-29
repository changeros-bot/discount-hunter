export function toNumber(value) {
  const n = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function calculateDiscountPct({ price, anchorHigh }) {
  const current = toNumber(price);
  const high = toNumber(anchorHigh);
  if (!current || !high || current <= 0 || high <= 0) return null;
  return Number((((current - high) / high) * 100).toFixed(2));
}

export function getTriggeredTiers({ discount, rules = [] }) {
  const current = toNumber(discount);
  if (current === null) return [];

  return rules
    .map((rule, index) => ({
      tier: `D${index + 1}`,
      level: index + 1,
      rule: toNumber(rule)
    }))
    .filter((item) => item.rule !== null && current <= item.rule);
}

export function getSignal({ discount, rules = [], amounts = [] }) {
  const triggered = getTriggeredTiers({ discount, rules });
  if (!triggered.length) {
    return { text: "尚未到買點", amount: "0U", level: 0, tier: "N" };
  }

  const deepest = triggered[triggered.length - 1];
  const amount = Number(amounts[deepest.level - 1] || 0);
  return {
    text: `第${deepest.level}買點`,
    amount: `${amount}U`,
    level: deepest.level,
    tier: deepest.tier
  };
}

export function applyXstockDiscountModel(asset, market) {
  const discount = calculateDiscountPct({ price: market.price, anchorHigh: market.high });
  const signal = discount === null
    ? { text: "資料未就緒", amount: "0U", level: 0, tier: "N" }
    : getSignal({ discount, rules: asset.rules, amounts: asset.amounts });

  return {
    ...asset,
    ...market,
    discount,
    signal,
    discountModelApplied: asset.discountModel || "xstock_52w_v1"
  };
}

export function applyBtcDiscountModel(asset, market) {
  const discount = calculateDiscountPct({ price: market.price, anchorHigh: market.cycleHigh || market.high });
  const signal = discount === null
    ? { text: "資料未就緒", amount: "0U", level: 0, tier: "N" }
    : getSignal({ discount, rules: asset.rules, amounts: asset.amounts });

  return {
    ...asset,
    ...market,
    discount,
    signal,
    discountModelApplied: "btc_discount_v1",
    modelNote: "BTC uses its own discount model. Do not blindly reuse ETF assumptions. Current v1 uses a high-anchor placeholder until cycle-high/backtest logic is added."
  };
}
