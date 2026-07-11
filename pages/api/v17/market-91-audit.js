import { getMarket91AuditTrail } from "../../../lib/v17-market-91-audit-trail";

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "method_not_allowed" });
  try {
    return res.status(200).json(getMarket91AuditTrail());
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "market_91_audit_failed" });
  }
}
