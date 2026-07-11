import { readPaperStore, writePaperStore } from "../../../lib/v17-paper-store";

const OLD_IDS = new Set([
  "PAPER-20260711-MSFT-MARKET10",
  "PAPER-20260711-NFLX-MARKET10",
  "PAPER-20260711-ADBE-MARKET10",
  "PAPER-20260711-SOFI-MARKET10",
]);

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  try {
    const trades = await readPaperStore("trades", []);
    const list = Array.isArray(trades) ? trades : [];
    const removed = list.filter((trade) => OLD_IDS.has(trade?.id)).map((trade) => trade.id);
    const next = list.filter((trade) => !OLD_IDS.has(trade?.id));
    const storage = removed.length ? await writePaperStore("trades", next) : null;

    return res.status(200).json({
      ok: true,
      beforeCount: list.length,
      afterCount: next.length,
      removedCount: removed.length,
      removed,
      kept: [
        "PAPER-20260711-MSFT-M10",
        "PAPER-20260711-NFLX-M10",
        "PAPER-20260711-ADBE-M10",
        "PAPER-20260711-SOFI-M10",
      ],
      storage,
      realOrder: false,
      rule: "Market10 cleanup：刪除舊版 MARKET10 紙上紀錄，只保留新版 M10；不影響真實交易。",
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "paper_clean_market10_failed" });
  }
}
