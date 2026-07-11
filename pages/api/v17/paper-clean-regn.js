import { readPaperStore, writePaperStore } from "../../../lib/v17-paper-store";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  try {
    const trades = await readPaperStore("trades", []);
    const list = Array.isArray(trades) ? trades : [];
    const hasSectorRegn = list.some((trade) => trade?.id === "PAPER-20260711-REGN-SECTOR");
    const next = hasSectorRegn
      ? list.filter((trade) => trade?.id !== "PAPER-20260711-REGN-TEST")
      : list;
    const removedCount = list.length - next.length;
    const storage = removedCount > 0 ? await writePaperStore("trades", next) : null;

    return res.status(200).json({
      ok: true,
      beforeCount: list.length,
      afterCount: next.length,
      removedCount,
      kept: hasSectorRegn ? "PAPER-20260711-REGN-SECTOR" : null,
      removed: hasSectorRegn ? "PAPER-20260711-REGN-TEST" : null,
      storage,
      rule: "REGN 生技覆核只保留產業模組紙上部位；不重複統計。",
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "paper_clean_regn_failed" });
  }
}
