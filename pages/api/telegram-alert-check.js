import { canSendAlert, markAlertSent, readAlerts } from "../../lib/v16-ledger";

function alertKey(symbol, tier) {
  return `${String(symbol || "").trim()}_${String(tier || "").trim().toUpperCase()}`;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");

  try {
    const now = new Date().toISOString();

    if (req.method === "GET") {
      const alerts = await readAlerts();
      return res.status(200).json({ ok: true, alerts });
    }

    if (req.method === "POST") {
      const { symbol, tier, commit = false } = req.body || {};
      if (!symbol || !tier) throw new Error("missing_symbol_or_tier");

      const key = alertKey(symbol, tier);
      const alerts = await readAlerts();
      const allowed = canSendAlert(alerts, key, now, 12);

      if (allowed && commit) {
        const saved = await markAlertSent(key, now);
        return res.status(200).json({ ok: true, key, allowed: true, committed: true, alert: saved });
      }

      return res.status(200).json({ ok: true, key, allowed, committed: false, lastAlert: alerts?.[key]?.lastAlert || null });
    }

    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  } catch (error) {
    return res.status(400).json({ ok: false, error: error.message });
  }
}
