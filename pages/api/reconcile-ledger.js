export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  return res.status(410).json({
    ok: false,
    error: "legacy_endpoint_disabled",
    message: "/api/reconcile-ledger is a legacy D1-only writer and has been disabled for V16 safety. Use /api/reconcile-tiers instead.",
    replacement: "/api/reconcile-tiers",
    writesLedger: false
  });
}
