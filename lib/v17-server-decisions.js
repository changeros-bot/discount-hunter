import { getAssetRegistry } from "./v17-asset-registry";
import { buildV17Decisions } from "./v17-decision-engine";
import { V17_STORAGE_KEYS, readV17State } from "./v17-storage";

const DEFAULT_CANONICAL_BASE_URL = "https://discount-hunter-sigma.vercel.app";
const MAX_PRICE_AGE_MS = 60_000;
const ALLOWED_PRICE_AUDITS = new Set(["PASS"]);

function canonicalBaseUrl() {
  return String(process.env.V17_CANONICAL_BASE_URL || DEFAULT_CANONICAL_BASE_URL).replace(/\/$/, "");
}

async function fetchCanonicalPrices() {
  const response = await fetch(`${canonicalBaseUrl()}/api/prices`, {
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || !Array.isArray(payload.data)) {
    throw new Error(`canonical_prices_failed:${response.status}`);
  }

  const updatedAtMs = new Date(payload.updatedAt).getTime();
  const ageMs = Date.now() - updatedAtMs;
  if (!Number.isFinite(updatedAtMs) || ageMs < -5_000 || ageMs > MAX_PRICE_AGE_MS) {
    throw new Error(`canonical_prices_stale:${ageMs}`);
  }
  if (payload.binanceHealth?.ok !== true) throw new Error("canonical_binance_health_failed");

  const accepted = [];
  const rejected = [];
  for (const row of payload.data) {
    const audit = String(row?.binanceAudit?.status || "UNKNOWN").toUpperCase();
    const price = Number(row?.price || 0);
    const discount = Number(row?.discount);
    if (!ALLOWED_PRICE_AUDITS.has(audit) || !(price > 0) || !Number.isFinite(discount)) {
      rejected.push({ symbol: row?.symbol || "UNKNOWN", audit, reason: "price_audit_not_pass" });
      continue;
    }
    accepted.push(row);
  }

  return {
    markets: Object.fromEntries(accepted.map((row) => [row.symbol, row])),
    source: payload.source,
    sourceUpdatedAt: payload.updatedAt,
    priceAgeMs: ageMs,
    acceptedSymbols: accepted.map((row) => row.symbol),
    rejected,
  };
}

export async function buildServerVerifiedDecisions() {
  const [priceState, storedAction, storedEvents] = await Promise.all([
    fetchCanonicalPrices(),
    readV17State(V17_STORAGE_KEYS.ACTION_STATE, { states: {} }),
    readV17State(V17_STORAGE_KEYS.EVENT_LOG, { events: [] }),
  ]);

  const result = buildV17Decisions({
    assets: getAssetRegistry(),
    markets: priceState.markets,
    events: storedEvents.events || [],
    previousStates: storedAction.states || {},
    now: new Date().toISOString(),
  });

  return {
    ...result,
    actionQueue: (result.actionQueue || []).map((decision) => ({
      ...decision,
      serverVerified: true,
      verificationSource: "canonical_binance_prices_and_v17_state",
    })),
    verification: {
      serverVerified: true,
      ...priceState,
    },
  };
}
