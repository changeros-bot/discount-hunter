import { V17_STORAGE_KEYS, readV17State, writeV17State, getV17StorageStatus } from "../../../lib/v17-storage";

function baseUrlFromReq(req) {
  const host = req.headers.host;
  const protocol = req.headers["x-forwarded-proto"] || "https";
  return `${protocol}://${host}`;
}
async function readJsonSafe(response) {
  return response ? response.json().catch(() => ({})) : {};
}
function paperEvents(events = []) {
  return events.filter((event) => event?.type === "paper_auto_engine_run").sort((a, b) => new Date(b.createdAt || b.time).getTime() - new Date(a.createdAt || a.time).getTime());
}
function buildRunEvent(dryRun, source) {
  const now = new Date().toISOString();
  const s = dryRun?.summary || {};
  return {
    id: `PAPER-AUTO-${now.replace(/[^0-9]/g, "")}`,
    type: "paper_auto_engine_run",
    status: "dry_run_recorded",
    source: source || "manual",
    createdAt: now,
    engine: "v17-paper-auto-engine-v1",
    autoTradingEnabled: false,
    wouldSubmitOrders: false,
    manualConfirmationRequired: true,
    killSwitchRequired: true,
    summary: {
      draftCount: s.draftCount || 0,
      qualityBlockedCount: s.qualityBlockedCount || 0,
      wouldRequestManualConfirmationCount: s.wouldRequestManualConfirmationCount || 0,
      wouldBlockCount: s.wouldBlockCount || 0,
      totalDraftAmountUsd: s.totalDraftAmountUsd || 0,
      readinessStatus: s.readinessStatus || null,
      readinessLabel: s.readinessLabel || null,
    },
    simulatedOrders: dryRun?.simulatedOrders || [],
    qualityBlocked: dryRun?.qualityBlocked || [],
    note: "Paper auto engine run only. No Binance order was submitted.",
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });
  try {
    const stored = await readV17State(V17_STORAGE_KEYS.EVENT_LOG, { updatedAt: null, events: [] });
    const events = Array.isArray(stored.events) ? stored.events : [];
    const shouldRun = req.method === "POST" || String(req.query.run || "") === "1";

    if (!shouldRun) {
      const runs = paperEvents(events);
      return res.status(200).json({
        ok: true,
        version: "v17-paper-auto-engine-v1",
        mode: "read_only_history",
        autoTradingEnabled: false,
        runCount: runs.length,
        latestRun: runs[0] || null,
        runs: runs.slice(0, 10),
        storage: getV17StorageStatus(),
      });
    }

    const base = baseUrlFromReq(req);
    const dryRunRes = await fetch(`${base}/api/v17/automation-dry-run?t=${Date.now()}`, { cache: "no-store" });
    const dryRun = await readJsonSafe(dryRunRes);
    if (!dryRunRes.ok || dryRun?.ok === false) throw new Error(dryRun?.error || `automation-dry-run ${dryRunRes.status}`);

    const event = buildRunEvent(dryRun, String(req.query.source || req.headers["x-paper-auto-source"] || "manual"));
    const next = { updatedAt: new Date().toISOString(), events: [...events, event] };
    const write = await writeV17State(V17_STORAGE_KEYS.EVENT_LOG, next);
    const runs = paperEvents(next.events);

    return res.status(200).json({
      ok: true,
      version: "v17-paper-auto-engine-v1",
      mode: "paper_auto_run_recorded",
      autoTradingEnabled: false,
      wouldSubmitOrders: false,
      runCount: runs.length,
      event,
      latestRun: event,
      write,
      storage: getV17StorageStatus(),
      note: "Paper auto engine recorded a dry-run result only. No Binance order was submitted.",
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "paper_auto_engine_failed" });
  }
}
