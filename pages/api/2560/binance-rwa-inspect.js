const BINANCE_LIST_URL = "https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/stock/detail/list/ai";
const BINANCE_DYNAMIC_URL = "https://www.binance.com/bapi/defi/v2/public/wallet-direct/buw/wallet/market/token/rwa/dynamic/ai";

const headers = {
  accept: "application/json, text/plain, */*",
  "accept-language": "en-US,en;q=0.9",
  "cache-control": "no-cache",
  clienttype: "web",
  lang: "en",
  origin: "https://www.binance.com",
  pragma: "no-cache",
  referer: "https://www.binance.com/en/markets/overview/rwa",
  "user-agent": "discount-hunter-2560-rwa-inspector/1.0",
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

function symbolOf(item) {
  return String(item?.symbol || item?.ticker || item?.tokenSymbol || item?.stockSymbol || item?.assetSymbol || "").toUpperCase();
}

async function fetchJson(url) {
  const response = await fetch(`${url}${url.includes("?") ? "&" : "?"}_=${Date.now()}`, { headers, cache: "no-store" });
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status}:${text.slice(0, 160)}`);
  return JSON.parse(text);
}

function inspect(value, depth = 0) {
  if (depth > 5) return { type: typeof value, truncated: true };
  if (Array.isArray(value)) {
    return {
      type: "array",
      length: value.length,
      sample: value.length ? inspect(value[0], depth + 1) : null,
    };
  }
  if (value && typeof value === "object") {
    const result = { type: "object", keys: Object.keys(value) };
    const children = {};
    for (const [key, child] of Object.entries(value)) {
      if (child && (typeof child === "object" || Array.isArray(child))) children[key] = inspect(child, depth + 1);
    }
    if (Object.keys(children).length) result.children = children;
    return result;
  }
  return { type: value === null ? "null" : typeof value };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  try {
    const requested = String(req.query.symbol || "AAPLon").trim().toUpperCase();
    const listPayload = await fetchJson(BINANCE_LIST_URL);
    const item = asArray(listPayload).find((row) => symbolOf(row) === requested);
    if (!item) return res.status(404).json({ ok: false, error: "symbol_not_found", requested });

    const chainId = item?.chainId || item?.chainID || item?.chain?.id || 56;
    const contractAddress = item?.contractAddress || item?.address || item?.tokenAddress;
    if (!contractAddress) return res.status(422).json({ ok: false, error: "missing_contract_identifier", requested });

    const dynamic = await fetchJson(`${BINANCE_DYNAMIC_URL}?chainId=${encodeURIComponent(chainId)}&contractAddress=${encodeURIComponent(contractAddress)}`);
    return res.status(200).json({
      ok: true,
      requested,
      chainId,
      contractAddress,
      listShape: inspect(item),
      dynamicShape: inspect(dynamic),
      note: "Only key names, array lengths and value types are returned; no sensitive account data is involved.",
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
}
