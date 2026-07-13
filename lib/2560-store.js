import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { hasKvConfig, requiresDurableKv, getJson, setJson, getStorageMode } = require("./state/kv");

export const STORE_KEYS_2560 = Object.freeze({
  snapshot: "discount-hunter:2560:snapshot",
  scanAudit: "discount-hunter:2560:scan-audit",
  paperTrades: "discount-hunter:2560:paper-trades",
  openPositions: "discount-hunter:2560:open-positions",
  closedTrades: "discount-hunter:2560:closed-trades",
  summary: "discount-hunter:2560:summary",
});

export function get2560StorageStatus() {
  return {
    configured: hasKvConfig(),
    required: requiresDurableKv(),
    mode: getStorageMode(),
  };
}

async function readKey(key, fallback) {
  const response = await getJson(key);
  if (response?.result !== null && response?.result !== undefined) return response.result;
  return fallback;
}

export async function read2560Snapshot() {
  return readKey(STORE_KEYS_2560.snapshot, null);
}

export async function write2560Snapshot(snapshot) {
  if (!hasKvConfig()) {
    if (requiresDurableKv()) throw new Error("missing_required_upstash_kv");
    return { store: "not_persisted_dev", snapshot };
  }

  const normalized = {
    schemaVersion: "2560-paper-v1",
    ingestedAt: new Date().toISOString(),
    ...snapshot,
  };

  await Promise.all([
    setJson(STORE_KEYS_2560.snapshot, normalized),
    setJson(STORE_KEYS_2560.scanAudit, normalized.lastScan || null),
    setJson(STORE_KEYS_2560.paperTrades, normalized.trades || []),
    setJson(STORE_KEYS_2560.openPositions, normalized.open || []),
    setJson(STORE_KEYS_2560.closedTrades, normalized.closed || []),
    setJson(STORE_KEYS_2560.summary, normalized.summary || null),
  ]);

  return { store: "upstash_kv", snapshot: normalized };
}
