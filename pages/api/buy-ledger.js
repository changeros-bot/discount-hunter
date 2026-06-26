import {
  appendBuy,
  readLedger,
  normalizeSymbol,
  normalizeTier,
  getCompletedDipLevel,
  getExecutableTiers
} from "../../lib/v16-ledger";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");

  try {
    if (req.method === "GET") {
      const ledger = await readLedger();
      const { symbol } = req.query || {};

      if (symbol) {
        const normalizedSymbol = normalizeSymbol(symbol);
        return res.status(200).json({
          ok: true,
          symbol: normalizedSymbol,
          completedDipLevel: getCompletedDipLevel(ledger, normalizedSymbol),
          ledger: ledger[normalizedSymbol]
        });
      }

      return res.status(200).json({ ok: true, ledger });
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
