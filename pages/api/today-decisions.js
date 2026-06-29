import { readLedger, getExecutableTiers, normalizeLedger } from "../../lib/v16-ledger";

function sortDecisions(a, b) {
  if (a.level !== b.level) return b.level - a.level;
  return Math.abs(Number(b.discount || 0)) - Math.abs(Number(a.discount || 0));
}

function buildTriggeredProgress({ tier, amount }) {
  return {
    stageText: `${tier} 已達買點`,
    fromText: `${amount}U`,
    toText: "可執行",
    progress: 100,
    displayProgress: 100,
    isTriggered: true
  };
}

function isExplicitManualRow(row) {
  const mode = String(row?.mode || "").toLowerCase();
  const note = String(row?.note || "").toLowerCase();
  return mode === "dip_manual" || mode === "dca_manual" || note.includes("manual");
}

function explicitLedgerOnly(ledger) {
  const normalized = normalizeLedger(ledger || {});
  const output = normalizeLedger({});
  for (const [symbol, tiers] of Object.entries(normalized)) {
    for (const [tier, rows] of Object.entries(tiers || {})) {
      output[symbol][tier] = Array.isArray(rows) ? rows.filter(isExplicitManualRow) : [];
    }
  }
  return output;
}

function buildDecisions(assets, ledger, now) {
  const dedup = new Map();
  const explicitLedger = explicitLedgerOnly(ledger);

  for (const asset of assets || []) {
    const executable = getExecutableTiers({
      ledger: explicitLedger,
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
        triggeredAt: now,
        progress: buildTriggeredProgress({ tier, amount }),
        completionRule: "explicit_manual_mark_required"
      };

      const previous = dedup.get(key);
      if (!previous || Math.abs(Number(row.discount || 0)) > Math.abs(Number(previous.discount || 0))) dedup.set(key, row);
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
        : { ledger: await readLedger(), changed: false, source: "store-ledger-readonly" };
      const decisions = buildDecisions(assets, ledgerResult.ledger, now);
      return res.status(200).json({
        ok: true,
        mode: "posted-assets",
        ledgerSource: ledgerResult.source,
        completionRule: "explicit_manual_mark_only",
        updatedAt: now,
        ledgerUpdatedForLeftBuyZone: false,
        count: decisions.length,
        totalAmount: decisions.reduce((s, item) => s + Number(item.amount || 0), 0),
        decisions
      });
    }

    if (req.method === "GET") {
      return res.status(200).json({ ok: true, message: "POST assets from /api/prices to calculate V16 manual decisions." });
    }

    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "today_decisions_failed", message: error.message });
  }
}
