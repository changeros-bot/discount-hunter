import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { hasKvConfig, requiresDurableKv, getJson, setJson, getStorageMode } = require("./state/kv");

const memoryStore = globalThis.__V17_MEMORY_STORE__ || {};
globalThis.__V17_MEMORY_STORE__ = memoryStore;

export const V17_STORAGE_KEYS = Object.freeze({
  INVESTMENT_LEDGER: "discount-hunter:v17:investment-ledger",
  TACTICAL_LEDGER: "discount-hunter:v17:tactical-ledger",
  ACTION_STATE: "discount-hunter:v17:action-state",
  EVENT_LOG: "discount-hunter:v17:event-log",
  REVIEW_STATE: "discount-hunter:v17:review-state",
  RESEARCH_QUEUE: "discount-hunter:v17:research-queue"
});

export function getV17StorageStatus() {
  return {
    mode: getStorageMode(),
    durable: hasKvConfig(),
    requiresDurable: requiresDurableKv(),
    rule: "V17 mutable state must not be written to runtime files. Use Upstash KV in production; memory fallback is local/dev only."
  };
}

export function assertV17DurableStorage() {
  if (hasKvConfig()) return;
  if (requiresDurableKv()) {
    throw new Error("v17_requires_durable_storage_upstash_kv");
  }
}

export async function readV17State(key, fallback) {
  if (!Object.values(V17_STORAGE_KEYS).includes(key)) {
    throw new Error(`v17_invalid_storage_key:${key}`);
  }

  if (hasKvConfig()) {
    const response = await getJson(key);
    return response?.result ?? fallback;
  }

  assertV17DurableStorage();
  return memoryStore[key] ?? fallback;
}

export async function writeV17State(key, value) {
  if (!Object.values(V17_STORAGE_KEYS).includes(key)) {
    throw new Error(`v17_invalid_storage_key:${key}`);
  }

  if (hasKvConfig()) {
    await setJson(key, value);
    return { storage: "upstash_kv", durable: true };
  }

  assertV17DurableStorage();
  memoryStore[key] = value;
  return { storage: "memory_dev_only", durable: false };
}
