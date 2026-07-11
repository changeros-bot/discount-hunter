import { applyPaperDiscountRule } from "../../../lib/v17-paper-discount-rules";
import { getMarket10PaperCandidates, getMarket10Verification } from "../../../lib/v17-market10-verification";
import { nowIso, readPaperStore, taipeiDateKey, writePaperStore } from "../../../lib/v17-paper-store";

function buildPlaybook(asset) {
  return {
    title: `${asset.symbol} 7天紙上交易 Playbook`,
    thesis: asset.decision || "Market10 折價候選已驗證，先用 7 天紙上交易驗證。",
    entryRule: "只做紙上測試建倉；不轉真倉。",
    sizing: `${asset.paperAmountUSDT || 5}U 紙上測試；不加碼；不補倉；不轉真倉。`,
    exitRule: "第 7 天檢查 PnL、最大浮虧、資料品質；若風險惡化則退回觀察或封鎖。",
    riskRule: asset.risk || "風險旗標需持續追蹤。",
    whyIncluded: asset.finalDecision || asset.decision || "Evidence 已完成且沒有硬性 Blocker。",
    whyNotReal: "這只是 Market10 折價候選紙上測試，不是真實交易白名單；禁止真實自動交易。",
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  try {
    const today = taipeiDateKey();
    const now = nowIso();
    const trades = await readPaperStore("trades", []);
    const list = Array.isArray(trades) ? trades : [];
    const existing = new Set(list.map((trade) => String(trade.id || "")));
    const candidates = getMarket10PaperCandidates();
    const created = [];
    const skipped = [];

    for (const asset of candidates) {
      const id = `PAPER-${today.replace(/-/g, "")}-${asset.symbol}-M10`;
      if (existing.has(id)) {
        skipped.push({ symbol: asset.symbol, reason: "already_created" });
        continue;
      }
      const price = 100;
      const amountUSDT = asset.paperAmountUSDT || 5;
      const baseTrade = {
        id,
        dateKey: today,
        createdAt: now,
        symbol: asset.symbol,
        name: asset.name,
        group: "Market10折價候選紙上測試",
        sourceType: "market10_discount_verified",
        tier: "M10",
        amountUSDT,
        price,
        quantity: amountUSDT / price,
        discount: 0,
        trigger: "Market10 折價候選紙上建倉",
        source: "Market10折價候選驗證",
        testDays: 7,
        status: "OPEN",
        realOrder: false,
        quality: asset.quality,
        score: asset.score,
        bucket: asset.bucket,
        playbook: buildPlaybook(asset),
      };
      created.push(applyPaperDiscountRule(baseTrade));
    }

    const nextTrades = created.length ? [...created, ...list] : list;
    const storage = created.length ? await writePaperStore("trades", nextTrades) : null;
    const verification = getMarket10Verification();

    return res.status(200).json({
      ok: true,
      today,
      verification,
      candidateCount: candidates.length,
      createdCount: created.length,
      skippedCount: skipped.length,
      created,
      skipped,
      storage,
      realOrder: false,
      blocked: verification.rows.filter((row) => row.hasBlocker).map((row) => ({ symbol: row.symbol, blocker: row.blocker })),
      rule: "Market10：Evidence 完成且無硬性 Blocker 者進 7 天紙上；CRWV 封鎖；禁止真實交易。",
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "market10_paper_run_failed" });
  }
}
