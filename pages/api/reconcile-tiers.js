import { readLedger, writeLedger, normalizeSymbol, getTriggeredDipTiers } from "../../lib/v16-ledger";

function clean(v) {
  return String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function num(v, fallback = 0) {
  const n = Number(v || 0);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function ledgerCost(rows = {}) {
  return ["N", "D1", "D2", "D3", "D4"].reduce((sum, tier) => {
    return sum + (rows[tier] || []).reduce((s, r) => s + num(r.amount), 0);
  }, 0);
}

function hasUsableAsset(asset) {
  return Boolean(asset?.symbol && Array.isArray(asset?.rules) && asset.rules.length);
}

function hasUsableHolding(holding) {
  return Boolean(holding?.symbol && num(holding.quantity) > 0);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  try {
    const assets = Array.isArray(req.body?.assets) ? req.body.assets : [];
    const holdings = Array.isArray(req.body?.holdings) ? req.body.holdings : [];

    if (!assets.some(hasUsableAsset)) {
      return res.status(400).json({ ok: false, error: "missing_or_invalid_assets", message: "reconcile requires non-empty price assets" });
    }

    if (!holdings.some(hasUsableHolding)) {
      return res.status(400).json({ ok: false, error: "missing_or_invalid_holdings", message: "reconcile requires non-empty wallet holdings" });
    }

    const map = new Map(assets.map((a) => [clean(a.symbol), a]));
    const ledger = await readLedger();
    const added = [];
    const skipped = [];
    const now = new Date().toISOString();

    for (const h of holdings) {
      if (num(h.quantity) <= 0) continue;
      const asset = map.get(clean(h.symbol));
      if (!asset) continue;
      const symbol = normalizeSymbol(asset.symbol);
      const tiers = getTriggeredDipTiers(asset.discount, asset.rules || []);
      let available = num(h.totalCost, num(h.currentValue, 0)) - ledgerCost(ledger[symbol]);

      for (const item of tiers) {
        const tier = item.tier;
        if (ledger[symbol][tier]?.length) {
          skipped.push({ symbol, tier, reason: "exists" });
          continue;
        }
        const level = Number(tier.replace("D", ""));
        const amount = num(asset.amounts?.[level - 1], 0);
        if (amount <= 0 || available + 0.01 < amount) {
          skipped.push({ symbol, tier, reason: "insufficient_wallet_cost", available, amount });
          continue;
        }
        ledger[symbol][tier].push({
          time: now,
          amount,
          price: num(h.tokenPrice, num(h.marketPrice, null)),
          quantity: num(h.quantity),
          mode: "wallet_reconcile",
          note: "wallet_reconcile_" + tier,
          leftBuyZone: false,
          leftBuyZoneAt: null
        });
        available -= amount;
        added.push({ symbol, tier, amount });
      }
    }

    const writeResult = added.length ? await writeLedger(ledger) : { store: "unchanged" };
    return res.status(200).json({ ok: true, addedCount: added.length, added, skipped, storage: writeResult.store, ledger });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "reconcile_tiers_failed", message: error.message });
  }
}
