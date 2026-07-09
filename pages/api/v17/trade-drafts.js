import { createTradeDraft, readTradeDrafts } from "../../../lib/v17-trade-drafts";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  try {
    if (req.method === "GET") {
      const drafts = await readTradeDrafts();
      return res.status(200).json({ ok: true, drafts });
    }

    if (req.method === "POST") {
      const { decisions, candidate } = req.body || {};
      const result = await createTradeDraft({ decisions: decisions || [], candidate: candidate || null });
      return res.status(result.blocked ? 409 : 200).json({ ok: !result.blocked, dryRunOnly: true, ...result });
    }

    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  } catch (error) {
    return res.status(400).json({ ok: false, error: error.message });
  }
}
