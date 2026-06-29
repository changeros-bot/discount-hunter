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
  const markets = req.method === "POST" ? (req.body?.markets || req.body?.marketData || {}) : {};
  const result = buildV17Decisions({ assets, markets, now });

  return res.status(200).json({
    ...result,
    storage: getV17StorageStatus(),
    guardrails: {
      readOnly: true,
      noAutoBuy: true,
      noLedgerWrite: true,
      ruleMigrationBlocked: true,
      universeFreezeRequiredBeforeRuleMigration: true
    }
  });
}
