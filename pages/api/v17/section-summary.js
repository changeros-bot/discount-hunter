import { classifyUniverse } from "../../../lib/v17-state-classifier";

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
    const [pricesRes, ledgerRes, truthRes] = await Promise.all([
      fetch(`${base}/api/prices?t=${Date.now()}`, { cache: "no-store" }),
      fetch(`${base}/api/buy-ledger?t=${Date.now()}`, { cache: "no-store" }),
      fetch(`${base}/api/v17/portfolio-truth?t=${Date.now()}`, { cache: "no-store" }),
    ]);
    const prices = await readJsonSafe(pricesRes);
    const ledger = await readJsonSafe(ledgerRes);
    const truth = await readJsonSafe(truthRes);
    if (!pricesRes.ok || prices?.ok === false) throw new Error(prices?.error || `prices ${pricesRes.status}`);
    if (!ledgerRes.ok || ledger?.ok === false) throw new Error(ledger?.error || `ledger ${ledgerRes.status}`);
    if (!truthRes.ok || truth?.ok === false) throw new Error(truth?.error || `truth ${truthRes.status}`);

    const rows = Array.isArray(prices.data) ? prices.data : [];
    const decisionRes = await fetch(`${base}/api/v17/ui-decisions?t=${Date.now()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markets: marketMapFromRows(rows), persistState: false }),
      cache: "no-store",
    });
    const decision = await readJsonSafe(decisionRes);
    if (!decisionRes.ok || decision?.ok === false) throw new Error(decision?.error || `ui-decisions ${decisionRes.status}`);

    const classified = classifyUniverse({
      assets: rows,
      ledger: ledger.ledger || {},
      holdings: truth.summary?.holdings || [],
      decisions: decision.cards || [],
      states: decision.states || [],
    });

    return res.status(200).json({
      ok: true,
      version: "v17-section-summary-v1",
      updatedAt: new Date().toISOString(),
      summary: classified.summary,
      watchRows: classified.watchRows.map((r) => ({ symbol: r.symbol, tier: r.tier, discount: r.discount, progressPct: r.progressPct })),
      holdingRows: classified.holdingRows.map((r) => ({ symbol: r.symbol, tier: r.tier, discount: r.discount, progressPct: r.progressPct, decision: r.decision })),
      decisionRows: classified.decisionRows.map((r) => ({ symbol: r.symbol, tier: r.tier, discount: r.discount, progressPct: r.progressPct, decision: r.decision })),
      rules: classified.rules,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "section_summary_failed" });
  }
}
