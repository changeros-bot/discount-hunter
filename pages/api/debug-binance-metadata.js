const { WATCHLIST } = require("../../lib/xstocks/constants");

const BINANCE_LIST_URL = "https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/stock/detail/list/ai";

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

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.data?.list)) return value.data.list;
  if (Array.isArray(value?.data?.rows)) return value.data.rows;
  if (Array.isArray(value?.list)) return value.list;
  if (Array.isArray(value?.rows)) return value.rows;
  return [];
}

function upper(value) {
  return String(value || "").trim().toUpperCase();
}

function getSymbol(item) {
  return item?.symbol || item?.ticker || item?.tokenSymbol || item?.stockSymbol || item?.assetSymbol || item?.data?.symbol;
}

function findBySymbol(tokenList, symbols) {
  const requested = new Set(symbols.map(upper));
  return tokenList.filter((item) => requested.has(upper(getSymbol(item))));
}

function collectKeys(value, prefix = "root", out = []) {
  if (!value || typeof value !== "object") return out;
  if (Array.isArray(value)) {
    value.slice(0, 3).forEach((item, index) => collectKeys(item, `${prefix}[${index}]`, out));
    return out;
  }
  for (const [key, child] of Object.entries(value)) {
    const path = `${prefix}.${key}`;
    out.push({ path, type: Array.isArray(child) ? "array" : typeof child });
    if (child && typeof child === "object") collectKeys(child, path, out);
  }
  return out;
}

function collectPossibleAddresses(value, path = "root", out = []) {
  if (value == null) return out;
  if (typeof value === "string") {
    const clean = value.trim();
    const looksLikeEvm = /^0x[a-fA-F0-9]{40}$/.test(clean);
    const looksLikeAddressKey = path.toLowerCase().includes("address") || path.toLowerCase().includes("contract");
    if (looksLikeEvm || looksLikeAddressKey) out.push({ path, value: clean, looksLikeEvm });
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectPossibleAddresses(item, `${path}[${index}]`, out));
    return out;
  }
  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value)) collectPossibleAddresses(child, `${path}.${key}`, out);
  }
  return out;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const symbols = req.query.symbols
      ? String(req.query.symbols).split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
      : WATCHLIST;

    const response = await fetch(`${BINANCE_LIST_URL}?_=${Date.now()}`, { headers, cache: "no-store" });
    const text = await response.text();
    let raw;
    try {
      raw = JSON.parse(text);
    } catch {
      return res.status(502).json({ error: "Binance returned non-json", status: response.status, sample: text.slice(0, 500) });
    }

    const tokenList = asArray(raw);
    const matched = findBySymbol(tokenList, symbols);

    return res.status(200).json({
      ok: true,
      checkedAt: new Date().toISOString(),
      httpStatus: response.status,
      rawTopLevelKeys: raw && typeof raw === "object" ? Object.keys(raw) : [],
      tokenListCount: tokenList.length,
      requestedSymbols: symbols,
      matchedCount: matched.length,
      matched: matched.map((item) => ({
        symbol: getSymbol(item),
        topLevelKeys: Object.keys(item || {}),
        keyMap: collectKeys(item).slice(0, 200),
        possibleAddresses: collectPossibleAddresses(item),
        raw: item,
      })),
      rawSample: tokenList.slice(0, 3),
    });
  } catch (error) {
    console.error("debug-binance-metadata error:", error);
    return res.status(500).json({ error: error.message || "Unknown error" });
  }
};
