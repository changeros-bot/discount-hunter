const { getSixteenthBatch } = require("../../../lib/v17-market-91-sixteenth-batch");

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "method_not_allowed" });
  return res.status(200).json({ ok: true, updatedAt: new Date().toISOString(), ...getSixteenthBatch() });
}
