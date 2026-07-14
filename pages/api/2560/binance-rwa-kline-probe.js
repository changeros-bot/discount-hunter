const LIST_URL = "https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/stock/detail/list/ai";
const BASE = "https://www.binance.com";
const headers = {
  accept: "application/json, text/plain, */*",
  "accept-language": "en-US,en;q=0.9",
  "cache-control": "no-cache",
  clienttype: "web",
  lang: "en",
  origin: "https://www.binance.com",
  pragma: "no-cache",
  referer: "https://www.binance.com/en/markets/overview/rwa",
  "user-agent": "discount-hunter-2560-kline-probe/1.0",
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
function symbolOf(item) { return String(item?.symbol || item?.ticker || "").toUpperCase(); }
async function request(url) {
  const started = Date.now();
  const response = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(9000) });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return {
    status: response.status,
    latencyMs: Date.now() - started,
    contentType: response.headers.get("content-type"),
    jsonShape: json ? shape(json) : null,
    preview: json ? undefined : text.slice(0, 120),
  };
}
function shape(value, depth = 0) {
  if (depth > 3) return { type: typeof value, truncated: true };
  if (Array.isArray(value)) return { type: "array", length: value.length, sample: value.length ? shape(value[0], depth + 1) : null };
  if (value && typeof value === "object") {
    const children = {};
    for (const [key, child] of Object.entries(value)) if (child && typeof child === "object") children[key] = shape(child, depth + 1);
    return { type: "object", keys: Object.keys(value), ...(Object.keys(children).length ? { children } : {}) };
  }
  return { type: value === null ? "null" : typeof value };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "method_not_allowed" });
  try {
    const list = await request(`${LIST_URL}?_=${Date.now()}`);
    const listResponse = await fetch(`${LIST_URL}?_=${Date.now()}`, { headers, cache: "no-store" });
    const listJson = await listResponse.json();
    const requested = String(req.query.symbol || "AAPLon").toUpperCase();
    const item = asArray(listJson).find((row) => symbolOf(row) === requested);
    if (!item) return res.status(404).json({ ok: false, requested, list });
    const chainId = item.chainId || "1";
    const contractAddress = item.contractAddress;
    const common = `chainId=${encodeURIComponent(chainId)}&contractAddress=${encodeURIComponent(contractAddress)}&interval=1d&limit=100`;
    const candidates = [
      `/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/kline/ai?${common}`,
      `/bapi/defi/v2/public/wallet-direct/buw/wallet/market/token/rwa/kline/ai?${common}`,
      `/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/stock/kline/ai?${common}`,
      `/bapi/defi/v2/public/wallet-direct/buw/wallet/market/token/rwa/stock/kline/ai?${common}`,
      `/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/chart/ai?${common}`,
      `/bapi/defi/v2/public/wallet-direct/buw/wallet/market/token/rwa/chart/ai?${common}`,
      `/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/stock/chart/ai?${common}`,
      `/bapi/defi/v2/public/wallet-direct/buw/wallet/market/token/rwa/stock/chart/ai?${common}`,
    ];
    const results = [];
    for (const path of candidates) {
      try { results.push({ path, ...(await request(`${BASE}${path}`)) }); }
      catch (error) { results.push({ path, error: error.message }); }
    }
    return res.status(200).json({ ok: true, requested, chainId, contractAddress, results });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
}
