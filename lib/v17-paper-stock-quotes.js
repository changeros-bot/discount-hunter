const YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart";
const BINANCE_LIST_URL = "https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/stock/detail/list/ai";
const BINANCE_DYNAMIC_URL = "https://www.binance.com/bapi/defi/v2/public/wallet-direct/buw/wallet/market/token/rwa/dynamic/ai";

export const PAPER_STOCK_SYMBOLS = [
  // Market45 / sector module
  "NOW", "QCOM", "DELL", "REGN",
  // Market91 audit paper
  "MA", "V", "PWR", "CEG", "COST", "GEV", "LLY", "SPOT", "TMUS", "ACN",
  // Market10 discount candidates
  "MSFT", "NFLX", "ADBE", "SOFI",
];

const BINANCE_HEADERS = {
  accept: "application/json, text/plain, */*",
  "accept-language": "en-US,en;q=0.9",
  "cache-control": "no-cache",
  clienttype: "web",
  lang: "en",
  origin: "https://www.binance.com",
  pragma: "no-cache",
  referer: "https://www.binance.com/en/markets/overview",
  "user-agent": "Mozilla/5.0 (V17 Paper xStock Provider) binance-web",
};

function num(value) {
  const n = Number(String(value ?? "0").replace(/,/g, ""));
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

function emptyQuote(symbol, asset = {}, status = "MISSING_PRICE", error = null, provider = "Binance xStocks first / Yahoo fallback") {
  return {
    ...asset,
    symbol,
    tokenSymbol: `${symbol}on`,
    price: 0,
    stockPrice: 0,
    tokenPrice: 0,
    rawTokenPrice: 0,
    high: 0,
    low: 0,
    high52w: 0,
    low52w: 0,
    priceSource: provider,
    discount: null,
    discountRaw: null,
    signal: { text: error ? "報價失敗" : "報價無資料", amount: "0U", level: 0 },
    quoteAudit: { status, provider, error, checkedAt: new Date().toISOString() },
  };
}

async function fetchJson(url, headers = BINANCE_HEADERS) {
  const cacheBustUrl = `${url}${url.includes("?") ? "&" : "?"}_=${Date.now()}`;
  const startedAt = Date.now();
  const response = await fetch(cacheBustUrl, { cache: "no-store", headers });
  const text = await response.text();
  const latencyMs = Date.now() - startedAt;
  if (!response.ok) throw new Error(`${url} ${response.status} ${text.slice(0, 140)}`);
  return { json: JSON.parse(text), latencyMs, status: response.status };
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.data?.list)) return value.data.list;
  if (Array.isArray(value?.data?.rows)) return value.data.rows;
  if (Array.isArray(value?.list)) return value.list;
  if (Array.isArray(value?.rows)) return value.rows;
  return [];
}

function getSymbol(item) {
  return item?.symbol || item?.ticker || item?.tokenSymbol || item?.stockSymbol || item?.assetSymbol || item?.s || item?.data?.symbol;
}

function normalizeBaseSymbol(symbol) {
  return String(symbol || "").trim().toUpperCase().replace(/ON$/, "");
}

function buildBinanceSymbolIndex(tokenList = []) {
  const map = new Map();
  for (const item of tokenList || []) {
    const raw = String(getSymbol(item) || "").trim();
    if (!raw) continue;
    const key = normalizeBaseSymbol(raw);
    if (!map.has(key)) map.set(key, item);
  }
  return map;
}

async function getBinanceTokenList() {
  const result = await fetchJson(BINANCE_LIST_URL);
  return { list: asArray(result.json), latencyMs: result.latencyMs, status: result.status };
}

async function getBinanceDynamic(item) {
  const chainId = item?.chainId || item?.chainID || item?.chain?.id || 56;
  const contractAddress = item?.contractAddress || item?.address || item?.tokenAddress;
  if (!contractAddress) throw new Error(`missing contractAddress for ${getSymbol(item) || "unknown"}`);
  const url = `${BINANCE_DYNAMIC_URL}?chainId=${encodeURIComponent(chainId)}&contractAddress=${encodeURIComponent(contractAddress)}`;
  return { ...(await fetchJson(url)), chainId, contractAddress };
}

