const { buildPaperCandidates } = require("../../../lib/v17-market-91-paper-rules");

function baseUrlFromReq(req) {
  const host = req.headers.host;
  const protocol = req.headers["x-forwarded-proto"] || "https";
  return `${protocol}://${host}`;
}
async function readJsonSafe(response) {
  return response ? response.json().catch(() => ({})) : {};
}
function marketMapFromRows(rows = []) {
  return Object.fromEntries((rows || []).map((row) => [row.symbol, {
    symbol: row.symbol,
    price: row.price,
    high: row.high,
    high52w: row.high52w,
    cycleHigh: row.high || row.cycleHigh || row.high52w,
    discount: row.discount,
  }]));
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  try {
    const base = baseUrlFromReq(req);
    let markets = req.method === "POST" ? (req.body?.markets || req.body?.marketData || null) : null;
    if (!markets) {
      const pricesRes = await fetch(`${base}/api/prices?t=${Date.now()}`, { cache: "no-store" });
      const prices = await readJsonSafe(pricesRes);
      if (!pricesRes.ok || prices?.ok === false) throw new Error(prices?.error || `prices ${pricesRes.status}`);
      markets = marketMapFromRows(Array.isArray(prices.data) ? prices.data : []);
    }
    const result = buildPaperCandidates({ markets, now: new Date().toISOString() });
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "market_91_paper_failed" });
  }
}
