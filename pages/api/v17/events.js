import { V17_STORAGE_KEYS, readV17State, writeV17State, getV17StorageStatus } from "../../../lib/v17-storage";

function normalizeEvent(event = {}) {
  return {
    id: event.id || `${event.symbol || event.asset || "UNKNOWN"}-${event.time || event.timestamp || Date.now()}`,
    symbol: event.symbol || event.asset || event.tokenSymbol || null,
    type: event.type || "external_event",
    status: event.status || "confirmed",
    price: event.price ?? event.fillPrice ?? event.eventPrice ?? null,
    amount: event.amount ?? event.notional ?? event.usdValue ?? event.value ?? null,
    layer: event.layer ?? event.level ?? null,
    source: event.source || "external",
    time: event.time || event.timestamp || new Date().toISOString(),
    raw: event.raw || null
  };
}

function dedupeEvents(events = []) {
  const map = new Map();
  for (const event of events) {
    const normalized = normalizeEvent(event);
    if (normalized.id) map.set(normalized.id, normalized);
  }
  return Array.from(map.values()).sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");

  try {
    const current = await readV17State(V17_STORAGE_KEYS.EVENT_LOG, { updatedAt: null, events: [] });

    if (req.method === "GET") {
      return res.status(200).json({
        ok: true,
        version: "v17-event-log-v1",
        storage: getV17StorageStatus(),
        count: current.events?.length || 0,
        eventLog: current
      });
    }

    if (req.method === "POST") {
      const incoming = Array.isArray(req.body?.events) ? req.body.events : [req.body?.event || req.body || {}];
      const merged = dedupeEvents([...(current.events || []), ...incoming]);
      const next = { updatedAt: new Date().toISOString(), events: merged };
      const write = await writeV17State(V17_STORAGE_KEYS.EVENT_LOG, next);
      return res.status(200).json({
        ok: true,
        version: "v17-event-log-v1",
        added: incoming.length,
        count: merged.length,
        write,
        eventLog: next
      });
    }

    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "v17_events_failed" });
  }
}
