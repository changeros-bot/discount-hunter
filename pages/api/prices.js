import { getAssetRegistry } from "../../lib/v17-asset-registry";

const BINANCE_LIST_URL = "https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/stock/detail/list/ai";
const BINANCE_DYNAMIC_URL = "https://www.binance.com/bapi/defi/v2/public/wallet-direct/buw/wallet/market/token/rwa/dynamic/ai";
const BINANCE_BTC_PRICE_URL = "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT";
const BINANCE_BTC_KLINES_URL = "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1w&limit=52";

function mapAsset(asset) {
  return {
    symbol: asset.symbol,
    name: asset.name,
    grade: asset.conviction,
    description: asset.description || asset.name,
    rules: asset.rules || [],
    amounts: asset.amounts || [],
    assetStatus: asset.status,
    assetType: asset.assetType,
    engine: asset.engine,
    strategy: asset.strategy,
    discountModel: asset.discountModel,
    referenceMode: asset.referenceMode,
    updatePolicy: asset.updatePolicy,
    cycleHigh: asset.cycleHigh,
    cycleHighSource: asset.cycleHighSource,
    unitAmount: asset.unitAmount,
    capitalUnits: asset.capitalUnits
  };
}

function getWatchlist() {
  return getAssetRegistry()
    .filter((asset) => String(asset.assetType || "").startsWith("tokenized_stock"))
    .map(mapAsset);
}

function getCryptoWatchlist() {
  return getAssetRegistry()
    .filter((asset) => asset.assetType === "crypto")
    .map(mapAsset);
}

const headers = {
  accept: "application/json, text/plain, */*",
  "accept-language": "en-US,en;q=0.9",
  "cache-control": "no-cache",
  clienttype: "web",
  lang: "en",
  origin: "https://www.binance.com",
  pragma: "no-cache",
  referer: "https://www.binance.com/en/markets/overview/rwa",
  "user-agent": "binance-web3/1.1 (Skill)"
};

