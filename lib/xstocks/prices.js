// DCA Discount Hunter V15.2 - Live Binance xStocks price fetchers

const { PRICE_SYMBOL_MAP } = require("./constants");

const BINANCE_LIST_URL = "https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/stock/detail/list/ai";
const BINANCE_DYNAMIC_URL = "https://www.binance.com/bapi/defi/v2/public/wallet-direct/buw/wallet/market/token/rwa/dynamic/ai";
const LIVE_PRICE_CACHE_TTL_MS = 15 * 1000;

let livePriceCache = {
  key: "",
  expiresAt: 0,
  promise: null,
};

const headers = {
  accept: "application/json, text/plain, */*",
  "accept-language": "en-US,en;q=0.9",
  "cache-control": "no-cache",
  clienttype: "web",
  lang: "en",
  origin: "https://www.binance.com",
  pragma: "no-cache",
  referer: "https://www.binance.com/en/markets/overview/rwa",
  "user-agent": "discount-hunter/15.2",
};

function upper(value) {
  return String(value || "").trim().toUpperCase();
}

function num(value) {
  const n = Number(String(value ?? "0").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function firstNumber(...values) {
  for (const value of values) {
    const n = num(value);
    if (n > 0) return n;
  }
  return 0;
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
  return item?.symbol || item?.ticker || item?.tokenSymbol || item?.stockSymbol || item?.assetSymbol || item?.data?.symbol;
}

function normalizeRequestedSymbols(symbols) {
  return Array.from(new Set((symbols || []).map(upper).filter(Boolean))).sort();
}

async function fetchJson(url) {
  const cacheBustUrl = `${url}${url.includes("?") ? "&" : "?"}_=${Date.now()}`;
  const response = await fetch(cacheBustUrl, { headers, cache: "no-store" });
  const text = await response.text();
  if (!response.ok) throw new Error(`${url} ${response.status} ${text.slice(0, 180)}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${url} returned non-json: ${text.slice(0, 180)}`);
  }
}

async function getBinanceTokenList() {
  const json = await fetchJson(BINANCE_LIST_URL);
  return asArray(json);
}

async function getBinanceDynamic(item) {
  const chainId = item?.chainId || item?.chainID || item?.chain?.id || 56;
  const contractAddress = item?.contractAddress || item?.address || item?.tokenAddress;
  if (!contractAddress) throw new Error(`missing contractAddress for ${getSymbol(item) || "unknown"}`);
  const url = `${BINANCE_DYNAMIC_URL}?chainId=${encodeURIComponent(chainId)}&contractAddress=${encodeURIComponent(contractAddress)}`;
  return fetchJson(url);
}

function extractPrices(symbol, tokenMeta, dynamicRaw) {
  const root = dynamicRaw?.data || dynamicRaw || {};
  const tokenInfo = root.tokenInfo || root.token || {};
  const stockInfo = root.stockInfo || root.stock || {};

  const rawTokenPrice = firstNumber(tokenInfo.price, root.price);
  const referenceStockPrice = firstNumber(stockInfo.price);
  const sharesMultiplier = firstNumber(
    tokenInfo.sharesMultiplier,
    stockInfo.sharesMultiplier,
    tokenInfo.multiplier,
    stockInfo.multiplier,
    tokenMeta?.sharesMultiplier,
    tokenMeta?.multiplier
  ) || 1;

  const tokenDisplayPrice = rawTokenPrice > 0 ? rawTokenPrice / sharesMultiplier : referenceStockPrice;

  return {
    symbol,
    tokenDisplayPrice,
    referenceStockPrice,
    rawTokenPrice,
    sharesMultiplier,
  };
}

async function fetchLivePricesUncached(requested) {
  if (requested.length === 0) return {};

  const tokenList = await getBinanceTokenList();
  const bySymbol = new Map(tokenList.map((item) => [upper(getSymbol(item)), item]).filter(([symbol]) => symbol));
  const result = {};

  await Promise.all(requested.map(async (symbol) => {
    const tokenMeta = bySymbol.get(symbol);
    if (!tokenMeta) return;
    const dynamic = await getBinanceDynamic(tokenMeta);
    result[symbol] = extractPrices(symbol, tokenMeta, dynamic);
  }));

  return result;
}

async function fetchLivePrices(symbols) {
  const requested = normalizeRequestedSymbols(symbols);
  const key = requested.join(",");
  const now = Date.now();

  if (livePriceCache.promise && livePriceCache.key === key && livePriceCache.expiresAt > now) {
    return livePriceCache.promise;
  }

  const promise = fetchLivePricesUncached(requested).catch((error) => {
    if (livePriceCache.key === key) {
      livePriceCache = { key: "", expiresAt: 0, promise: null };
    }
    throw error;
  });

  livePriceCache = {
    key,
    expiresAt: now + LIVE_PRICE_CACHE_TTL_MS,
    promise,
  };

  return promise;
}

async function fetchTokenPrices(symbols) {
  const livePrices = await fetchLivePrices(symbols);
  const result = {};

  for (const symbol of Object.keys(livePrices)) {
    const item = livePrices[symbol];
    if (item.tokenDisplayPrice > 0) {
      result[symbol] = {
        symbol,
        price: item.tokenDisplayPrice,
        rawTokenPrice: item.rawTokenPrice,
        sharesMultiplier: item.sharesMultiplier,
        source: "binance_xstocks_live",
      };
    }
  }

  return result;
}

async function fetchReferenceStockPrices(symbols) {
  const livePrices = await fetchLivePrices(symbols);
  const result = {};

  for (const symbol of Object.keys(livePrices)) {
    const stockSymbol = PRICE_SYMBOL_MAP[symbol];
    const item = livePrices[symbol];
    if (stockSymbol && item.referenceStockPrice > 0) {
      result[symbol] = {
        symbol,
        stockSymbol,
        price: item.referenceStockPrice,
        source: "binance_stock_reference_live",
      };
    }
  }

  return result;
}

module.exports = {
  fetchTokenPrices,
  fetchReferenceStockPrices,
};
