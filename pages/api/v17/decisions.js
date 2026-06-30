import { getAssetRegistry } from "../../../lib/v17-asset-registry";
import { buildV17Decisions } from "../../../lib/v17-decision-engine";
import { getV17StorageStatus } from "../../../lib/v17-storage";

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");

  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const now = new Date().toISOString();
  const status = req.method === "GET" && req.query?.status ? String(req.query.status) : undefined;
  const assets = getAssetRegistry({ status });
  const body = req.method === "POST" ? (req.body || {}) : {};
  const markets = body.markets || body.marketData || {};
  const events = body.events || [];
  const previousStates = body.previousStates || {};
  const result = buildV17Decisions({ assets, markets, events, previousStates, now });

  return res.status(200).json({
    ...result,
    storage: getV17StorageStatus(),
    guardrails: {
      readOnly: true,
      noLedgerWrite: true,
      queueOnly: true,
      sourceOfTruth: "market_price_and_events",
      notifyRule: "state_or_price_change_only"
    }
  });
}
