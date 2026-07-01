const { requiredEnv, fetchBinanceExchangePositions } = require("../../lib/v17/binance-exchange-provider");

function safeNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function parseMarketPrices(req) {
  const btcPrice = safeNumber(req.query?.btcPrice || req.body?.btcPrice);
  return btcPrice > 0 ? { BTC: { price: btcPrice } } : {};
}

async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");

  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const env = requiredEnv();
  if (!env.configured) {
    return res.status(200).json({
      ok: false,
      configured: false,
      source: "binance_exchange_readonly",
      holdings: [],
      message: "BINANCE_API_KEY / BINANCE_API_SECRET not configured. Using manual fallback."
    });
  }

  try {
    const result = await fetchBinanceExchangePositions({ marketPrices: parseMarketPrices(req) });
    return res.status(200).json(result);
  } catch (error) {
    return res.status(200).json({
      ok: false,
      configured: true,
      source: "binance_exchange_readonly",
      holdings: [],
      error: error.message || "Binance exchange position sync failed",
      status: error.status || null,
      message: "Binance exchange sync failed. Using manual fallback."
    });
  }
}

module.exports = handler;
