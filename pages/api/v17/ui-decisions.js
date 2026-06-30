import { getAssetRegistry } from "../../../lib/v17-asset-registry";
import { buildV17Decisions } from "../../../lib/v17-decision-engine";
import { adaptV17DecisionResult } from "../../../lib/v17-ui-adapter";
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
    const events = Array.isArray(body.events) ? body.events : (storedEvents.events || []);
    const previousStates = body.previousStates || storedAction.states || {};
    const result = buildV17Decisions({ assets, markets, events, previousStates, now });
    const ui = adaptV17DecisionResult(result);
    const shouldPersist = req.method === "POST" && body.persistState === true;
    const nextStates = compactStates(result.decisions);
    const write = shouldPersist ? await writeV17State(V17_STORAGE_KEYS.ACTION_STATE, { updatedAt: now, states: nextStates }) : null;

    return res.status(200).json({
      ok: true,
      version: "v17-ui-decisions-v1",
      updatedAt: now,
      ui,
      cards: ui.cards,
      summary: ui.summary,
      statePersisted: Boolean(write),
      stateWrite: write,
      storage: getV17StorageStatus(),
      raw: body.includeRaw === true ? result : undefined
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "v17_ui_decisions_failed" });
  }
}
