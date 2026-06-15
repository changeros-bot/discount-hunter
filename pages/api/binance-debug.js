const BINANCE_LIST_URL = "https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/stock/detail/list/ai";
const BINANCE_DYNAMIC_URL = "https://www.binance.com/bapi/defi/v2/public/wallet-direct/buw/wallet/market/token/rwa/dynamic/ai";
const TARGET_SYMBOLS = ["QQQon", "NVDAon", "TSMon", "AVGOon", "SPCXon", "GOOGLon", "AMDon", "MRVLon", "RKLBon"];

const headers = {
  accept: "application/json, text/plain, */*",
  "accept-language": "en-US,en;q=0.9",
  clienttype: "web",
  lang: "en",
  origin: "https://www.binance.com",
  referer: "https://www.binance.com/en/markets/overview/rwa",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
};

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.data?.list)) return value.data.list;
  if (Array.isArray(value?.list)) return value.list;
  return [];
}

function getSymbol(item) {
  return item?.symbol || item?.ticker || item?.tokenSymbol || item?.stockSymbol || item?.assetSymbol || item?.data?.symbol || null;
}

function compactDynamic(symbol, raw) {
  const root = raw?.data || raw || {};
  const tokenInfo = root.tokenInfo || root.token || {};
  const stockInfo = root.stockInfo || root.stock || {};

  return {
    symbol,
    tokenInfoKeys: Object.keys(tokenInfo),
    stockInfoKeys: Object.keys(stockInfo),
    price: tokenInfo.price || root.price || stockInfo.price || null,
    priceHigh52w: stockInfo.priceHigh52w || stockInfo.week52High || stockInfo.fiftyTwoWeekHigh || null,
    priceLow52w: stockInfo.priceLow52w || stockInfo.week52Low || stockInfo.fiftyTwoWeekLow || null,
    marketCap: stockInfo.marketCap || tokenInfo.marketCap || root.marketCap || null,
    volume: stockInfo.volume || tokenInfo.volume24h || root.volume || null,
    sharesMultiplier: tokenInfo.sharesMultiplier || stockInfo.sharesMultiplier || null
  };
}

async function fetchJson(url) {
  const response = await fetch(url, { headers });
  const text = await response.text();
  if (!response.ok) throw new Error(`${url} ${response.status} ${text.slice(0, 180)}`);
  return JSON.parse(text);
}

export default async function handler(req, res) {
  try {
    const listRaw = await fetchJson(BINANCE_LIST_URL);
    const items = asArray(listRaw);
    const bySymbol = new Map(items.map((item) => [getSymbol(item), item]).filter(([symbol]) => symbol));
    const requested = String(req.query.symbol || "").trim();
    const symbols = requested ? [requested] : TARGET_SYMBOLS;

    const samples = await Promise.all(
      symbols
        .map((symbol) => bySymbol.get(symbol))
        .filter(Boolean)
        .map(async (item) => {
          const symbol = getSymbol(item);
          const chainId = item?.chainId || item?.chainID || item?.chain?.id || 56;
          const contractAddress = item?.contractAddress || item?.address || item?.tokenAddress;
          const dynamicUrl = `${BINANCE_DYNAMIC_URL}?chainId=${encodeURIComponent(chainId)}&contractAddress=${encodeURIComponent(contractAddress)}`;
          const dynamicRaw = await fetchJson(dynamicUrl);
          return compactDynamic(symbol, dynamicRaw);
        })
    );

    return res.status(200).json({
      ok: true,
      source: "Binance xStocks public API",
      itemCount: items.length,
      matchedSymbols: symbols.filter((symbol) => bySymbol.has(symbol)),
      missingSymbols: symbols.filter((symbol) => !bySymbol.has(symbol)),
      samples
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      reason: "binance_xstocks_debug_failed",
      message: error.message
    });
  }
}
