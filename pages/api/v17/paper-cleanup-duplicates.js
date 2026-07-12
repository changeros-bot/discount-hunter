import { nowIso, readPaperStore, writePaperStore } from "../../../lib/v17-paper-store";

function normalizeSymbol(symbol) {
  return String(symbol || "").trim().toUpperCase().replace(/ON$/, "");
}

function cleanupKey(trade = {}) {
  return [
    normalizeSymbol(trade.symbol),
    String(trade.group || "未分類"),
    String(trade.sourceType || "unknown"),
  ].join("::");
}

function timeValue(trade = {}) {
  const value = Date.parse(trade.repairedAt || trade.createdAt || trade.dateKey || "");
  return Number.isFinite(value) ? value : 0;
}

function rankTrade(trade = {}) {
  let score = 0;
  if (trade.status === "OPEN") score += 1000;
  if (trade.repairedAt || /REPAIRED/i.test(String(trade.id || ""))) score += 500;
  if (Number(trade.price || 0) !== 100) score += 100;
  if (trade.quoteAudit?.status === "PASS") score += 50;
  return score;
}

function chooseWinner(rows = []) {
  return [...rows].sort((a, b) => {
    const rankDiff = rankTrade(b) - rankTrade(a);
    if (rankDiff) return rankDiff;
    return timeValue(b) - timeValue(a);
  })[0];
}

function isCleanupEligible(trade = {}) {
  if (!trade || trade.status !== "OPEN") return false;
  if (trade.realOrder === true) return false;
  const text = `${trade.source || ""} ${trade.group || ""} ${trade.sourceType || ""}`;
  return /紙上|paper|Market45|Market91|Market10|既有V17|既有10/i.test(text);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  try {
    const dryRun = String(req.query?.dryRun ?? req.body?.dryRun ?? "true").toLowerCase() !== "false";
    const checkedAt = nowIso();
    const trades = await readPaperStore("trades", []);
    const list = Array.isArray(trades) ? trades : [];

    const groups = new Map();
    for (const trade of list.filter(isCleanupEligible)) {
      const key = cleanupKey(trade);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(trade);
    }

    const winners = new Map();
    const replacements = [];
    for (const [key, rows] of groups.entries()) {
      if (rows.length <= 1) continue;
      const winner = chooseWinner(rows);
      winners.set(key, winner.id);
      for (const row of rows) {
        if (row.id === winner.id) continue;
        replacements.push({
          id: row.id,
          symbol: row.symbol,
          group: row.group || "未分類",
          sourceType: row.sourceType || "unknown",
          replacedBy: winner.id,
          reason: "duplicate_open_paper_lot_same_symbol_group_source",
        });
      }
    }

    const replacementMap = new Map(replacements.map((row) => [row.id, row]));
    const nextTrades = list.map((trade) => {
      const replacement = replacementMap.get(trade.id);
      if (!replacement) return trade;
      return {
        ...trade,
        status: "CLOSED_REPLACED",
        closedAt: checkedAt,
        replacedBy: replacement.replacedBy,
        closeReason: replacement.reason,
        realOrder: false,
        cleanupNote: "Duplicate paper lot closed for performance hygiene; retained for audit trail; no real order was created or modified.",
      };
    });

    const storage = !dryRun && replacements.length ? await writePaperStore("trades", nextTrades) : null;
    const remainingOpen = nextTrades.filter((trade) => trade.status === "OPEN");
    const effectiveOpenKeys = new Set(remainingOpen.map(cleanupKey));

    return res.status(200).json({
      ok: true,
      dryRun,
      checkedAt,
      totalTrades: list.length,
      openBefore: list.filter((trade) => trade.status === "OPEN").length,
      duplicateGroups: [...groups.values()].filter((rows) => rows.length > 1).length,
      closedReplacedCount: replacements.length,
      openAfter: remainingOpen.length,
      effectiveOpenKeys: effectiveOpenKeys.size,
      replacements,
      kept: [...winners.entries()].map(([key, id]) => ({ key, id })),
      storage,
      realOrder: false,
      rule: "Keep the best/latest repaired OPEN paper lot per symbol+group+sourceType; mark older duplicates CLOSED_REPLACED instead of deleting them.",
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "paper_cleanup_duplicates_failed" });
  }
}
