import { markLeftBuyZonesForAssets, getExecutableTiers, normalizeLedger } from "../../lib/v16-ledger";

function sortDecisions(a, b) {
  if (a.level !== b.level) return b.level - a.level;
  return Math.abs(Number(b.discount || 0)) - Math.abs(Number(a.discount || 0));
}

function buildTriggeredProgress({ tier, amount }) {
  return {
    stageText: `${tier} 已達買點`,
    fromText: `${amount}U`,
    toText: "可買入",
    progress: 100,
    displayProgress: 100,
    isTriggered: true
  };
}

function buildDecisions(assets, ledger, now) {
  const dedup = new Map();

  for (const asset of assets || []) {
    const executable = getExecutableTiers({
      ledger,
      symbol: asset.symbol,
      discount: asset.discount,
      rules: asset.rules,
      now
    });

    for (const { tier, level, rule } of executable) {
      const key = `${asset.symbol}_${tier}`;
      const amount = Number(asset.amounts?.[level - 1] || 0);
      const row = {
        symbol: asset.symbol,
        name: asset.name,
        grade: asset.grade,
        tier,
        level,
        rule,
        discount: asset.discount,
        price: asset.price,
        amount,
        progress: buildTriggeredProgress({ tier, amount }),
        command: `/buy ${asset.symbol} ${tier} ${amount}`
      };

      const previous = dedup.get(key);
      if (!previous || Math.abs(Number(row.discount || 0)) > Math.abs(Number(previous.discount || 0))) {
        dedup.set(key, row);
      }
    }
  }

  return Array.from(dedup.values()).sort(sortDecisions);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");

  try {
    const now = new Date().toISOString();

    if (req.method === "POST") {
      const assets = req.body?.assets || [];
      const postedLedger = req.body?.ledger;
      const hasPostedLedger = postedLedger && typeof postedLedger === "object";
      const ledgerResult = hasPostedLedger
        ? { ledger: normalizeLedger(postedLedger), changed: false, source: "posted-ledger" }
        : { ...(await markLeftBuyZonesForAssets(assets)), source: "store-ledger" };
      const decisions = buildDecisions(assets, ledgerResult.ledger, now);
      return res.status(200).json({
        ok: true,
        mode: "posted-assets",
        ledgerSource: ledgerResult.source,
        updatedAt: now,
        ledgerUpdatedForLeftBuyZone: ledgerResult.changed,
        count: decisions.length,
        totalAmount: decisions.reduce((s, item) => s + Number(item.amount || 0), 0),
        decisions
      });
    }

    if (req.method === "GET") {
      return res.status(200).json({
        ok: true,
        message: "POST assets from /api/prices to calculate V16 manual decisions.",
        usage: { method: "POST", body: { assets: "array from /api/prices data", ledger: "optional buy-ledger object" } }
      });
    }

    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "today_decisions_failed", message: error.message });
  }
}
