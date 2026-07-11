import { getMarket10Review } from "../../../lib/v17-market-10-discount-candidates";
import { nowIso, readPaperStore, taipeiDateKey, writePaperStore } from "../../../lib/v17-paper-store";

function buildPlaybook(asset) {
  const rules = Array.isArray(asset.rules) ? asset.rules : [];
  const amounts = Array.isArray(asset.amounts) ? asset.amounts : [];
  return {
    title: `${asset.symbol} 7天紙上交易 Playbook`,
    thesis: asset.decision,
    entryRule: rules.length ? `參考高點：52w_high_or_fallback；折價層級：${rules.map((x, i) => `D${i + 1} ${x}%`).join(" / ")}` : "封鎖；不設定買點。",
    sizing: amounts.length ? `層級金額：${amounts.map((x, i) => `D${i + 1} ${x}U`).join(" / ")}` : "封鎖；不配置。",
    exitRule: "第 7 天檢查 PnL、最大浮虧、資料品質與風險旗標；表現不穩定則退回觀察。",
    riskRule: asset.risk,
    whyIncluded: asset.canEnterPaperTrading ? "Evidence 已完成且沒有硬性 Blocker；允許 7 天紙上交易。" : "有硬性 Blocker，不進紙上交易。",
    whyNotReal: "這只是 Market10 折價候選紙上測試，不是真實交易白名單；禁止真實自動交易。",
    buyPointRule: rules.length ? `參考高點：52w_high_or_fallback；折價層級：${rules.map((x, i) => `D${i + 1} ${x}%`).join(" / ")}` : "封鎖；不設定買點。",
    ruleNote: asset.ruleNote,
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  try {
    const review = getMarket10Review();
    const today = taipeiDateKey();
    const now = nowIso();
    const trades = await readPaperStore("trades", []);
    const list = Array.isArray(trades) ? trades : [];
    const existing = new Set(list.map((trade) => String(trade.id || "")));
    const created = [];
    const blocked = [];
    const skipped = [];

    for (const asset of review.rows) {
      if (!asset.canEnterPaperTrading) {
        blocked.push({ symbol: asset.symbol, reason: asset.blocker || "not_paper_approved" });
        continue;
      }
      const id = `PAPER-${today.replace(/-/g, "")}-${asset.symbol}-MARKET10`;
      if (existing.has(id)) {
        skipped.push({ symbol: asset.symbol, reason: "already_created" });
        continue;
      }
      const price = 100;
      const amountUSDT = 5;
      created.push({
        id,
        dateKey: today,
        createdAt: now,
        symbol: asset.symbol,
        name: asset.name,
        group: "Market10折價候選紙上測試",
        sourceType: "market10_discount_candidate",
        tier: "MARKET10",
        amountUSDT,
        price,
        quantity: amountUSDT / price,
        discount: 0,
        trigger: "Market10 折價候選紙上測試建倉",
        source: "Market10折價候選驗證",
        testDays: 7,
        status: "OPEN",
        realOrder: false,
        quality: asset.quality,
        score: asset.score,
        bucket: asset.bucket,
        discountModel: "market10_discount_rule_v1",
        referenceMode: "52w_high_or_fallback",
        profile: asset.bucket,
        rules: asset.rules,
        amounts: asset.amounts,
        ruleNote: asset.ruleNote,
        playbook: buildPlaybook(asset),
      });
    }

    const storage = created.length ? await writePaperStore("trades", [...created, ...list]) : null;
    return res.status(200).json({
      ok: true,
      today,
      reviewed: review.total,
      createdCount: created.length,
      blockedCount: blocked.length,
      skippedCount: skipped.length,
      created,
      blocked,
      skipped,
      storage,
      realOrder: false,
      rule: "Market10：Evidence 已完成且無硬性 Blocker 才進 7 天紙上；CRWV 封鎖；禁止真實交易。",
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "market10_paper_run_failed" });
  }
}
