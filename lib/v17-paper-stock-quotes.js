const YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart";

export const PAPER_STOCK_SYMBOLS = [
  // Market45 / sector module
  "NOW", "QCOM", "DELL", "REGN",
  // Market91 audit paper
  "MA", "V", "PWR", "CEG", "COST", "GEV", "LLY", "SPOT", "TMUS", "ACN",
  // Market10 discount candidates
  "MSFT", "NFLX", "ADBE", "SOFI",
];

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function uniqueSymbols(symbols = []) {
  return [...new Set(symbols.map((s) => String(s || "").trim().toUpperCase().replace(/ON$/, "")).filter(Boolean))];
}

function getSignal(discount, rules = [], amounts = []) {
  for (let i = rules.length - 1; i >= 0; i -= 1) {
    if (discount <= Number(rules[i])) return { text: `第${i + 1}買點`, amount: `${amounts[i] || 0}U`, level: i + 1 };
  }
  return { text: "尚未到買點", amount: "0U", level: 0 };
}

function maxPositive(values = []) {
  return values.reduce((max, value) => {
    const n = num(value);
    return n > max ? n : max;
  }, 0);
}

function minPositive(values = []) {
  const positives = values.map(num).filter((x) => x > 0);
  return positives.length ? Math.min(...positives) : 0;
}

function lastPositive(values = []) {
  for (let i = values.length - 1; i >= 0; i -= 1) {
    const n = num(values[i]);
    if (n > 0) return n;
  }
  return 0;
}

function emptyQuote(symbol, asset = {}, status = "MISSING_PRICE", error = null) {
  return {
    ...asset,
    symbol,
    price: 0,
    stockPrice: 0,
    tokenPrice: 0,
    rawTokenPrice: 0,
    high: 0,
    low: 0,
    high52w: 0,
    low52w: 0,
    priceSource: "Yahoo Finance chart",
    discount: null,
    discountRaw: null,
    signal: { text: error ? "Yahoo chart 失敗" : "Yahoo chart 無資料", amount: "0U", level: 0 },
    quoteAudit: { status, provider: "Yahoo Finance chart", error, checkedAt: new Date().toISOString() },
  };
}

async function fetchYahooChart(symbol, asset = {}) {
  const url = `${YAHOO_CHART_URL}/${encodeURIComponent(symbol)}?range=1y&interval=1d&includePrePost=false`;
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      accept: "application/json,text/plain,*/*",
      "user-agent": "Mozilla/5.0 (V17 Paper Chart Provider)",
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Yahoo chart ${response.status}: ${text.slice(0, 120)}`);
  const json = JSON.parse(text);
  const result = json?.chart?.result?.[0];
  if (!result) return emptyQuote(symbol, asset, "MISSING_SYMBOL");

  const meta = result.meta || {};
  const quote = result.indicators?.quote?.[0] || {};
  const closes = Array.isArray(quote.close) ? quote.close : [];
  const highs = Array.isArray(quote.high) ? quote.high : [];
  const lows = Array.isArray(quote.low) ? quote.low : [];
  const volumes = Array.isArray(quote.volume) ? quote.volume : [];

  const price = num(meta.regularMarketPrice) || lastPositive(closes) || num(meta.previousClose) || num(meta.chartPreviousClose);
  const high = num(meta.fiftyTwoWeekHigh) || maxPositive(highs);
  const low = num(meta.fiftyTwoWeekLow) || minPositive(lows);
  const discountRaw = high > 0 && price > 0 ? ((price - high) / high) * 100 : null;
  const discount = discountRaw === null ? null : Number(discountRaw.toFixed(1));
  const rules = Array.isArray(asset.rules) ? asset.rules : [];
  const amounts = Array.isArray(asset.amounts) ? asset.amounts : [];

  return {
    ...asset,
    symbol,
    name: asset.name && asset.name !== symbol ? asset.name : (meta.shortName || meta.longName || symbol),
    price,
    stockPrice: price,
    tokenPrice: price,
    rawTokenPrice: price,
    high,
    low,
    high52w: high,
    low52w: low,
    marketCap: num(meta.marketCap),
    volume: lastPositive(volumes),
    highType: "Yahoo chart 1Y high",
    lowType: "Yahoo chart 1Y low",
    priceSource: "Yahoo Finance chart",
    discount,
    discountRaw,
    signal: discount === null ? { text: "資料未就緒", amount: "0U", level: 0 } : getSignal(discount, rules, amounts),
    quoteAudit: {
      status: price > 0 ? "PASS" : "MISSING_PRICE",
      provider: "Yahoo Finance chart",
      checkedAt: new Date().toISOString(),
      regularMarketTime: meta.regularMarketTime || null,
      exchange: meta.fullExchangeName || meta.exchangeName || meta.exchange || null,
      timezone: meta.timezone || null,
    },
  };
}

export async function fetchYahooStockQuotes(symbols = [], assetMap = {}) {
  const list = uniqueSymbols(symbols);
  if (!list.length) return [];
  return Promise.all(list.map(async (symbol) => {
    const asset = assetMap[symbol] || { symbol };
    try {
      return await fetchYahooChart(symbol, asset);
    } catch (error) {
      return emptyQuote(symbol, asset, "PROVIDER_ERROR", error.message);
    }
  }));
}
