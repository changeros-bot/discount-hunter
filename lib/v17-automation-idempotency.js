import { createRequire } from "module";
import { nowIso } from "./v17-auto-store";

const require = createRequire(import.meta.url);
const { hasKvConfig, requiresDurableKv, setJsonIfAbsent } = require("./state/kv");

const memoryLocks = globalThis.__V17_AUTOMATION_LOCKS__ || new Map();
globalThis.__V17_AUTOMATION_LOCKS__ = memoryLocks;

function safeKey(value) {
  return String(value || "").trim().replace(/[^A-Za-z0-9:_-]/g, "_").slice(0, 180);
}

export async function acquireAutomationIdempotency({ actionId, ttlSeconds = 604800 }) {
  const normalized = safeKey(actionId);
  if (!normalized) throw new Error("missing_automation_action_id");
  const key = `discount-hunter:v17:automation-lock:${normalized}`;
  const value = { actionId: normalized, acquiredAt: nowIso() };

  if (hasKvConfig()) {
    const result = await setJsonIfAbsent(key, value, ttlSeconds);
    return { acquired: result.acquired === true, key, store: "upstash_kv" };
  }

  if (requiresDurableKv()) throw new Error("automation_idempotency_requires_upstash_kv");
  if (memoryLocks.has(key)) return { acquired: false, key, store: "memory_dev_only" };
  memoryLocks.set(key, value);
  return { acquired: true, key, store: "memory_dev_only" };
}
