import { readLedger, writeLedger, normalizeSymbol, getTriggeredDipTiers } from "../../lib/v16-ledger";

function upper(value) {
  return String(value || "").trim().toUpperCase();
}

function positiveNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function symbolKey(value) {
  return upper(value).replace(/[^A-Z0-9]/g, "");
}

function buildAssetMap(assets = []) {
  const map = new Map();
  for (const asset of assets || []) {
    const key = symbolKey(asset.symbol);
    if (key) map.set(key, asset);
  }
  return map;
}

function buildHoldingRows(holdings = []) {
  return (holdings || [])
    .filter((h) => positiveNumber(h.quantity) > 0)
    .map((h) => ({
      ...h,
      symbolKey: symbolKey(h.symbol),
      amount: positiveNumber(h.totalCost) || positiveNumber(h.currentValue) || 5,
      price: positiveNumber(h.tokenPrice) || positiveNumber(h.marketPrice) || null,
      quantity: positiveNumber(h.quantity)
    }));
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  try {
    const assets = Array.isArray(req.body?.assets) ? req.body.assets : [];
    const holdings = Array.isArray(req.body?.holdings) ? req.body.holdings : [];
    const now = new Date().toISOString();
    const assetMap = buildAssetMap(assets);
    const holdingRows = buildHoldingRows(holdings);
    const ledger = await readLedger();
    const added = [];
    const skipped = [];

    for (const holding of holdingRows) {
      const asset = assetMap.get(holding.symbolKey);
      if (!asset) {
        skipped.push({ symbol: holding.symbol, reason: "asset_not_in_watchlist" });
        continue;
      }

      let symbol;
      try {
        symbol = normalizeSymbol(asset.symbol || holding.symbol);
      } catch {
        skipped.push({ symbol: holding.symbol, reason: "invalid_symbol" });
        continue;
      }

      const triggered = getTriggeredDipTiers(asset.discount, asset.rules || []);
      const d1Triggered = triggered.some((t) => t.tier === "D1");
      if (!d1Triggered) {
        skipped.push({ symbol, reason: "d1_not_triggered" });
        continue;
      }

      if (Array.isArray(ledger?.[symbol]?.D1) && ledger[symbol].D1.length > 0) {
        skipped.push({ symbol, reason: "d1_already_in_ledger" });
        continue;
      }

      ledger[symbol].D1.push({
        time: now,
        amount: holding.amount,
        price: holding.price,
        quantity: holding.quantity,
        mode: "wallet_reconcile",
        note: "wallet_live_holding_backfill_d1",
        leftBuyZone: false,
        leftBuyZoneAt: null
      });
      added.push({ symbol, tier: "D1", amount: holding.amount, quantity: holding.quantity });
    }

    const writeResult = added.length ? await writeLedger(ledger) : { store: "unchanged" };

    return res.status(200).json({
      ok: true,
      addedCount: added.length,
      added,
      skipped,
      storage: writeResult.store,
      ledger
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "reconcile_failed", message: error.message });
  }
}
