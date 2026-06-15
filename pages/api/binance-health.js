const BINANCE_LIST_URL = "https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/stock/detail/list/ai";

const EXPECTED_SYMBOLS = [
  "QQQon",
  "NVDAon",
  "TSMon",
  "AVGOon",
  "SPCXon",
  "GOOGLon",
  "AMDon",
  "MRVLon",
  "RKLBon"
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

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  const startedAt = Date.now();

  try {
    const response = await fetch(`${BINANCE_LIST_URL}?_=${Date.now()}`, { headers, cache: "no-store" });
    const text = await response.text();
    const latencyMs = Date.now() - startedAt;

    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      return res.status(502).json({
        ok: false,
        status: "down",
        label: "🔴 Binance API回傳非JSON",
        httpStatus: response.status,
        latencyMs,
        checkedAt: new Date().toISOString(),
        preview: text.slice(0, 260)
      });
    }

    const items = asArray(json);
    const availableSymbols = items.map(getSymbol).filter(Boolean);
    const missing = EXPECTED_SYMBOLS.filter((symbol) => !availableSymbols.includes(symbol));
    const found = EXPECTED_SYMBOLS.filter((symbol) => availableSymbols.includes(symbol));
    const healthy = response.ok && missing.length === 0;

    return res.status(200).json({
      ok: healthy,
      status: healthy ? "healthy" : "degraded",
      label: healthy ? "🟢 Binance API正常" : "🟡 Binance API部分異常",
      source: "Binance xStocks public API",
      httpStatus: response.status,
      checkedAt: new Date().toISOString(),
      latencyMs,
      symbolsExpected: EXPECTED_SYMBOLS.length,
      symbolsFound: found.length,
      found,
      missing,
      totalBinanceItems: items.length,
      sampleSymbols: availableSymbols.slice(0, 12)
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      status: "down",
      label: "🔴 Binance API連線失敗",
      reason: "binance_xstocks_health_check_failed",
      message: error.message,
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      symbolsExpected: EXPECTED_SYMBOLS.length,
      symbolsFound: 0,
      found: [],
      missing: EXPECTED_SYMBOLS
    });
  }
}
