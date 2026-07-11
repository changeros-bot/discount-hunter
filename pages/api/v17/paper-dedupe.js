import { readPaperStore, writePaperStore } from "../../../lib/v17-paper-store";

function older(a, b) {
  const ta = Date.parse(a?.createdAt || "") || 0;
  const tb = Date.parse(b?.createdAt || "") || 0;
  if (!ta) return b;
  if (!tb) return a;
  return ta <= tb ? a : b;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  try {
    const trades = await readPaperStore("trades", []);
    const list = Array.isArray(trades) ? trades : [];
    const byId = new Map();
    const duplicateIds = new Set();

    for (const trade of list) {
      const id = String(trade?.id || "");
      if (!id) continue;
      if (byId.has(id)) {
        duplicateIds.add(id);
        byId.set(id, older(byId.get(id), trade));
      } else {
        byId.set(id, trade);
      }
    }

    const deduped = [...byId.values()].sort((a, b) => (Date.parse(b?.createdAt || "") || 0) - (Date.parse(a?.createdAt || "") || 0));
    const removedCount = list.length - deduped.length;
    const storage = removedCount > 0 ? await writePaperStore("trades", deduped) : null;

    return res.status(200).json({
      ok: true,
      beforeCount: list.length,
      afterCount: deduped.length,
      removedCount,
      duplicateIds: [...duplicateIds],
      storage,
      rule: "紙上交易 dedupe：同一 id 只保留最早建立的一筆；不影響真實交易，realOrder 仍為 false。",
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "paper_dedupe_failed" });
  }
}
