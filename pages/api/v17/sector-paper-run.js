import { nowIso, readPaperStore, taipeiDateKey, writePaperStore } from "../../../lib/v17-paper-store";

const SECTOR_PAPER_CANDIDATES = [
  {
    symbol: "REGN",
    name: "Regeneron",
    group: "Market45產業模組紙上測試",
    sourceType: "market45_sector_module_verified",
    tier: "SECTOR",
    amountUSDT: 5,
    price: 100,
    quality: "SECTOR_VERIFIED",
    score: 12,
    bucket: "生技 / 製藥",
    reason: "生技模組通過；Dupixent 需求強，EYLEA / EYLEA HD、pipeline 與 FDA / manufacturing timing 為追蹤風險，但不是硬性 Blocker。",
    risk: "EYLEA sales pressure, EYLEA HD transition, pipeline concentration, FDA/manufacturing timing, and Dupixent successor visibility must be tracked.",
  },
];

function buildPlaybook(asset) {
  return {
    title: `${asset.symbol} 7天紙上交易 Playbook`,
    thesis: asset.reason,
    entryRule: "只做紙上測試建倉；每筆 5U；產業模組通過後用 7 天績效觀察波動與方向。",
    sizing: "每檔 5U；不加碼；不補倉；不轉真倉。",
    exitRule: "第 7 天檢查 PnL、最大浮虧、資料品質；若產業風險惡化則退回觀察。",
    riskRule: asset.risk,
    whyIncluded: "專用產業模組已通過，沒有硬性 Blocker；允許 7 天紙上交易。",
    whyNotReal: "這只是產業模組紙上候選，不是真實交易白名單；禁止真實自動交易。",
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
    const created = [];
    const skipped = [];

    for (const asset of SECTOR_PAPER_CANDIDATES) {
      const id = `PAPER-${today.replace(/-/g, "")}-${asset.symbol}-SECTOR`;
      if (existing.has(id)) {
        skipped.push({ symbol: asset.symbol, reason: "already_created" });
        continue;
      }
      created.push({
        id,
        dateKey: today,
        createdAt: now,
        symbol: asset.symbol,
        name: asset.name,
        group: asset.group,
        sourceType: asset.sourceType,
        tier: asset.tier,
        amountUSDT: asset.amountUSDT,
        price: asset.price,
        quantity: asset.amountUSDT / asset.price,
        discount: 0,
        trigger: "產業模組紙上測試建倉",
        source: "Market45產業模組紙上測試自動紙上交易",
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
      candidateCount: SECTOR_PAPER_CANDIDATES.length,
      createdCount: created.length,
      skippedCount: skipped.length,
      created,
      skipped,
      storage,
      realOrder: false,
      rule: "專用產業模組通過且沒有硬性 Blocker 的候選，允許繞過每日上限補進 7 天紙上交易；禁止真實交易。",
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "sector_paper_run_failed" });
  }
}
