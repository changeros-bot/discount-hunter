import { readLedger, writeLedger, normalizeSymbol, getTriggeredDipTiers } from "../../lib/v16-ledger";
const { hasKvConfig, requiresDurableKv } = require("../../lib/state/kv");

function clean(v) {
  return String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function baseKey(v) {
  return clean(v).replace(/ON$/, "");
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

function buildAssetMap(assets) {
  const map = new Map();
  for (const asset of assets) {
    if (!hasUsableAsset(asset)) continue;
    map.set(clean(asset.symbol), asset);
    map.set(baseKey(asset.symbol), asset);
  }
  return map;
}

function findAssetForHolding(map, holding) {
  const keys = [clean(holding.symbol), baseKey(holding.symbol), clean(holding.tokenSymbol), baseKey(holding.tokenSymbol)];
  for (const key of keys) {
    if (key && map.has(key)) return map.get(key);
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  try {
    const assets = Array.isArray(req.body?.assets) ? req.body.assets : [];
    const holdings = Array.isArray(req.body?.holdings) ? req.body.holdings : [];
    const dryRun = req.body?.dryRun === true || req.query?.dryRun === "true";

    if (!dryRun && requiresDurableKv() && !hasKvConfig()) {
      return res.status(409).json({
        ok: false,
        error: "missing_required_upstash_kv",
        message: "補登需要正式 durable Ledger 儲存；目前未設定 Upstash KV，因此沒有寫入。",
        releaseBlocked: true
      });
    }

    if (!assets.some(hasUsableAsset)) {
      return res.status(400).json({ ok: false, error: "missing_or_invalid_assets", message: "reconcile requires non-empty price assets" });
    }

    if (!holdings.some(hasUsableHolding)) {
      return res.status(400).json({ ok: false, error: "missing_or_invalid_holdings", message: "reconcile requires non-empty wallet holdings" });
    }

    const map = buildAssetMap(assets);
    const ledger = await readLedger();
    const workingLedger = JSON.parse(JSON.stringify(ledger));
    const added = [];
    const skipped = [];
    const now = new Date().toISOString();

    for (const h of holdings) {
      if (num(h.quantity) <= 0) continue;
      const asset = findAssetForHolding(map, h);
      if (!asset) {
        skipped.push({ symbol: h.symbol || h.tokenSymbol || null, reason: "asset_not_found" });
        continue;
      }
      const symbol = normalizeSymbol(asset.symbol);
      if (!workingLedger[symbol]) workingLedger[symbol] = { N: [], D1: [], D2: [], D3: [], D4: [] };
      const tiers = getTriggeredDipTiers(asset.discount, asset.rules || []);
      let available = num(h.totalCost, num(h.currentValue, 0)) - ledgerCost(workingLedger[symbol]);

      for (const item of tiers) {
        const tier = item.tier;
        if (workingLedger[symbol][tier]?.length) {
          skipped.push({ symbol, tier, reason: "exists" });
          continue;
        }
        const level = Number(tier.replace("D", ""));
        const amount = num(asset.amounts?.[level - 1], 0);
        if (amount <= 0 || available + 0.01 < amount) {
          skipped.push({ symbol, tier, reason: "insufficient_wallet_cost", available, amount });
          continue;
        }
        workingLedger[symbol][tier].push({
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

    const writeResult = added.length && !dryRun ? await writeLedger(workingLedger) : { store: dryRun ? "dry_run_no_write" : "unchanged" };
    return res.status(200).json({ ok: true, dryRun, addedCount: added.length, added, skipped, storage: writeResult.store, ledger: dryRun ? ledger : workingLedger });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "reconcile_tiers_failed", message: error.message });
  }
}
