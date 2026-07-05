import { V17_STORAGE_KEYS, readV17State, getV17StorageStatus } from "../../../lib/v17-storage";

function upper(value) { return String(value || "").trim().toUpperCase(); }
function safeNumber(value) { const n = Number(value || 0); return Number.isFinite(n) ? n : 0; }
function normalizeSymbol(symbol) {
  const s = upper(symbol).replace(/[^A-Z0-9]/g, "");
  return s.endsWith("ON") ? s : `${s}ON`;
}
function normalizeManualBuyEvent(event) {
  const amount = safeNumber(event.amount);
  const price = safeNumber(event.price);
  const quantity = amount > 0 && price > 0 ? amount / price : 0;
  return {
    id: event.id || null,
    symbol: normalizeSymbol(event.symbol),
    tier: event.tier || (event.layer ? `D${event.layer}` : null),
    amount,
    price,
    quantity,
    createdAt: event.createdAt || null,
    source: event.source || null,
    status: event.status || null,
    type: event.type || null,
  };
}
function summarizeEvents(events = []) {
  const manualBuys = (events || [])
    .filter((event) => event?.type === "manual_buy" && event?.status === "filled")
    .map(normalizeManualBuyEvent)
    .filter((event) => event.symbol && event.amount > 0);

  const bySymbol = new Map();
  for (const event of manualBuys) {
    const row = bySymbol.get(event.symbol) || { symbol: event.symbol, totalCost: 0, appLedgerQuantity: 0, buyCount: 0, tiers: [], events: [] };
    row.totalCost += event.amount;
    row.appLedgerQuantity += event.quantity;
    row.buyCount += 1;
    if (event.tier && !row.tiers.includes(event.tier)) row.tiers.push(event.tier);
    row.events.push(event);
    bySymbol.set(event.symbol, row);
  }

  const holdings = [...bySymbol.values()].map((row) => ({
    ...row,
    averageCost: row.appLedgerQuantity > 0 ? row.totalCost / row.appLedgerQuantity : 0,
    costBasisSource: "v17_app_event_log_manual_buy",
    costBasisWarning: "This is App Ledger cost from V17 filled manual_buy events, not chain transfer-history cost.",
  })).sort((a, b) => a.symbol.localeCompare(b.symbol));

  return {
    eventCount: events.length,
    manualBuyEventCount: manualBuys.length,
    symbolCount: holdings.length,
    totalAppLedgerCost: holdings.reduce((sum, h) => sum + safeNumber(h.totalCost), 0),
    holdings,
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  try {
    const stored = await readV17State(V17_STORAGE_KEYS.EVENT_LOG, { events: [] });
    const events = Array.isArray(stored.events) ? stored.events : [];
    const summary = summarizeEvents(events);
    return res.status(200).json({
      ok: true,
      checkedAt: new Date().toISOString(),
      storage: getV17StorageStatus(),
      key: V17_STORAGE_KEYS.EVENT_LOG,
      status: summary.manualBuyEventCount > 0 ? "APP_LEDGER_AVAILABLE" : "NO_APP_LEDGER_BUYS",
      rule: "read-only audit; not connected to /v17 and not used as chain cost basis",
      ...summary,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "app_ledger_cost_audit_failed" });
  }
}
