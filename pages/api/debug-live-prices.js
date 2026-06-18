const { fetchTokenPrices, fetchReferenceStockPrices } = require("../../lib/xstocks/prices");

const DEFAULT_SYMBOLS = [
  "GOOGLON",
  "NVDAON",
  "QQQON",
  "TSMON",
  "SPCXON",
  "AMDON",
  "MRVLON",
  "RKLBON",
  "AVGOON",
];

function normalizeSymbols(value) {
  if (!value) return DEFAULT_SYMBOLS;
  return String(value)
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const symbols = normalizeSymbols(req.query.symbols);
    const startedAt = Date.now();

    const [tokenPrices, referencePrices] = await Promise.all([
      fetchTokenPrices(symbols),
      fetchReferenceStockPrices(symbols),
    ]);

    const rows = symbols.map((symbol) => {
      const token = tokenPrices[symbol];
      const ref = referencePrices[symbol];
      const tokenPrice = Number(token?.price || 0);
      const referencePrice = Number(ref?.price || 0);
      const premiumDiscountPct =
        tokenPrice > 0 && referencePrice > 0
          ? ((tokenPrice - referencePrice) / referencePrice) * 100
          : null;

      return {
        symbol,
        tokenPrice,
        tokenSource: token?.source || null,
        referencePrice,
        referenceSource: ref?.source || null,
        premiumDiscountPct,
        rawTokenPrice: token?.rawTokenPrice || null,
        sharesMultiplier: token?.sharesMultiplier || null,
      };
    });

    return res.status(200).json({
      ok: true,
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      requestedCount: symbols.length,
      tokenPriceCount: Object.keys(tokenPrices || {}).length,
      referencePriceCount: Object.keys(referencePrices || {}).length,
      rows,
    });
  } catch (error) {
    console.error("debug-live-prices error:", error);
    return res.status(500).json({ error: error.message || "Unknown error" });
  }
};
