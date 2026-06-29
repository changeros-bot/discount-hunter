import {
  appendBuy,
  readLedger,
  normalizeSymbol,
  normalizeTier,
  getCompletedDipLevel,
  getExecutableTiers
} from "../../lib/v16-ledger";

function isExplicitManualRow(row) {
  const mode = String(row?.mode || "").toLowerCase();
  const note = String(row?.note || "").toLowerCase();
  return mode === "dip_manual" || mode === "dca_manual" || note.includes("manual");
}

function visibleLedgerOnly(ledger = {}) {
  const visible = {};
  for (const [symbol, tiers] of Object.entries(ledger || {})) {
    visible[symbol] = {};
    for (const [tier, rows] of Object.entries(tiers || {})) {
      visible[symbol][tier] = Array.isArray(rows) ? rows.filter(isExplicitManualRow) : [];
    }
  }
  return visible;
}

function completedLevelFromVisible(ledger, symbol) {
  const rows = ledger?.[symbol] || {};
  for (let level = 4; level >= 1; level -= 1) {
    if (Array.isArray(rows[`D${level}`]) && rows[`D${level}`].length) return level;
  }
  return 0;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");

  try {
    if (req.method === "GET") {
      const rawLedger = await readLedger();
      const ledger = visibleLedgerOnly(rawLedger);
      const { symbol, includeRaw } = req.query || {};

      if (symbol) {
        const normalizedSymbol = normalizeSymbol(symbol);
        return res.status(200).json({
          ok: true,
          symbol: normalizedSymbol,
          visibilityRule: "explicit_manual_only",
          completedDipLevel: completedLevelFromVisible(ledger, normalizedSymbol),
          ledger: ledger[normalizedSymbol],
          rawLedger: includeRaw === "true" ? rawLedger[normalizedSymbol] : undefined
        });
      }

      return res.status(200).json({ ok: true, visibilityRule: "explicit_manual_only", ledger, rawLedger: includeRaw === "true" ? rawLedger : undefined });
    }

    if (req.method === "POST") {
      const { symbol, tier, amount, price, note, time } = req.body || {};
      const result = await appendBuy({ symbol, tier, amount, price, note, time });

      return res.status(200).json({
        ok: true,
        message: result.duplicate ? "buy_record_duplicate_skipped" : "buy_recorded",
        symbol: result.symbol,
        tier: result.tier,
        row: result.row,
        ledger: result.ledger,
        duplicate: result.duplicate,
        duplicateReason: result.duplicateReason,
        storage: result.storage
      });
    }

    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  } catch (error) {
    return res.status(400).json({ ok: false, error: error.message });
  }
}

export { getExecutableTiers, normalizeTier };
