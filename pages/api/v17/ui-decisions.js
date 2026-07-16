import { getAssetRegistry } from "../../../lib/v17-asset-registry";
import { buildV17Decisions, baseSymbol, getEventLayer, toNumber } from "../../../lib/v17-decision-engine";
import { adaptV17DecisionResult, adaptActionToCard } from "../../../lib/v17-ui-adapter";
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

function baseUrlFromReq(req) {
  const host = req.headers.host;
  const protocol = req.headers["x-forwarded-proto"] || "https";
  return `${protocol}://${host}`;
}

async function readJsonSafe(response) {
  try { return await response.json(); } catch { return {}; }
}

function normalizeHoldings(payload = {}) {
  const rows = payload?.totals?.holdings || payload?.summary?.holdings || payload?.holdings || [];
  return new Map((Array.isArray(rows) ? rows : []).map((row) => [baseSymbol(row.symbol), row]));
}

function eventAmountForLayer(events, asset, layer) {
  return (events || []).reduce((sum, event) => {
    if (baseSymbol(event?.symbol || event?.asset || event?.tokenSymbol) !== baseSymbol(asset.symbol)) return sum;
    if (getEventLayer(event, asset) !== layer) return sum;
    const amount = toNumber(event?.amount ?? event?.notional ?? event?.usdValue ?? event?.value, 0) || 0;
    return sum + amount;
  }, 0);
}

function buildCostReconciliationEvents({ assets, holdings, events, now }) {
  const synthetic = [];

  for (const asset of assets || []) {
    const holding = holdings.get(baseSymbol(asset.symbol));
    const totalCost = Number(holding?.totalCost || 0);
    if (!(totalCost > 0) || !Array.isArray(asset.amounts) || asset.amounts.length === 0) continue;

    let cumulative = 0;
    for (let i = 0; i < asset.amounts.length; i += 1) {
      const required = Number(asset.amounts[i] || 0);
      cumulative += required;
      if (!(required > 0) || totalCost + 0.05 < cumulative) break;

      const layer = i + 1;
      const alreadyRecorded = eventAmountForLayer([...events, ...synthetic], asset, layer);
      const missing = Math.max(0, required - alreadyRecorded);
      if (missing <= 0.05) continue;

      synthetic.push({
        id: `${baseSymbol(asset.symbol)}-D${layer}-cost-reconcile-${String(now).replace(/[^0-9]/g, "")}`,
        symbol: asset.symbol,
        type: "wallet_cost_reconciliation",
        status: "filled",
        layer,
        amount: Number(missing.toFixed(6)),
        price: Number(holding?.averageCost || holding?.marketPrice || holding?.tokenPrice || 0) || 1,
        source: "portfolio_truth_cost_reconciliation",
        note: `Live total cost ${totalCost.toFixed(2)}U confirms cumulative completion through D${layer}.`,
        createdAt: now
      });
    }
  }

  return synthetic;
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
    console.log("v17_ui_decisions_caller", JSON.stringify({
      at: now,
      method: req.method,
      userAgent: req.headers["user-agent"] || null,
      forwardedFor: req.headers["x-forwarded-for"] || null,
      vercelId: req.headers["x-vercel-id"] || null,
      referer: req.headers.referer || null,
      persistState: body.persistState === true,
      hasMarkets: Boolean(body.markets || body.marketData),
      marketCount: Object.keys(body.markets || body.marketData || {}).length,
      hasPreviousStates: Boolean(body.previousStates),
      hasEvents: Array.isArray(body.events)
    }));
    const markets = body.markets || body.marketData || {};
    const storedAction = await readV17State(V17_STORAGE_KEYS.ACTION_STATE, { states: {} });
    const storedEvents = await readV17State(V17_STORAGE_KEYS.EVENT_LOG, { events: [] });
    const persistedEvents = Array.isArray(body.events) ? body.events : (storedEvents.events || []);
    const previousStates = body.previousStates || storedAction.states || {};

    let portfolioTruth = body.portfolioTruth || null;
    if (!portfolioTruth) {
      const truthRes = await fetch(`${baseUrlFromReq(req)}/api/v17/portfolio-truth?t=${Date.now()}`, { cache: "no-store" });
      if (truthRes.ok) portfolioTruth = await readJsonSafe(truthRes);
    }

    const holdings = normalizeHoldings(portfolioTruth || {});
    const reconciliationEvents = buildCostReconciliationEvents({ assets, holdings, events: persistedEvents, now });
    const events = [...persistedEvents, ...reconciliationEvents];
    const result = buildV17Decisions({ assets, markets, events, previousStates, now });
    const ui = adaptV17DecisionResult(result);
    const shouldPersist = req.method === "POST" && body.persistState === true;
    const nextStates = compactStates(result.decisions);
    const write = shouldPersist ? await writeV17State(V17_STORAGE_KEYS.ACTION_STATE, { updatedAt: now, states: nextStates }) : null;
    const states = (result.decisions || []).map(adaptActionToCard);

    return res.status(200).json({
      ok: true,
      version: "v17-ui-decisions-v2-cost-reconciled",
      updatedAt: now,
      ui,
      cards: ui.cards,
      states,
      summary: ui.summary,
      reconciliation: {
        enabled: true,
        holdingCount: holdings.size,
        syntheticEventCount: reconciliationEvents.length,
        events: reconciliationEvents.map((event) => ({ symbol: event.symbol, tier: `D${event.layer}`, amount: event.amount, source: event.source }))
      },
      statePersisted: Boolean(write),
      stateWrite: write,
      storage: getV17StorageStatus(),
      raw: body.includeRaw === true ? result : undefined
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "v17_ui_decisions_failed" });
  }
}
