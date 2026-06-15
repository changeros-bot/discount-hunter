const BINANCE_LIST_URL = "https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/stock/detail/list/ai";
const BINANCE_DYNAMIC_URL = "https://www.binance.com/bapi/defi/v2/public/wallet-direct/buw/wallet/market/token/rwa/dynamic/ai";

const watchlist = [
  { symbol: "QQQon", name: "Invesco QQQ", grade: "A+", description: "核心ETF｜Nasdaq 100", rules: [-15, -25, -35, -50], amounts: [5, 10, 15, 20] },
  { symbol: "NVDAon", name: "NVIDIA", grade: "A", description: "AI GPU核心龍頭", rules: [-15, -25, -35, -50], amounts: [5, 10, 15, 20] },
  { symbol: "TSMon", name: "Taiwan Semiconductor", grade: "A", description: "全球先進製程龍頭", rules: [-15, -25, -35, -50], amounts: [5, 10, 15, 20] },
  { symbol: "AVGOon", name: "Broadcom", grade: "A", description: "AI網路 + ASIC龍頭", rules: [-15, -25, -35, -50], amounts: [5, 10, 15, 20] },
  { symbol: "SPCXon", name: "SpaceX", grade: "A-", description: "高成長太空龍頭", rules: [-20, -35, -50, -65], amounts: [5, 10, 15, 20] },
  { symbol: "GOOGLon", name: "Alphabet", grade: "B", description: "AI + 搜尋 + 雲端", rules: [-20, -35, -50, -65], amounts: [5, 10, 15, 20] },
  { symbol: "AMDon", name: "Advanced Micro Devices", grade: "B", description: "AI GPU挑戰者", rules: [-20, -35, -50, -65], amounts: [5, 10, 15, 20] },
  { symbol: "MRVLon", name: "Marvell", grade: "B", description: "AI網通與ASIC供應鏈", rules: [-20, -35, -50, -65], amounts: [5, 10, 15, 20] },
  { symbol: "RKLBon", name: "Rocket Lab", grade: "C", description: "高風險太空成長股", rules: [-25, -40, -60], amounts: [5, 10, 15] }
];

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
  const raw = await fetchJson(BINANCE_LIST_URL);
  return asArray(raw);
}

async function getBinanceDynamic(item) {
  const chainId = item?.chainId || item?.chainID || item?.chain?.id || 56;
  const contractAddress = item?.contractAddress || item?.address || item?.tokenAddress;

  if (!contractAddress) throw new Error(`missing contractAddress for ${getSymbol(item) || "unknown"}`);

  const url = `${BINANCE_DYNAMIC_URL}?chainId=${encodeURIComponent(chainId)}&contractAddress=${encodeURIComponent(contractAddress)}`;
  return fetchJson(url);
}

function normalize(asset, tokenMeta, dynamicRaw) {
  const root = dynamicRaw?.data || dynamicRaw || {};
  const tokenInfo = root.tokenInfo || root.token || {};
  const stockInfo = root.stockInfo || root.stock || {};

  const rawTokenPrice = firstNumber(tokenInfo.price, root.price);
  const stockPrice = firstNumber(stockInfo.price);
  const sharesMultiplier = firstNumber(
    tokenInfo.sharesMultiplier,
    stockInfo.sharesMultiplier,
    tokenInfo.multiplier,
    stockInfo.multiplier,
    tokenMeta?.sharesMultiplier,
    tokenMeta?.multiplier
  ) || 1;

  const displayPrice = rawTokenPrice > 0 ? rawTokenPrice / sharesMultiplier : stockPrice;
  const high = firstNumber(stockInfo.priceHigh52w, stockInfo.week52High, stockInfo.fiftyTwoWeekHigh);
  const low = firstNumber(stockInfo.priceLow52w, stockInfo.week52Low, stockInfo.fiftyTwoWeekLow);
  const marketCap = firstNumber(stockInfo.marketCap, tokenInfo.marketCap, root.marketCap);
  const volume = firstNumber(stockInfo.volume, tokenInfo.volume24h, root.volume);

  const discount = high > 0 && displayPrice > 0 ? Number((((displayPrice - high) / high) * 100).toFixed(1)) : null;
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
    signal
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  try {
    const tokenList = await getBinanceTokenList();
    const bySymbol = new Map(tokenList.map((item) => [getSymbol(item), item]).filter(([symbol]) => symbol));

    const data = await Promise.all(
      watchlist.map(async (asset) => {
        const tokenMeta = bySymbol.get(asset.symbol);

        if (!tokenMeta) {
          return {
            ...asset,
            price: 0,
            rawTokenPrice: 0,
            tokenPrice: 0,
            stockPrice: 0,
            high: 0,
            low: 0,
            marketCap: 0,
            volume: 0,
            sharesMultiplier: 1,
            highType: "Binance 52週高點",
            lowType: "Binance 52週低點",
            priceSource: "Binance tokenInfo.price / sharesMultiplier",
            discount: null,
            signal: { text: "資料未就緒", amount: "0U", level: 0 }
          };
        }

        const dynamic = await getBinanceDynamic(tokenMeta);
        return normalize(asset, tokenMeta, dynamic);
      })
    );

    res.status(200).json({
      updatedAt: new Date().toISOString(),
      source: "Binance xStocks public API",
      count: data.length,
      cachePolicy: "no-store",
      data
    });
  } catch (error) {
    res.status(500).json({ error: "binance_xstocks_fetch_failed", message: error.message });
  }
}
