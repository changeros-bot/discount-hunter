import { getAssetRegistry } from "../../../lib/v17-asset-registry";
import { buildV17Decisions } from "../../../lib/v17-decision-engine";
import { V17_STORAGE_KEYS, readV17State, writeV17State, getV17StorageStatus } from "../../../lib/v17-storage";

function compactStates(decisions = []) {
  return Object.fromEntries((decisions || []).map((decision) => [
    decision.symbol,
    {
      status: decision.status,
      tier: decision.tier,
      level: decision.level,
      price: decision.price,
      discount: decision.discount,
      updatedAt: decision.decidedAt
    }
  ]));
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");

  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  try {
    const now = new Date().toISOString();
    const status = req.method === "GET" && req.query?.status ? String(req.query.status) : undefined;
    const assets = getAssetRegistry({ status });
    const body = req.method === "POST" ? (req.body || {}) : {};
    const markets = body.markets || body.marketData || {};
    const storedAction = await readV17State(V17_STORAGE_KEYS.ACTION_STATE, { states: {} });
    const storedEvents = await readV17State(V17_STORAGE_KEYS.EVENT_LOG, { events: [] });
    const hasRequestEvents = Array.isArray(body.events);
    const events = hasRequestEvents ? body.events : (storedEvents.events || []);
    const previousStates = body.previousStates || storedAction.states || {};
    const result = buildV17Decisions({ assets, markets, events, previousStates, now });
    const nextStates = compactStates(result.decisions);
    const shouldPersist = req.method === "POST" && body.persistState === true;
    const write = shouldPersist ? await writeV17State(V17_STORAGE_KEYS.ACTION_STATE, { updatedAt: now, states: nextStates }) : null;

    return res.status(200).json({
      ...result,
      previousStateSource: body.previousStates ? "request" : "storage",
      eventSource: hasRequestEvents ? "request" : "storage",
      eventCountUsed: events.length,
      statePersisted: Boolean(write),
      stateWrite: write,
      nextStates,
      storage: getV17StorageStatus(),
      guardrails: {
        readOnly: !shouldPersist,
        noLedgerWrite: true,
        queueOnly: true,
        sourceOfTruth: "market_price_and_events",
        notifyRule: "state_or_price_change_only"
      }
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "v17_decisions_failed" });
  }
}
