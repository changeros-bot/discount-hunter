import { getAssetRegistry } from "../../lib/v17-asset-registry";
import { fetchYahooStockQuotes, PAPER_STOCK_SYMBOLS } from "../../lib/v17-paper-stock-quotes";
import { getAllPaperDiscountRules } from "../../lib/v17-paper-discount-rules";

const BINANCE_LIST_URL = "https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/stock/detail/list/ai";
const BINANCE_DYNAMIC_URL = "https://www.binance.com/bapi/defi/v2/public/wallet-direct/buw/wallet/market/token/rwa/dynamic/ai";
const BINANCE_WEB_PRODUCTS_URL = "https://www.binance.com/bapi/asset/v2/public/asset-service/product/get-products?includeEtf=true";

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
    cycleHighDate: asset.cycleHighDate,
    cycleHighSource: asset.cycleHighSource,
    cycleHighUpdateRule: asset.cycleHighUpdateRule,
    unitAmount: asset.unitAmount,
    capitalUnits: asset.capitalUnits,
  };
}

function getWatchlist() {
  return getAssetRegistry().filter((asset) => String(asset.assetType || "").startsWith("tokenized_stock")).map(mapAsset);
}

function getCryptoWatchlist() {
  return getAssetRegistry().filter((asset) => asset.assetType === "crypto").map(mapAsset);
}

const headers = {
  accept: "application/json, text/plain, */*",
  "accept-language": "en-US,en;q=0.9",
  "cache-control": "no-cache",
  clienttype: "web",
  lang: "en",
  origin: "https://www.binance.com",
  pragma: "no-cache",
  referer: "https://www.binance.com/en/markets/overview",
  "user-agent": "Mozilla/5.0 (V17 Discount Hunter) binance-web",
};

function getSignal(discount, rules = [], amounts = []) {
  for (let i = rules.length - 1; i >= 0; i -= 1) {
    if (discount <= Number(rules[i])) return { text: `第${i + 1}買點`, amount: `${amounts[i] || 0}U`, level: i + 1 };
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
  return item?.symbol || item?.ticker || item?.tokenSymbol || item?.stockSymbol || item?.assetSymbol || item?.s || item?.data?.symbol;
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
  const root = dynamicResult?.json?.data || dynamicResult?.json || {};
  const tokenInfo = root.tokenInfo || root.token || {};
  const stockInfo = root.stockInfo || root.stock || {};
  const rawTokenPrice = firstNumber(tokenInfo.price, root.price);
  const stockPrice = firstNumber(stockInfo.price);
  const sharesMultiplier = firstNumber(tokenInfo.sharesMultiplier, stockInfo.sharesMultiplier, tokenInfo.multiplier, stockInfo.multiplier, tokenMeta?.sharesMultiplier, tokenMeta?.multiplier) || 1;
  const displayPrice = rawTokenPrice > 0 ? rawTokenPrice / sharesMultiplier : stockPrice;
  const high = firstNumber(stockInfo.priceHigh52w, stockInfo.week52High, stockInfo.fiftyTwoWeekHigh);
  const low = firstNumber(stockInfo.priceLow52w, stockInfo.week52Low, stockInfo.fiftyTwoWeekLow);
  const stockDiffPct = pctDiff(displayPrice, stockPrice);
  const rawDiffPct = pctDiff(rawTokenPrice, displayPrice);
  const priceAuditAbsPct = stockDiffPct === null ? null : Math.abs(stockDiffPct);
  const discountRaw = high > 0 && displayPrice > 0 ? ((displayPrice - high) / high) * 100 : null;
  const discount = discountRaw === null ? null : Number(discountRaw.toFixed(1));
  return {
    ...asset,
    price: displayPrice,
    rawTokenPrice,
    tokenPrice: displayPrice,
    stockPrice,
    high,
    low,
    high52w: high,
    low52w: low,
    marketCap: firstNumber(stockInfo.marketCap, tokenInfo.marketCap, root.marketCap),
    volume: firstNumber(stockInfo.volume, tokenInfo.volume24h, root.volume),
    sharesMultiplier,
    highType: "Binance 52週高點",
    lowType: "Binance 52週低點",
    priceSource: "Binance tokenInfo.price / sharesMultiplier",
    discount,
    discountRaw,
    signal: discount === null ? { text: "資料未就緒", amount: "0U", level: 0 } : getSignal(discount, asset.rules, asset.amounts),
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
      note: "App 價格=Binance tokenInfo.price / sharesMultiplier；與 stockInfo.price 比較作為自動稽核。",
    },
  };
}

async function getBtcPriceFromBinanceWeb() {
  const result = await fetchJson(BINANCE_WEB_PRODUCTS_URL);
  const rows = asArray(result.json?.data || result.json);
  const btc = rows.find((row) => String(row?.s || row?.symbol || "").toUpperCase() === "BTCUSDT");
  const price = firstNumber(btc?.c, btc?.close, btc?.price, btc?.lastPrice);
  if (!price) throw new Error("BTCUSDT missing in Binance web products response");
  return { price, latencyMs: result.latencyMs, status: result.status };
}

