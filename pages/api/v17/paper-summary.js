import { getPaperSummary } from "../../../lib/v17-paper-engine";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  try {
    if (req.method !== "POST" && req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }
    const body = req.method === "POST" ? (req.body || {}) : {};
    const persistMetrics = String(req.query?.persistMetrics || body.persistMetrics || "").toLowerCase() === "true";
    const result = await getPaperSummary({ markets: body.markets || {}, persistMetrics });
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "paper_summary_failed" });
  }
}
