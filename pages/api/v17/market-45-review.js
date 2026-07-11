import { readMarket45Review } from "../../../lib/v17-paper-engine";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  try {
    if (req.method !== "GET") return res.status(405).json({ ok: false, error: "method_not_allowed" });
    const review = await readMarket45Review();
    return res.status(200).json({ ok: true, ...review });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "market_45_review_failed" });
  }
}
