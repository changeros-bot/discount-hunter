import { nowIso, readV17AutoStore, writeV17AutoStore } from "./v17-auto-store";

export const EXECUTION_STATUSES_V17_6 = ["SIMULATED", "BLOCKED", "FAILED"];

export async function readExecutionLog() {
  const logs = await readV17AutoStore({ name: "executionLog", fallback: [] });
  return Array.isArray(logs) ? logs : [];
}

export async function writeExecutionLog(logs) {
  return writeV17AutoStore({ name: "executionLog", value: Array.isArray(logs) ? logs : [] });
}

export function buildExecutionId(draft, date = new Date()) {
  const stamp = date.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `EXEC-${stamp}-${draft.symbol}-${draft.tier}`;
}

export async function appendExecutionLog({ draft, status = "SIMULATED", error = null }) {
  if (!EXECUTION_STATUSES_V17_6.includes(status)) throw new Error(`execution_status_locked_in_v17_6:${status}`);
  const logs = await readExecutionLog();
  const createdAt = nowIso();
  const entry = {
    id: buildExecutionId(draft, new Date(createdAt)),
    draftId: draft.id,
    symbol: draft.symbol,
    tier: draft.tier,
    amountUSDT: Number(draft.amountUSDT || 0),
    price: draft.price ?? null,
    mode: "DRY_RUN",
    status,
    orderId: null,
    txHash: null,
    error,
    createdAt,
    dryRunOnly: true,
    note: "V17.6 dry-run only. No Binance real order was sent.",
  };
  const storage = await writeExecutionLog([entry, ...logs]);
  return { entry, storage };
}
