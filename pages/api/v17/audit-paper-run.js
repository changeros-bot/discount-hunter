import { getMarket91AuditPaperCandidates } from "../../../lib/v17-market-91-audit-paper-candidates";
import { nowIso, readPaperStore, taipeiDateKey, writePaperStore } from "../../../lib/v17-paper-store";

function buildPlaybook(asset) {
  return {
    title: `${asset.symbol} 7天紙上交易 Playbook`,
    thesis: asset.reason || "Market91 audit 已驗證候選，先用 7 天紙上交易驗證。",
    entryRule: "只做紙上測試建倉；每筆 5U；用 7 天績效觀察波動與方向。",
    sizing: "每檔 5U；不加碼；不補倉；不轉真倉。",
    exitRule: "第 7 天檢查 PnL、最大浮虧、資料品質；表現不穩定則退回觀察。",
    riskRule: asset.risk || "風險旗標需持續追蹤。",
    whyIncluded: asset.finalDecision || "Evidence 已完成且沒有硬性 Blocker。",
    whyNotReal: "這只是 Market91 audit 紙上候選，不是真實交易白名單；禁止真實自動交易。",
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  try {
    const today = taipeiDateKey();
    const now = nowIso();
    const trades = await readPaperStore("trades", []);
    const existing = new Set((Array.isArray(trades) ? trades : []).map((trade) => String(trade.id || "")));
    const candidates = getMarket91AuditPaperCandidates();
    const created = [];
    const skipped = [];

    for (const asset of candidates) {
      const id = `PAPER-${today.replace(/-/g, "")}-${asset.symbol}-AUDIT`;
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
        group: "Market91審核紙上測試",
        sourceType: "market91_audit_verified",
        tier: "AUDIT",
        amountUSDT,
        price,
        quantity: amountUSDT / price,
        discount: 0,
        trigger: "Audit 紙上測試建倉",
        source: "Market91審核紙上測試自動紙上交易",
        testDays: 7,
        status: "OPEN",
        realOrder: false,
        quality: asset.quality,
        score: asset.score,
        bucket: asset.bucket,
        playbook: buildPlaybook(asset),
      });
    }

    const nextTrades = created.length ? [...created, ...(Array.isArray(trades) ? trades : [])] : trades;
    const storage = created.length ? await writePaperStore("trades", nextTrades) : null;

    return res.status(200).json({
      ok: true,
      today,
      candidateCount: candidates.length,
      createdCount: created.length,
      skippedCount: skipped.length,
      created,
      skipped,
      storage,
      realOrder: false,
      rule: "Evidence 已完成且無硬性 Blocker 的 Market91 audit 候選，全部進 7 天紙上交易；禁止真實交易。",
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "audit_paper_run_failed" });
  }
}
