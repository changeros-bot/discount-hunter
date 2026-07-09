const { getMarket91Shortlist } = require("./v17-market-91-shortlist");

const PAPER_RULE_VERSION = "v17-market-91-paper-rules-v1";

const RULES = {
  core: {
    layer1: { triggerPct: -15, amountUsd: 5 },
    layer2: { triggerPct: -25, amountUsd: 5 },
    layer3: { triggerPct: -35, amountUsd: 10 },
  },
  satellite: {
    layer1: { triggerPct: -20, amountUsd: 5 },
    layer2: { triggerPct: -30, amountUsd: 5 },
    layer3: { triggerPct: -40, amountUsd: 10 },
  },
  highVolatility: {
    layer1: { triggerPct: -25, amountUsd: 5 },
    layer2: { triggerPct: -40, amountUsd: 5 },
    layer3: { triggerPct: -55, amountUsd: 10 },
  },
};

const RULE_BY_SYMBOL = {
  NVDA: "core",
  AVGO: "core",
  TSM: "core",
  MSFT: "core",
  META: "core",
  GOOGL: "core",
  AMZN: "core",
  MU: "satellite",
  QCOM: "satellite",
  DELL: "highVolatility",
  ARM: "highVolatility",
  ORCL: "satellite",
  NET: "highVolatility",
  NOW: "satellite",
  HUBB: "satellite",
  COIN: "highVolatility",
  SPCX: "highVolatility",
};

function key(symbol) {
  return String(symbol || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}
function num(value, fallback = 0) {
  const n = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : fallback;
}
function marketFor(markets, symbol) {
  const k = key(symbol);
  return markets?.[symbol] || markets?.[k] || markets?.[`${k}ON`] || markets?.[`${symbol}ON`] || null;
}
function discountPctFromMarket(market) {
  const direct = num(market?.discount, null);
  if (Number.isFinite(direct) && direct !== 0) return direct <= 0 ? direct : -Math.abs(direct);
  const price = num(market?.price, 0);
  const high = num(market?.cycleHigh || market?.high || market?.high52w, 0);
  if (price > 0 && high > 0) return ((price - high) / high) * 100;
  return null;
}
function nextLayerFor(discountPct, rule) {
  if (discountPct === null || discountPct === undefined) return null;
  const layers = [rule.layer3, rule.layer2, rule.layer1];
  return layers.find((layer) => discountPct <= layer.triggerPct) || null;
}
function buildPaperCandidates({ markets = {}, now = new Date().toISOString() } = {}) {
  const shortlist = getMarket91Shortlist();
  const confirmed = shortlist.confirmedMainList || [];
  const rows = confirmed.map((item) => {
    const ruleKey = RULE_BY_SYMBOL[key(item.symbol)] || "satellite";
    const rule = RULES[ruleKey];
    const market = marketFor(markets, item.symbol);
    const price = num(market?.price, 0);
    const discountPct = discountPctFromMarket(market);
    const layer = nextLayerFor(discountPct, rule);
    const action = layer && price > 0
      ? {
          actionGate: "Paper Buy Triggered",
          amountUsd: layer.amountUsd,
          triggerPct: layer.triggerPct,
          estimatedQty: layer.amountUsd / price,
          price,
          paperOnly: true,
        }
      : {
          actionGate: "No Paper Action",
          amountUsd: 0,
          triggerPct: null,
          estimatedQty: 0,
          price,
          paperOnly: true,
        };
    return {
      symbol: item.symbol,
      name: item.name,
      bucket: item.bucket,
      role: item.proposedRole,
      ruleKey,
      rule,
      discountPct,
      discountText: discountPct === null || discountPct === undefined ? "N/A" : `${discountPct.toFixed(2)}%`,
      reason: item.reason,
      updatedAt: now,
      ...action,
    };
  });
  const triggered = rows.filter((row) => row.actionGate === "Paper Buy Triggered");
  return {
    ok: true,
    version: PAPER_RULE_VERSION,
    updatedAt: now,
    mode: "paper_trading_only_no_real_orders",
    policy: {
      universe: "Confirmed Market 91 17-symbol main list only",
      realTrading: false,
      autoTrading: false,
      purpose: "Record simulated discount buys and measure 30/60/90 day performance before any real-money rule change.",
    },
    rules: RULES,
    summary: {
      universeCount: confirmed.length,
      triggeredCount: triggered.length,
      noActionCount: rows.length - triggered.length,
      totalPaperAmountUsd: triggered.reduce((sum, row) => sum + Number(row.amountUsd || 0), 0),
    },
    triggered,
    rows,
  };
}

module.exports = { PAPER_RULE_VERSION, RULES, RULE_BY_SYMBOL, buildPaperCandidates };
