import { evaluateTradeReadiness } from "../../../lib/v17-risk-gate";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const body = req.method === "POST" ? (req.body || {}) : {};
    const readiness = await evaluateTradeReadiness({ decisions: body.decisions || [], candidate: body.candidate || null });
    return res.status(200).json({ ok: true, version: "v17.6-dry-run-risk-gate", ...readiness });
  } catch (error) {
    return res.status(400).json({ ok: false, error: error.message });
  }
}
