import fs from "fs";
import path from "path";

const LIST_URL = "https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/stock/detail/list/ai";
const DYNAMIC_URL = "https://www.binance.com/bapi/defi/v2/public/wallet-direct/buw/wallet/market/token/rwa/dynamic/ai";
const PRODUCTS_URL = "https://www.binance.com/bapi/asset/v2/public/asset-service/product/get-products?includeEtf=true";
const headers = {
  accept: "application/json, text/plain, */*",
  "accept-language": "en-US,en;q=0.9",
  "cache-control": "no-cache",
  clienttype: "web",
  lang: "en",
  origin: "https://www.binance.com",
  pragma: "no-cache",
  referer: "https://www.binance.com/en/markets/overview/rwa",
  "user-agent": "discount-hunter-2560-binance-snapshot/1.0",
};

function num(value) {
  const n = Number(String(value ?? "0").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function firstNumber(...values) {
  for (const value of values) { const n = num(value); if (n > 0) return n; }
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
function symbolOf(item) {
  return String(item?.symbol || item?.ticker || item?.tokenSymbol || item?.stockSymbol || item?.assetSymbol || "").trim().toUpperCase();
}
async function fetchJson(url) {
  const response = await fetch(`${url}${url.includes("?") ? "&" : "?"}_=${Date.now()}`, { headers, cache: "no-store", signal: AbortSignal.timeout(12000) });
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status}:${text.slice(0, 140)}`);
  return JSON.parse(text);
}
function loadUniverse() {
  const file = path.join(process.cwd(), "config", "2560-universe.json");
  const payload = JSON.parse(fs.readFileSync(file, "utf8"));
  const seen = new Set();
  return (payload.symbols || []).filter((item) => {
    const ticker = String(item.ticker || "").trim().toUpperCase();
    if (!ticker || seen.has(ticker)) return false;
    seen.add(ticker);
    item.ticker = ticker;
    return true;
  });
}
function tokenCandidates(ticker) {
  const base = String(ticker || "").toUpperCase();
  return [`${base}ON`, base];
}
function normalizeStock(ticker, tokenSymbol, item, dynamic) {
  const root = dynamic?.data || dynamic || {};
  const token = root.tokenInfo || {};
  const stock = root.stockInfo || {};
  const multiplier = firstNumber(token.sharesMultiplier, item?.multiplier) || 1;
  const close = firstNumber(token.price) / multiplier || firstNumber(stock.price);
  const change = num(token.priceChange24h) / multiplier;
  const open = close > 0 ? close - change : 0;
  const high = firstNumber(token.priceHigh24h) / multiplier || Math.max(open, close);
  const low = firstNumber(token.priceLow24h) / multiplier || Math.min(open, close);
  return {
    ticker,
    binance_symbol: tokenSymbol,
    date_utc: new Date().toISOString().slice(0, 10),
    open,
    high,
    low,
    close,
    volume: firstNumber(stock.volume, token.volume24h),
    token_volume_24h: firstNumber(token.volume24h),
    reference_stock_volume: firstNumber(stock.volume),
    shares_multiplier: multiplier,
    stock_price: firstNumber(stock.price),
    market_status: root?.statusInfo?.marketStatus || null,
    source: "binance_rwa_dynamic_24h",
    audit_status: close > 0 && high > 0 && low > 0 ? "PASS" : "INCOMPLETE",
  };
}
async function btcSnapshot() {
  const payload = await fetchJson(PRODUCTS_URL);
  const row = asArray(payload?.data || payload).find((x) => String(x?.s || x?.symbol || "").toUpperCase() === "BTCUSDT");
  const close = firstNumber(row?.c, row?.close, row?.price, row?.lastPrice);
  const open = firstNumber(row?.o, row?.open) || close;
  const high = firstNumber(row?.h, row?.high) || Math.max(open, close);
  const low = firstNumber(row?.l, row?.low) || Math.min(open, close);
  return { ticker: "BTC", binance_symbol: "BTCUSDT", date_utc: new Date().toISOString().slice(0, 10), open, high, low, close, volume: firstNumber(row?.v, row?.volume, row?.q), source: "binance_web_btcusdt_24h", audit_status: close > 0 ? "PASS" : "INCOMPLETE" };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "method_not_allowed" });
  try {
    const universe = loadUniverse();
    const requested = String(req.query.tickers || "").trim().toUpperCase();
    const allow = requested ? new Set(requested.split(",").map((x) => x.trim()).filter(Boolean)) : null;
    const selected = universe.filter((item) => !allow || allow.has(item.ticker));
    const list = asArray(await fetchJson(LIST_URL));
    const bySymbol = new Map(list.map((item) => [symbolOf(item), item]).filter(([key]) => key));
    const rows = [];
    const pending = [];

    for (const item of selected) {
      if (item.ticker === "BTC") {
        try { rows.push(await btcSnapshot()); } catch (error) { pending.push({ ticker: "BTC", reason: error.message }); }
        continue;
      }
      const tokenSymbol = tokenCandidates(item.ticker).find((candidate) => bySymbol.has(candidate));
      if (!tokenSymbol) { pending.push({ ticker: item.ticker, reason: "BINANCE_RWA_SYMBOL_NOT_FOUND" }); continue; }
      const meta = bySymbol.get(tokenSymbol);
      const chainId = meta?.chainId || meta?.chainID || meta?.chain?.id || 56;
      const contractAddress = meta?.contractAddress || meta?.address || meta?.tokenAddress;
      if (!contractAddress) { pending.push({ ticker: item.ticker, reason: "BINANCE_RWA_CONTRACT_NOT_FOUND", tokenSymbol }); continue; }
      try {
        const dynamic = await fetchJson(`${DYNAMIC_URL}?chainId=${encodeURIComponent(chainId)}&contractAddress=${encodeURIComponent(contractAddress)}`);
        rows.push(normalizeStock(item.ticker, tokenSymbol, meta, dynamic));
      } catch (error) {
        pending.push({ ticker: item.ticker, tokenSymbol, reason: error.message });
      }
    }

    return res.status(200).json({
      ok: true,
      source: "Binance RWA dynamic + Binance Web BTCUSDT",
      generated_at_utc: new Date().toISOString(),
      requested_count: selected.length,
      available_count: rows.length,
      pending_count: pending.length,
      rows,
      pending,
      note: "These are Binance-provided rolling 24h snapshots. Daily archival is required before MA25/VMA60 can be calculated without a historical seed.",
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
}
