import { getAssetRegistry } from "../../../lib/v17-asset-registry";
import { ACTION_STATUS, buildV17Decisions } from "../../../lib/v17-decision-engine";
import { runV17SelfTest } from "../../../lib/v17-self-test";
import { getV17StorageStatus } from "../../../lib/v17-storage";

function check(name, ok, details = {}) {
  return { name, ok: Boolean(ok), details };
}

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const assets = getAssetRegistry();
  const selfTest = runV17SelfTest();
  const btc = assets.find((asset) => asset.symbol === "BTC");

  const queued = btc ? buildV17Decisions({
    assets: [btc],
    markets: { BTC: { symbol: "BTC", price: 70000, cycleHigh: 100000 } },
    now: "2026-06-30T00:00:00.000Z"
  }) : null;

  const completed = btc ? buildV17Decisions({
    assets: [btc],
    markets: { BTC: { symbol: "BTC", price: 70000, cycleHigh: 100000 } },
    events: [{ symbol: "BTC", price: 70000, amount: 15 }],
    now: "2026-06-30T00:00:00.000Z"
  }) : null;

  const checks = [
    check("asset_registry_available", assets.length > 0, { count: assets.length }),
    check("btc_available", Boolean(btc), { btc: Boolean(btc) }),
    check("self_test_passes", selfTest.ok, selfTest.summary),
    check("btc_queues_at_d3", queued?.actionQueue?.[0]?.symbol === "BTC" && queued?.actionQueue?.[0]?.tier === "D3", { actionQueue: queued?.actionQueue || [] }),
    check("btc_completion_leaves_queue", completed?.decisions?.[0]?.status === ACTION_STATUS.COMPLETE && completed?.actionCount === 0, { decision: completed?.decisions?.[0], actionCount: completed?.actionCount })
  ];

  const failed = checks.filter((item) => !item.ok);

  return res.status(failed.length ? 500 : 200).json({
    ok: failed.length === 0,
    version: "v17-smoke-test-v1",
    storage: getV17StorageStatus(),
    summary: { total: checks.length, passed: checks.length - failed.length, failed: failed.length },
    checks,
    failed
  });
}
