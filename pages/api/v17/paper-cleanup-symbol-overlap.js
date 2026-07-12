import { nowIso, readPaperStore, writePaperStore } from "../../../lib/v17-paper-store";

function normalizeSymbol(symbol) {
  return String(symbol || "").trim().toUpperCase().replace(/ON$/, "");
}

function timeValue(trade = {}) {
  const value = Date.parse(trade.repairedAt || trade.createdAt || trade.dateKey || "");
  return Number.isFinite(value) ? value : 0;
}

function sourcePriority(trade = {}) {
  const group = String(trade.group || "");
  const sourceType = String(trade.sourceType || "");
  if (/sector_module|產業模組/i.test(`${group} ${sourceType}`)) return 500;
  if (/market45_candidate|Market45紙上測試/i.test(`${group} ${sourceType}`)) return 400;
  if (/market10_discount_verified|Market10/i.test(`${group} ${sourceType}`)) return 350;
  if (/market91_audit_verified|Market91/i.test(`${group} ${sourceType}`)) return 300;
  if (/existing_ten|既有V17/i.test(`${group} ${sourceType}`)) return 250;
  return 100;
}

function qualityPriority(trade = {}) {
  const text = `${trade.quality || ""} ${trade.bucket || ""}`;
  if (/SECTOR_VERIFIED/i.test(text)) return 80;
  if (/MARKET10_VERIFIED/i.test(text)) return 70;
  if (/AUDIT_VERIFIED/i.test(text)) return 60;
  if (/PASSED_DRAFT/i.test(text)) return 50;
  if (/WATCH/i.test(text)) return 30;
  return 0;
}

function rankTrade(trade = {}) {
  let score = sourcePriority(trade) + qualityPriority(trade);
  if (trade.repairedAt || /REPAIRED/i.test(String(trade.id || ""))) score += 20;
  if (Number(trade.price || 0) !== 100) score += 10;
  if (trade.quoteAudit?.status === "PASS") score += 5;
  return score;
}

function chooseWinner(rows = []) {
  return [...rows].sort((a, b) => {
    const rankDiff = rankTrade(b) - rankTrade(a);
    if (rankDiff) return rankDiff;
    return timeValue(b) - timeValue(a);
  })[0];
}

function isOpenPaperTrade(trade = {}) {
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
    for (const trade of list.filter(isOpenPaperTrade)) {
      const symbol = normalizeSymbol(trade.symbol);
      if (!symbol) continue;
      if (!groups.has(symbol)) groups.set(symbol, []);
      groups.get(symbol).push(trade);
    }

    const overlaps = [...groups.entries()].filter(([, rows]) => rows.length > 1);
    const replacements = [];
    const kept = [];

    for (const [symbol, rows] of overlaps) {
      const winner = chooseWinner(rows);
      kept.push({
        symbol,
        id: winner.id,
        group: winner.group || "未分類",
        sourceType: winner.sourceType || "unknown",
        rank: rankTrade(winner),
      });
      for (const row of rows) {
        if (row.id === winner.id) continue;
        replacements.push({
          id: row.id,
          symbol: row.symbol,
          group: row.group || "未分類",
          sourceType: row.sourceType || "unknown",
          replacedBy: winner.id,
          winnerGroup: winner.group || "未分類",
          winnerSourceType: winner.sourceType || "unknown",
          reason: "cross_source_open_paper_symbol_overlap",
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
        cleanupNote: `Cross-source duplicate paper lot closed; kept ${replacement.winnerGroup} / ${replacement.winnerSourceType}; retained for audit trail; no real order was created or modified.`,
      };
    });

    const storage = !dryRun && replacements.length ? await writePaperStore("trades", nextTrades) : null;
    const remainingOpen = nextTrades.filter((trade) => trade.status === "OPEN");
    const remainingSymbols = new Set(remainingOpen.map((trade) => normalizeSymbol(trade.symbol)));

    return res.status(200).json({
      ok: true,
      dryRun,
      checkedAt,
      totalTrades: list.length,
      openBefore: list.filter((trade) => trade.status === "OPEN").length,
      overlapSymbols: overlaps.map(([symbol, rows]) => ({
        symbol,
        count: rows.length,
        groups: rows.map((row) => `${row.group || "未分類"}/${row.sourceType || "unknown"}`),
      })),
      closedReplacedCount: replacements.length,
      openAfter: remainingOpen.length,
      symbolCountAfter: remainingSymbols.size,
      replacements,
      kept,
      storage,
      realOrder: false,
      rule: "For the same symbol across multiple OPEN paper sources, keep the highest-confidence source and mark lower-confidence lots CLOSED_REPLACED. Sector module > Market45 candidate > Market10 > Market91 > existing ten.",
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "paper_cleanup_symbol_overlap_failed" });
  }
}
