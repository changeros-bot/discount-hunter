import { getAssetRegistry } from "../../../lib/v17-asset-registry";
import { buildV17Decisions } from "../../../lib/v17-decision-engine";
import { adaptActionToCard } from "../../../lib/v17-ui-adapter";
import { V17_STORAGE_KEYS, readV17State, getV17StorageStatus } from "../../../lib/v17-storage";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");

  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  try {
    const now = new Date().toISOString();
    const body = req.method === "POST" ? (req.body || {}) : {};
    const assets = getAssetRegistry({ status: body.status });
    const storedAction = await readV17State(V17_STORAGE_KEYS.ACTION_STATE, { states: {} });
    const storedEvents = await readV17State(V17_STORAGE_KEYS.EVENT_LOG, { events: [] });
    const markets = body.markets || body.marketData || {};
    const events = Array.isArray(body.events) ? body.events : (storedEvents.events || []);
    const previousStates = body.previousStates || storedAction.states || {};
    const result = buildV17Decisions({ assets, markets, events, previousStates, now });
    const candidates = result.actionQueue.filter((item) => item.shouldNotify).map(adaptActionToCard);

    return res.status(200).json({
      ok: true,
      version: "v17-notify-candidates-v1",
      mode: "dry_run_candidates_only",
      updatedAt: now,
      notifyCount: candidates.length,
      candidates,
      guardrails: {
        sendsTelegram: false,
        writesLedger: false,
        writesActionState: false,
        rule: "Only state or price changes should produce candidates. Sending is handled by a separate explicit endpoint."
      },
      storage: getV17StorageStatus()
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "v17_notify_candidates_failed" });
  }
}
