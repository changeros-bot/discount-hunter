import { getAssetRegistry } from "../../../lib/v17-asset-registry";
import { getV17StorageStatus } from "../../../lib/v17-storage";

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const status = req.query?.status ? String(req.query.status) : undefined;
  const assets = getAssetRegistry({ status });

  return res.status(200).json({
    ok: true,
    version: "v17",
    architecture: "asset_registry_v1",
    storage: getV17StorageStatus(),
    count: assets.length,
    assets
  });
}
