import { V17_STORAGE_KEYS, readV17State, writeV17State, getV17StorageStatus } from "../../../lib/v17-storage";

function cleanSymbol(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function cleanLayer(value) {
  const n = Number(String(value || "").replace(/[^0-9]/g, ""));
  if (!Number.isInteger(n) || n < 1 || n > 4) throw new Error("invalid_layer");
  return n;
}

function cleanAmount(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function buildEvent({ action, symbol, layer, amount, price, note }) {
  const now = new Date().toISOString();
  const base = {
    id: `${cleanSymbol(symbol)}-D${layer}-${action}-${now.replace(/[^0-9]/g, "")}`,
    symbol: cleanSymbol(symbol),
    layer,
    tier: `D${layer}`,
    source: "v17_ui",
    note: note || "",
    createdAt: now
  };

  if (action === "skip") {
    return { ...base, type: "skip_layer", status: "skipped" };
  }

  if (action === "complete") {
    return {
      ...base,
      type: "manual_buy",
      status: "filled",
      amount: cleanAmount(amount),
      price: Number(price || 0) || null
    };
  }

  throw new Error("invalid_action");
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  try {
    const body = req.body || {};
    const action = String(body.action || "").toLowerCase();
    const symbol = cleanSymbol(body.symbol);
    const layer = cleanLayer(body.layer || body.level || body.tier);
    if (!symbol) throw new Error("invalid_symbol");

    const event = buildEvent({
      action,
      symbol,
      layer,
      amount: body.amount,
      price: body.price,
      note: body.note
    });

    const stored = await readV17State(V17_STORAGE_KEYS.EVENT_LOG, { events: [] });
    const events = Array.isArray(stored.events) ? stored.events : [];
    const next = { updatedAt: new Date().toISOString(), events: [...events, event] };
    const write = await writeV17State(V17_STORAGE_KEYS.EVENT_LOG, next);

    return res.status(200).json({
      ok: true,
      event,
      eventCount: next.events.length,
      write,
      storage: getV17StorageStatus()
    });
  } catch (error) {
    return res.status(400).json({ ok: false, error: error.message || "v17_action_event_failed" });
  }
}
