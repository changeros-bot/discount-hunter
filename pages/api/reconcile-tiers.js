import { readLedger, writeLedger, normalizeSymbol, getTriggeredDipTiers } from "../../lib/v16-ledger";
const { hasKvConfig, requiresDurableKv } = require("../../lib/state/kv");

const LIVE_BALANCE_SOURCE = "bsc_rpc_balanceOf_live";

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

function hasLiveUsableHolding(holding) {
  return Boolean(
    holding?.symbol &&
    holding.quantitySource === LIVE_BALANCE_SOURCE &&
    num(holding.quantity) > 0
  );
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
    const confirmReconcile = req.body?.confirmReconcile === true;
    const dryRun = req.body?.dryRun !== false || req.query?.dryRun === "true" || !confirmReconcile;

    if (!dryRun && requiresDurableKv() && !hasKvConfig()) {
      return res.status(409).json({
        ok: false,
        error: "missing_required_upstash_kv",
        message: "補登需要正式 durable Ledger 儲存；目前未設定 Upstash KV，因此沒有寫入。",
        releaseBlocked: true
      });
    }

    if (!dryRun && !confirmReconcile) {
      const ledger = await readLedger();
      return res.status(409).json({
        ok: false,
        dryRun: true,
        blocked: true,
        error: "explicit_reconcile_confirmation_required",
        message: "安全保護：Wallet 持有不等於本層已買入。未提供 confirmReconcile=true，不允許自動補登 Ledger。",
        addedCount: 0,
        added: [],
        skipped: [],
        storage: "blocked_no_write",
        ledger
      });
    }

    if (!assets.some(hasUsableAsset)) {
      return res.status(400).json({ ok: false, error: "missing_or_invalid_assets", message: "reconcile requires non-empty price assets" });
    }

    if (!holdings.some(hasLiveUsableHolding)) {
      return res.status(400).json({
        ok: false,
        error: "missing_live_wallet_holdings",
        message: "補登需要真實鏈上 live balance 持倉；目前沒有 quantitySource=bsc_rpc_balanceOf_live 且 quantity>0 的 holding。"
      });
    }

    const map = buildAssetMap(assets);
    const ledger = await readLedger();
    const workingLedger = JSON.parse(JSON.stringify(ledger));
    const added = [];
    const skipped = [];
    const now = new Date().toISOString();

    for (const h of holdings) {
      if (h?.quantitySource !== LIVE_BALANCE_SOURCE) {
        skipped.push({ symbol: h?.symbol || h?.tokenSymbol || null, reason: "not_live_wallet_balance", quantitySource: h?.quantitySource || null });
        continue;
      }
      if (num(h.quantity) <= 0) {
        skipped.push({ symbol: h.symbol || h.tokenSymbol || null, reason: "zero_quantity" });
        continue;
      }
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
          quantitySource: h.quantitySource,
          sourceVerified: true,
          mode: "wallet_reconcile_confirmed",
          note: "explicit_confirm_reconcile_" + tier,
          leftBuyZone: false,
          leftBuyZoneAt: null
        });
        available -= amount;
        added.push({ symbol, tier, amount, quantitySource: h.quantitySource });
      }
    }

    const writeResult = added.length && !dryRun ? await writeLedger(workingLedger) : { store: dryRun ? "dry_run_no_write" : "unchanged" };
    return res.status(200).json({ ok: true, dryRun, requiresExplicitConfirm: true, addedCount: dryRun ? 0 : added.length, candidateCount: added.length, candidates: added, added: dryRun ? [] : added, skipped, storage: writeResult.store, ledger: dryRun ? ledger : workingLedger });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "reconcile_tiers_failed", message: error.message });
  }
}