function getSignal(discount, rules, amounts) {
  for (let i = rules.length - 1; i >= 0; i--) {
    if (discount <= rules[i]) return { text: `第${i + 1}買點`, amount: `${amounts[i]}U`, level: i + 1 };
  }
  return { text: "尚未到買點", amount: "0U", level: 0 };
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

function pctDiff(a, b) {
  const x = num(a);
  const y = num(b);
  if (x <= 0 || y <= 0) return null;
  return Number((((x - y) / y) * 100).toFixed(4));
}

function auditStatus(absPct) {
  if (absPct === null) return "UNKNOWN";
  if (absPct <= 0.2) return "PASS";
  if (absPct <= 0.5) return "WATCH";
  return "ALERT";
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

async function fetchJson(url) {
  const cacheBustUrl = `${url}${url.includes("?") ? "&" : "?"}_=${Date.now()}`;
  const startedAt = Date.now();
  const response = await fetch(cacheBustUrl, { headers, cache: "no-store" });
  const text = await response.text();
  const latencyMs = Date.now() - startedAt;
  if (!response.ok) throw new Error(`${url} ${response.status} ${text.slice(0, 180)}`);
  try {
    const json = JSON.parse(text);
    return { json, latencyMs, status: response.status };
  } catch {
    throw new Error(`${url} returned non-json: ${text.slice(0, 180)}`);
  }
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
  const result = await fetchJson(url);
  return { ...result, chainId, contractAddress };
}

function normalize(asset, tokenMeta, dynamicResult) {
  const dynamicRaw = dynamicResult?.json;
  const root = dynamicRaw?.data || dynamicRaw || {};
  const tokenInfo = root.tokenInfo || root.token || {};
  const stockInfo = root.stockInfo || root.stock || {};
  const rawTokenPrice = firstNumber(tokenInfo.price, root.price);
  const stockPrice = firstNumber(stockInfo.price);
  const sharesMultiplier = firstNumber(tokenInfo.sharesMultiplier, stockInfo.sharesMultiplier, tokenInfo.multiplier, stockInfo.multiplier, tokenMeta?.sharesMultiplier, tokenMeta?.multiplier) || 1;
  const displayPrice = rawTokenPrice > 0 ? rawTokenPrice / sharesMultiplier : stockPrice;
  const high = firstNumber(stockInfo.priceHigh52w, stockInfo.week52High, stockInfo.fiftyTwoWeekHigh);
  const low = firstNumber(stockInfo.priceLow52w, stockInfo.week52Low, stockInfo.fiftyTwoWeekLow);
  const marketCap = firstNumber(stockInfo.marketCap, tokenInfo.marketCap, root.marketCap);
  const volume = firstNumber(stockInfo.volume, tokenInfo.volume24h, root.volume);
  const stockDiffPct = pctDiff(displayPrice, stockPrice);
  const rawDiffPct = pctDiff(rawTokenPrice, displayPrice);
  const priceAuditAbsPct = stockDiffPct === null ? null : Math.abs(stockDiffPct);
  const discountRaw = high > 0 && displayPrice > 0 ? ((displayPrice - high) / high) * 100 : null;
  const discount = discountRaw === null ? null : Number(discountRaw.toFixed(1));
  const signal = discount === null ? { text: "資料未就緒", amount: "0U", level: 0 } : getSignal(discount, asset.rules, asset.amounts);
  return {
    ...asset,
    price: displayPrice,
    rawTokenPrice,
    tokenPrice: displayPrice,
    stockPrice,
    high,
    low,
    marketCap,
    volume,
    sharesMultiplier,
    highType: "Binance 52週高點",
    lowType: "Binance 52週低點",
    priceSource: "Binance tokenInfo.price / sharesMultiplier",
    discount,
    discountRaw,
    signal,
    binanceAudit: {
      status: auditStatus(priceAuditAbsPct),
      appPrice: displayPrice,
      rawTokenPrice,
      stockPrice,
      sharesMultiplier,
      tokenVsDisplayDiffPct: rawDiffPct,
      displayVsStockDiffPct: stockDiffPct,
      absDisplayVsStockDiffPct: priceAuditAbsPct,
      latencyMs: dynamicResult?.latencyMs ?? null,
      chainId: dynamicResult?.chainId,
      contractAddress: dynamicResult?.contractAddress,
      checkedAt: new Date().toISOString(),
      note: "App 價格=Binance tokenInfo.price / sharesMultiplier；與 stockInfo.price 比較作為自動稽核。"
    }
  };
}

async function getBtcMarket(asset) {
  const [priceResult, klinesResult] = await Promise.all([
    fetchJson(BINANCE_BTC_PRICE_URL),
    fetchJson(BINANCE_BTC_KLINES_URL)
  ]);
  const price = firstNumber(priceResult.json?.price);
  const weeklyRows = Array.isArray(klinesResult.json) ? klinesResult.json : [];
  const rolling52wHigh = weeklyRows.reduce((max, row) => Math.max(max, firstNumber(row?.[2])), 0);
  const low = weeklyRows.reduce((min, row) => {
    const value = firstNumber(row?.[3]);
    return value > 0 ? Math.min(min || value, value) : min;
  }, 0);
  const cycleHigh = firstNumber(asset.cycleHigh, rolling52wHigh);
  const discountRaw = cycleHigh > 0 && price > 0 ? ((price - cycleHigh) / cycleHigh) * 100 : null;
  const discount = discountRaw === null ? null : Number(discountRaw.toFixed(1));
  const signal = discount === null ? { text: "資料未就緒", amount: "0U", level: 0 } : getSignal(discount, asset.rules, asset.amounts);
  return {
    ...asset,
    price,
    rawTokenPrice: price,
    tokenPrice: price,
    stockPrice: price,
    high: cycleHigh,
    cycleHigh,
    rolling52wHigh,
    low,
    marketCap: 0,
    volume: 0,
    sharesMultiplier: 1,
    highType: "BTC Cycle High",
    lowType: "Binance BTCUSDT 52週週K低點",
    priceSource: "Binance Spot BTCUSDT",
    discount,
    discountRaw,
    signal,
    binanceAudit: {
      status: price > 0 && cycleHigh > 0 ? "PASS" : "MISSING_BTC_DATA",
      appPrice: price,
      rawTokenPrice: price,
      stockPrice: price,
      sharesMultiplier: 1,
      latencyMs: Math.max(priceResult.latencyMs || 0, klinesResult.latencyMs || 0),
      checkedAt: new Date().toISOString(),
      note: `BTC 使用 Registry Cycle High=${cycleHigh} 作為 V17 anchor；52週高點僅作參考 rolling52wHigh=${rolling52wHigh}。`
    }
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  try {
    const watchlist = getWatchlist();
    const cryptoWatchlist = getCryptoWatchlist();
    const tokenListResult = await getBinanceTokenList();
    const tokenList = tokenListResult.list;
    const bySymbol = new Map(tokenList.map((item) => [getSymbol(item), item]).filter(([symbol]) => symbol));
    const xstockData = await Promise.all(watchlist.map(async (asset) => {
      const tokenMeta = bySymbol.get(asset.symbol);
      if (!tokenMeta) {
        return { ...asset, price: 0, rawTokenPrice: 0, tokenPrice: 0, stockPrice: 0, high: 0, low: 0, marketCap: 0, volume: 0, sharesMultiplier: 1, highType: "Binance 52週高點", lowType: "Binance 52週低點", priceSource: "Binance tokenInfo.price / sharesMultiplier", discount: null, discountRaw: null, signal: { text: "資料未就緒", amount: "0U", level: 0 }, binanceAudit: { status: "MISSING_TOKEN", checkedAt: new Date().toISOString() } };
      }
      const dynamic = await getBinanceDynamic(tokenMeta);
      return normalize(asset, tokenMeta, dynamic);
    }));
    const cryptoData = await Promise.all(cryptoWatchlist.map(getBtcMarket));
    const data = [...cryptoData, ...xstockData];
    const auditSummary = data.reduce((summary, item) => { const status = item.binanceAudit?.status || "UNKNOWN"; summary[status] = (summary[status] || 0) + 1; return summary; }, {});
    res.status(200).json({ updatedAt: new Date().toISOString(), source: "Binance xStocks + BTCUSDT public API｜V17 Asset Registry", sourceOfTruth: "lib/v17-asset-registry.js", count: data.length, cachePolicy: "no-store", binanceHealth: { ok: true, listStatus: tokenListResult.status, listLatencyMs: tokenListResult.latencyMs, auditSummary }, data });
  } catch (error) {
    res.status(500).json({ error: "binance_prices_fetch_failed", message: error.message });
  }
}