async function getBtcMarket(asset) {
  try {
    const priceResult = await getBtcPriceFromBinanceWeb();
    const price = priceResult.price;
    const cycleHigh = firstNumber(asset.cycleHigh);
    const discountRaw = cycleHigh > 0 && price > 0 ? ((price - cycleHigh) / cycleHigh) * 100 : null;
    const discount = discountRaw === null ? null : Number(discountRaw.toFixed(1));
    return {
      ...asset,
      price,
      rawTokenPrice: price,
      tokenPrice: price,
      stockPrice: price,
      high: cycleHigh,
      high52w: cycleHigh,
      cycleHigh,
      low: 0,
      marketCap: 0,
      volume: 0,
      sharesMultiplier: 1,
      highType: "BTC Cycle High",
      lowType: "N/A",
      priceSource: "Binance Web BTCUSDT",
      discount,
      discountRaw,
      signal: discount === null ? { text: "資料未就緒", amount: "0U", level: 0 } : getSignal(discount, asset.rules, asset.amounts),
      binanceAudit: { status: price > 0 && cycleHigh > 0 ? "PASS" : "MISSING_BTC_DATA", checkedAt: new Date().toISOString(), latencyMs: priceResult.latencyMs || 0 },
    };
  } catch (error) {
    const cycleHigh = firstNumber(asset.cycleHigh);
    return { ...asset, price: 0, rawTokenPrice: 0, tokenPrice: 0, stockPrice: 0, high: cycleHigh, high52w: cycleHigh, low: 0, priceSource: "Binance Web BTCUSDT", discount: null, discountRaw: null, signal: { text: "BTC 資料未就緒", amount: "0U", level: 0 }, binanceAudit: { status: "BTC_PROVIDER_ERROR", checkedAt: new Date().toISOString(), error: error.message } };
  }
}

function buildPaperStockAssetMap() {
  const discountRules = getAllPaperDiscountRules();
  return Object.fromEntries(PAPER_STOCK_SYMBOLS.map((symbol) => {
    const rule = discountRules[symbol] || {};
    return [symbol, {
      symbol,
      name: symbol,
      assetType: "paper_stock",
      engine: "paper_test",
      strategy: "paper_discount_quote",
      rules: rule.rules || [],
      amounts: rule.amounts || [],
      discountModel: "paper_stock_yahoo_quote_v1",
      referenceMode: "52w_high_or_fallback",
      profile: rule.profile || "paper_stock",
      ruleNote: rule.note || "Market paper stock quote",
    }];
  }));
}

function dedupeBySymbol(rows = []) {
  const map = new Map();
  for (const row of rows) {
    const key = String(row?.symbol || "").toUpperCase();
    if (!key) continue;
    if (!map.has(key)) map.set(key, row);
  }
  return [...map.values()];
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  try {
    const watchlist = getWatchlist();
    const cryptoWatchlist = getCryptoWatchlist();
    const paperStockAssetMap = buildPaperStockAssetMap();

    const [tokenListResult, paperStockData] = await Promise.all([
      getBinanceTokenList(),
      fetchYahooStockQuotes(PAPER_STOCK_SYMBOLS, paperStockAssetMap),
    ]);

    const tokenList = tokenListResult.list;
    const bySymbol = new Map(tokenList.map((item) => [getSymbol(item), item]).filter(([symbol]) => symbol));
    const xstockData = await Promise.all(watchlist.map(async (asset) => {
      const tokenMeta = bySymbol.get(asset.symbol);
      if (!tokenMeta) {
        return { ...asset, price: 0, rawTokenPrice: 0, tokenPrice: 0, stockPrice: 0, high: 0, low: 0, high52w: 0, low52w: 0, marketCap: 0, volume: 0, sharesMultiplier: 1, highType: "Binance 52週高點", lowType: "Binance 52週低點", priceSource: "Binance tokenInfo.price / sharesMultiplier", discount: null, discountRaw: null, signal: { text: "資料未就緒", amount: "0U", level: 0 }, binanceAudit: { status: "MISSING_TOKEN", checkedAt: new Date().toISOString() } };
      }
      const dynamic = await getBinanceDynamic(tokenMeta);
      return normalize(asset, tokenMeta, dynamic);
    }));
    const cryptoData = await Promise.all(cryptoWatchlist.map(getBtcMarket));
    const data = dedupeBySymbol([...cryptoData, ...xstockData, ...paperStockData]);
    const auditSummary = data.reduce((summary, item) => {
      const status = item.binanceAudit?.status || item.quoteAudit?.status || "UNKNOWN";
      summary[status] = (summary[status] || 0) + 1;
      return summary;
    }, {});
    res.status(200).json({
      updatedAt: new Date().toISOString(),
      source: "Binance xStocks + Binance Web BTCUSDT + Yahoo Finance paper stock quotes",
      sourceOfTruth: "lib/v17-asset-registry.js + lib/v17-paper-stock-quotes.js",
      count: data.length,
      cachePolicy: "no-store",
      binanceHealth: { ok: true, listStatus: tokenListResult.status, listLatencyMs: tokenListResult.latencyMs, auditSummary },
      paperQuoteHealth: { symbols: PAPER_STOCK_SYMBOLS.length, auditSummary },
      data,
    });
  } catch (error) {
    res.status(500).json({ error: "prices_fetch_failed", message: error.message });
  }
}
