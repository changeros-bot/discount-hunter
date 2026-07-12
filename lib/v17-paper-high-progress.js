function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalize(symbol) {
  return String(symbol || "").trim().toUpperCase().replace(/ON$/, "");
}

function buildQuoteMap(quotes = []) {
  const map = new Map();
  for (const quote of quotes || []) {
    const key = normalize(quote?.symbol);
    if (!key) continue;
    map.set(key, quote);
  }
  return map;
}

function progressFor(row = {}, quoteMap = new Map()) {
  const key = normalize(row.symbol);
  const quote = quoteMap.get(key) || quoteMap.get(normalize(`${row.symbol || ""}on`)) || {};
  const currentPrice = toNumber(row.currentPrice ?? row.price ?? quote.price, 0);
  const high52w = toNumber(row.high52w ?? quote.high52w ?? quote.high ?? 0, 0);
  if (!(currentPrice > 0) || !(high52w > 0)) return null;
  const progressPct = Math.max(0, Math.min(150, (currentPrice / high52w) * 100));
  const gapToHigh = high52w - currentPrice;
  const discountFromHighPct = ((currentPrice / high52w) - 1) * 100;
  return {
    enabled: true,
    mode: "absolute_52w_high_progress",
    source: quote?.quoteAudit?.provider || row?.quoteAudit?.provider || "paper_quote",
    currentPrice,
    high52w,
    progressPct,
    gapToHigh,
    discountFromHighPct,
    label: `${progressPct.toFixed(1)}% of 52W high`,
    note: "絕對值進度條：現價 ÷ 52週高點；只作觀察，不觸發真實交易。",
  };
}

export function enrichPaperHighProgress(value, quotes = []) {
  const quoteMap = buildQuoteMap(quotes);
  const enrichRow = (row) => {
    if (!row || typeof row !== "object" || !row.symbol) return row;
    const highProgress = progressFor(row, quoteMap);
    if (!highProgress) return row;
    return {
      ...row,
      high52w: highProgress.high52w,
      highProgress,
      absoluteProgressPct: highProgress.progressPct,
      gapToHigh: highProgress.gapToHigh,
      discountFromHighPct: highProgress.discountFromHighPct,
    };
  };

  return {
    ...value,
    trades: Array.isArray(value?.trades) ? value.trades.map(enrichRow) : value?.trades,
    positions: Array.isArray(value?.positions) ? value.positions.map(enrichRow) : value?.positions,
    paperAssets: Array.isArray(value?.paperAssets) ? value.paperAssets.map(enrichRow) : value?.paperAssets,
    highProgressPolicy: {
      enabled: true,
      mode: "absolute_52w_high_progress",
      formula: "progressPct = currentPrice / high52w * 100; gapToHigh = high52w - currentPrice; discountFromHighPct = currentPrice / high52w - 1",
      target: "18 Binance xStocks paper validation symbols",
      realOrder: false,
    },
  };
}

export function highProgressHealth(rows = []) {
  const enabled = (rows || []).filter((row) => row?.highProgress?.enabled).map((row) => row.symbol);
  return {
    enabledCount: enabled.length,
    enabled,
    missingCount: Math.max(0, (rows || []).length - enabled.length),
    realOrder: false,
  };
}