function normalizeBinanceQuote(symbol, asset, tokenMeta, dynamicResult) {
  const root = dynamicResult?.json?.data || dynamicResult?.json || {};
  const tokenInfo = root.tokenInfo || root.token || {};
  const stockInfo = root.stockInfo || root.stock || {};
  const rawTokenPrice = num(tokenInfo.price || root.price);
  const stockPrice = num(stockInfo.price);
  const sharesMultiplier = num(tokenInfo.sharesMultiplier || stockInfo.sharesMultiplier || tokenInfo.multiplier || stockInfo.multiplier || tokenMeta?.sharesMultiplier || tokenMeta?.multiplier) || 1;
  const displayPrice = rawTokenPrice > 0 ? rawTokenPrice / sharesMultiplier : stockPrice;
  const high = num(stockInfo.priceHigh52w || stockInfo.week52High || stockInfo.fiftyTwoWeekHigh);
  const low = num(stockInfo.priceLow52w || stockInfo.week52Low || stockInfo.fiftyTwoWeekLow);
  const discountRaw = high > 0 && displayPrice > 0 ? ((displayPrice - high) / high) * 100 : null;
  const discount = discountRaw === null ? null : Number(discountRaw.toFixed(1));
  const rules = Array.isArray(asset.rules) ? asset.rules : [];
  const amounts = Array.isArray(asset.amounts) ? asset.amounts : [];
  const rawSymbol = String(getSymbol(tokenMeta) || `${symbol}on`);
  return {
    ...asset,
    symbol,
    name: asset.name && asset.name !== symbol ? asset.name : (stockInfo.name || tokenInfo.name || rawSymbol || symbol),
    tokenSymbol: rawSymbol,
    tradableSymbol: rawSymbol,
    isBinanceXStock: true,
    quotePriority: "BINANCE_XSTOCK_FIRST",
    price: displayPrice,
    stockPrice: stockPrice || displayPrice,
    tokenPrice: displayPrice,
    rawTokenPrice: rawTokenPrice || displayPrice,
    high,
    low,
    high52w: high,
    low52w: low,
    marketCap: num(stockInfo.marketCap || tokenInfo.marketCap || root.marketCap),
    volume: num(stockInfo.volume || tokenInfo.volume24h || root.volume),
    sharesMultiplier,
    highType: "Binance 52週高點",
    lowType: "Binance 52週低點",
    priceSource: "Binance xStocks tokenInfo.price / sharesMultiplier",
    discount,
    discountRaw,
    signal: discount === null ? { text: "資料未就緒", amount: "0U", level: 0 } : getSignal(discount, rules, amounts),
    quoteAudit: {
      status: displayPrice > 0 ? "PASS" : "MISSING_PRICE",
      provider: "Binance xStocks",
      checkedAt: new Date().toISOString(),
      tokenSymbol: rawSymbol,
      chainId: dynamicResult?.chainId,
      contractAddress: dynamicResult?.contractAddress,
      sharesMultiplier,
      latencyMs: dynamicResult?.latencyMs ?? null,
      fallbackUsed: false,
    },
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
  if (!result) return emptyQuote(symbol, asset, "MISSING_SYMBOL", null, "Yahoo Finance chart fallback");

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
    tokenSymbol: null,
    tradableSymbol: null,
    isBinanceXStock: false,
    quotePriority: "YAHOO_FALLBACK_ONLY",
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
    priceSource: "Yahoo Finance chart fallback",
    discount,
    discountRaw,
    signal: discount === null ? { text: "資料未就緒", amount: "0U", level: 0 } : getSignal(discount, rules, amounts),
    quoteAudit: {
      status: price > 0 ? "PASS" : "MISSING_PRICE",
      provider: "Yahoo Finance chart fallback",
      checkedAt: new Date().toISOString(),
      regularMarketTime: meta.regularMarketTime || null,
      exchange: meta.fullExchangeName || meta.exchangeName || meta.exchange || null,
      timezone: meta.timezone || null,
      fallbackUsed: true,
      reason: "binance_xstock_not_found_or_failed",
    },
  };
}

export async function fetchPaperStockQuotes(symbols = [], assetMap = {}) {
  const list = uniqueSymbols(symbols);
  if (!list.length) return [];
  let binanceIndex = new Map();
  let binanceListError = null;
  try {
    const tokenListResult = await getBinanceTokenList();
    binanceIndex = buildBinanceSymbolIndex(tokenListResult.list);
  } catch (error) {
    binanceListError = error.message;
  }

  return Promise.all(list.map(async (symbol) => {
    const asset = assetMap[symbol] || { symbol };
    const tokenMeta = binanceIndex.get(symbol);
    if (tokenMeta) {
      try {
        const dynamic = await getBinanceDynamic(tokenMeta);
        return normalizeBinanceQuote(symbol, asset, tokenMeta, dynamic);
      } catch (error) {
        try {
          const fallback = await fetchYahooChart(symbol, asset);
          return { ...fallback, quoteAudit: { ...fallback.quoteAudit, binanceError: error.message, fallbackUsed: true } };
        } catch (fallbackError) {
          return emptyQuote(symbol, asset, "PROVIDER_ERROR", `${error.message}; fallback ${fallbackError.message}`);
        }
      }
    }
    try {
      const fallback = await fetchYahooChart(symbol, asset);
      return { ...fallback, quoteAudit: { ...fallback.quoteAudit, binanceError: binanceListError, fallbackUsed: true, reason: binanceListError ? "binance_list_failed" : "binance_xstock_not_listed" } };
    } catch (error) {
      return emptyQuote(symbol, asset, "PROVIDER_ERROR", error.message);
    }
  }));
}

// Backward-compatible alias. New code should call fetchPaperStockQuotes().
export const fetchYahooStockQuotes = fetchPaperStockQuotes;
