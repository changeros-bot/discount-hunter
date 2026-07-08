import { V17_STORAGE_KEYS, readV17State, getV17StorageStatus } from "../../../lib/v17-storage";

function normalize(event = {}) {
  const type = event.type || "external_event";
  const action = type === "manual_buy" ? "MANUALLY_EXECUTED" : type === "skip_layer" ? "SKIPPED_BY_USER" : "OTHER";
  const time = event.createdAt || event.time || event.timestamp || new Date().toISOString();
  return {
    id: event.id || `${event.symbol || "UNKNOWN"}-${time}`,
    symbol: event.symbol || event.asset || event.tokenSymbol || "UNKNOWN",
    tier: event.tier || (event.layer ? `D${event.layer}` : "—"),
    layer: event.layer || null,
    type,
    action,
    status: event.status || "confirmed",
    amount: event.amount ?? null,
    price: event.price ?? null,
    note: event.note || "",
    source: event.source || "external",
    time,
  };
}
function countBy(items, key) {
  return items.reduce((acc, x) => {
    const k = x[key] || "UNKNOWN";
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
}
function summarize(events) {
  const semi = events.filter((x) => x.action === "MANUALLY_EXECUTED" || x.action === "SKIPPED_BY_USER");
  return {
    totalEvents: events.length,
    semiAutoEvents: semi.length,
    manuallyExecuted: semi.filter((x) => x.action === "MANUALLY_EXECUTED").length,
    skippedByUser: semi.filter((x) => x.action === "SKIPPED_BY_USER").length,
    bySymbol: countBy(semi, "symbol"),
    byAction: countBy(semi, "action"),
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "method_not_allowed" });
  try {
    const stored = await readV17State(V17_STORAGE_KEYS.EVENT_LOG, { updatedAt: null, events: [] });
    const raw = Array.isArray(stored.events) ? stored.events : [];
    const events = raw.map(normalize).sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    const limit = Math.max(1, Math.min(200, Number(req.query.limit || 50)));
    const action = String(req.query.action || "ALL").toUpperCase();
    const filtered = action === "ALL" ? events : events.filter((x) => x.action === action);
    return res.status(200).json({
      ok: true,
      version: "v17-semi-auto-flow-log-v1",
      updatedAt: new Date().toISOString(),
      storage: getV17StorageStatus(),
      summary: summarize(events),
      events: filtered.slice(0, limit),
      allEventCount: events.length,
      filteredCount: filtered.length,
      note: "This is a manual-flow audit log. It records user-confirmed completion or skipped layers; it does not execute orders.",
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "semi_auto_flow_log_failed" });
  }
}
