import { getV17StorageStatus } from "../../../lib/v17-storage";

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const storage = getV17StorageStatus();
  const productionUnsafe = storage.requiresDurable && !storage.durable;

  return res.status(productionUnsafe ? 500 : 200).json({
    ok: !productionUnsafe,
    version: "v17",
    storage,
    guardrail: "V17 mutable state never writes to runtime files.",
    productionUnsafe
  });
}
