import { readPaperTrades } from "../../../lib/v17-paper-engine";
import { nowIso, writePaperStore } from "../../../lib/v17-paper-store";
import { countPaperLegacyText, sanitizePaperObject } from "../../../lib/v17-paper-text-sanitizer";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  try {
    const dryRun = String(req.query?.dryRun || req.body?.dryRun || "false").toLowerCase() === "true";
    const trades = await readPaperTrades();
    const beforeHits = countPaperLegacyText(trades);
    const cleanedTrades = sanitizePaperObject(trades).map((trade) => ({
      ...trade,
      legacyTextCleanedAt: beforeHits.length ? nowIso() : trade.legacyTextCleanedAt,
      legacyTextPolicy: beforeHits.length ? "full_paper_store_legacy_text_cleanup_yahoo_7d_placeholder" : trade.legacyTextPolicy,
      realOrder: false,
    }));
    const afterHits = countPaperLegacyText(cleanedTrades);
    const storage = dryRun ? null : await writePaperStore("trades", cleanedTrades);

    return res.status(200).json({
      ok: true,
      dryRun,
      cleanedAt: nowIso(),
      rule: "全域清理紙上交易 store 舊文字：Yahoo / 7天 / $100 / 52週高點殘留；不改價格、不改數量、不改 PnL、不真實下單。",
      tradeCount: trades.length,
      beforeLegacyHitCount: beforeHits.length,
      afterLegacyHitCount: afterHits.length,
      beforeLegacyHits: beforeHits.slice(0, 50).map((hit) => ({ path: hit.path, pattern: hit.pattern })),
      afterLegacyHits: afterHits.slice(0, 50).map((hit) => ({ path: hit.path, pattern: hit.pattern, value: hit.value })),
      storage,
      realOrder: false,
      autoTrade: false,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "paper_clean_all_legacy_text_failed" });
  }
}
