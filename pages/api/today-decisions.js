import { markLeftBuyZonesForAssets, getExecutableTiers } from "../../lib/v16-ledger";

function sortDecisions(a, b) {
  if (a.level !== b.level) return b.level - a.level;
  return Math.abs(Number(b.discount || 0)) - Math.abs(Number(a.discount || 0));
}

function buildTriggeredProgress({ tier, level, amount }) {
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
  return (assets || [])
    .flatMap((asset) => {
      const executable = getExecutableTiers({
        ledger,
        symbol: asset.symbol,
        discount: asset.discount,
        rules: asset.rules,
        now
      });

      return executable.map(({ tier, level, rule }) => {
        const amount = Number(asset.amounts?.[level - 1] || 0);
        return {
          symbol: asset.symbol,
          name: asset.name,
          grade: asset.grade,
          tier,
          level,
          rule,
          discount: asset.discount,
          price: asset.price,
          amount,
          progress: buildTriggeredProgress({ tier, level, amount }),
          command: `/buy ${asset.symbol} ${tier} ${amount}`
        };
      });
    })
    .sort(sortDecisions);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");

  try {
    const now = new Date().toISOString();

    if (req.method === "POST") {
      const assets = req.body?.assets || [];
      const { ledger, changed } = await markLeftBuyZonesForAssets(assets);
      const decisions = buildDecisions(assets, ledger, now);
      return res.status(200).json({
        ok: true,
        mode: "posted-assets",
        updatedAt: now,
        ledgerUpdatedForLeftBuyZone: changed,
        count: decisions.length,
        totalAmount: decisions.reduce((s, item) => s + Number(item.amount || 0), 0),
        decisions
      });
    }

    if (req.method === "GET") {
      return res.status(200).json({
        ok: true,
        message: "POST assets from /api/prices to calculate V16 manual decisions.",
        usage: { method: "POST", body: { assets: "array from /api/prices data" } }
      });
    }

    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "today_decisions_failed", message: error.message });
  }
}
