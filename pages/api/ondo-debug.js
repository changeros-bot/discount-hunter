const ONDO_ALL_MARKET_URL = "https://api.gm.ondo.finance/v1/assets/all/market";
const TARGET_SYMBOLS = ["QQQon", "NVDAon", "TSMon", "AVGOon", "SPCXon", "GOOGLon", "AMDon", "MRVLon", "RKLBon"];

function getMarketItems(raw) {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw.data;
  if (Array.isArray(raw?.assets)) return raw.assets;
  if (Array.isArray(raw?.markets)) return raw.markets;
  if (Array.isArray(raw?.data?.assets)) return raw.data.assets;
  if (Array.isArray(raw?.data?.markets)) return raw.data.markets;
  return [];
}

function getSymbol(item) {
  return item?.symbol || item?.ticker || item?.assetSymbol || item?.asset?.symbol || item?.token?.symbol || item?.data?.symbol || null;
}

function compactMarket(item) {
  const root = item?.data || item || {};
  const primary = root.primaryMarket || {};
  const underlying = root.underlyingMarket || {};

  return {
    symbol: getSymbol(item),
    primaryMarketKeys: Object.keys(primary),
    underlyingMarketKeys: Object.keys(underlying),
    price: primary.price || primary.currentPrice || primary.lastPrice || underlying.price || root.price || null,
    priceHigh52w: underlying.priceHigh52w || underlying.week52High || underlying.fiftyTwoWeekHigh || root.priceHigh52w || root.week52High || null,
    priceLow52w: underlying.priceLow52w || underlying.week52Low || underlying.fiftyTwoWeekLow || root.priceLow52w || root.week52Low || null,
    marketCap: underlying.marketCap || root.marketCap || null,
    volume: underlying.volume || root.volume || null
  };
}

export default async function handler(req, res) {
  const key = process.env.ONDO_API_KEY;

  if (!key) {
    return res.status(200).json({
      ok: false,
      reason: "missing_ondo_api_key"
    });
  }

  try {
    const response = await fetch(ONDO_ALL_MARKET_URL, {
      headers: { "x-api-key": key, accept: "application/json" }
    });

    const raw = await response.json();
    const items = getMarketItems(raw);
    const bySymbol = new Map(items.map((item) => [getSymbol(item), item]).filter(([symbol]) => symbol));
    const requested = String(req.query.symbol || "").trim();
    const symbols = requested ? [requested] : TARGET_SYMBOLS;

    return res.status(200).json({
      ok: response.ok,
      status: response.status,
      itemCount: items.length,
      matchedSymbols: symbols.filter((symbol) => bySymbol.has(symbol)),
      missingSymbols: symbols.filter((symbol) => !bySymbol.has(symbol)),
      samples: symbols.map((symbol) => bySymbol.get(symbol)).filter(Boolean).map(compactMarket)
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      reason: "ondo_debug_failed",
      message: error.message
    });
  }
}
