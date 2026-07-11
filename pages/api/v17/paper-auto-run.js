import { runAutoPaperTrading } from "../../../lib/v17-paper-engine";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  try {
    if (req.method !== "POST" && req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }
    const body = req.method === "POST" ? (req.body || {}) : {};
    const result = await runAutoPaperTrading({ markets: body.markets || {}, force: body.force === true });
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "paper_auto_run_failed" });
  }
}
