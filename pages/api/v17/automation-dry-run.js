function baseUrlFromReq(req) {
  const host = req.headers.host;
  const protocol = req.headers["x-forwarded-proto"] || "https";
  return `${protocol}://${host}`;
}
async function readJsonSafe(response) {
  return response ? response.json().catch(() => ({})) : {};
}
function num(value) {
  const n = Number(String(value ?? "0").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function failedCheckNames(payload) {
  return (payload?.checks || []).filter((x) => !x.passed).map((x) => x.name);
}
function orderFromDraft(draft, readiness) {
  const failed = failedCheckNames(readiness);
  const blockedByReadiness = failed.length > 0 && readiness?.readiness?.status !== "READY_IDLE";
  return {
    symbol: draft.symbol,
    tier: draft.tier,
    amountUsd: num(draft.amountUsd),
    price: draft.price ?? null,
    estimatedQty: draft.estimatedQty ?? null,
    quality: draft.qualityGate?.label || "—",
    permission: draft.qualityGate?.permission || "—",
    dryRunAction: blockedByReadiness ? "WOULD_BLOCK" : "WOULD_REQUEST_MANUAL_CONFIRMATION",
    reason: blockedByReadiness ? `Trade Readiness 需覆核：${failed.join("、") || "unknown"}` : "乾跑通過；仍只會要求人工確認，不會自動下單。",
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "method_not_allowed" });
  try {
    const base = baseUrlFromReq(req);
    const [pricesRes, readinessRes] = await Promise.all([
      fetch(`${base}/api/prices?t=${Date.now()}`, { cache: "no-store" }),
      fetch(`${base}/api/v17/trade-readiness?t=${Date.now()}`, { cache: "no-store" }),
    ]);
    const prices = await readJsonSafe(pricesRes);
    const readiness = await readJsonSafe(readinessRes);
    if (!pricesRes.ok || prices?.ok === false) throw new Error(prices?.error || `prices ${pricesRes.status}`);
    const rows = Array.isArray(prices.data) ? prices.data : [];
    const markets = Object.fromEntries(rows.map((row) => [row.symbol, { symbol: row.symbol, price: row.price, high: row.high, cycleHigh: row.high || row.cycleHigh, discount: row.discount }]));

    const draftsRes = await fetch(`${base}/api/v17/semi-auto-drafts?t=${Date.now()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markets }),
      cache: "no-store",
    });
    const draftsPayload = await readJsonSafe(draftsRes);
    if (!draftsRes.ok || draftsPayload?.ok === false) throw new Error(draftsPayload?.error || `semi-auto-drafts ${draftsRes.status}`);

    const drafts = Array.isArray(draftsPayload.drafts) ? draftsPayload.drafts : [];
    const blocked = Array.isArray(draftsPayload.blocked) ? draftsPayload.blocked : [];
    const simulatedOrders = drafts.map((draft) => orderFromDraft(draft, readiness));
    const wouldRequestManualConfirmation = simulatedOrders.filter((x) => x.dryRunAction === "WOULD_REQUEST_MANUAL_CONFIRMATION");
    const wouldBlock = simulatedOrders.filter((x) => x.dryRunAction === "WOULD_BLOCK");

    return res.status(200).json({
      ok: true,
      version: "v17-automation-dry-run-v1",
      updatedAt: new Date().toISOString(),
      mode: "dry_run_only_no_order_execution",
      autoTradingEnabled: false,
      wouldSubmitOrders: false,
      manualConfirmationRequired: true,
      killSwitchRequired: true,
      summary: {
        draftCount: drafts.length,
        qualityBlockedCount: blocked.length,
        wouldRequestManualConfirmationCount: wouldRequestManualConfirmation.length,
        wouldBlockCount: wouldBlock.length,
        totalDraftAmountUsd: num(draftsPayload.totalDraftAmountUsd),
        readinessStatus: readiness?.readiness?.status || null,
        readinessLabel: readiness?.readiness?.label || null,
      },
      simulatedOrders,
      qualityBlocked: blocked,
      tradeReadiness: readiness,
      note: "Dry run simulates what automation would do today. It never sends Binance orders.",
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "automation_dry_run_failed" });
  }
}
