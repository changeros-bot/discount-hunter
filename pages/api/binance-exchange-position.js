const {
  requiredEnv,
  getBinanceRestUrl,
  fetchBinanceExchangePositions
} = require("../../lib/v17/binance-exchange-provider");

function safeNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

async function fetchBtcMarketPrice() {
  try {
    const baseUrl = getBinanceRestUrl();
    const response = await fetch(`${baseUrl}/api/v3/ticker/price?symbol=BTCUSDT`, {
      cache: "no-store"
    });
    const json = await response.json();
    return safeNumber(json?.price);
  } catch {
    return 0;
  }
}

async function parseMarketPrices(req) {
  const manualPrice = safeNumber(req.query?.btcPrice || req.body?.btcPrice);
  const btcPrice = manualPrice > 0 ? manualPrice : await fetchBtcMarketPrice();
  return btcPrice > 0 ? { BTC: { price: btcPrice } } : {};
}

function sanitizeBinanceError(error) {
  const payload = error?.payload || null;
  return {
    message: error?.message || "Binance exchange position sync failed",
    httpStatus: error?.status || null,
    binanceCode: payload?.code ?? null,
    binanceMessage: payload?.msg || null,
    hint: payload?.code === -2015
      ? "API key permission, IP restriction, or invalid key problem. Confirm Enable Reading and IP restriction settings."
      : payload?.code === -1022
        ? "Signature verification failed. Check API secret and signing logic."
        : payload?.code === -1021
          ? "Timestamp outside recvWindow. Check server clock / recvWindow."
          : null
  };
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
      diagnostics: {
        envConfigured: false,
        apiKeyPresent: Boolean(env.apiKey),
        apiSecretPresent: Boolean(env.apiSecret)
      },
      message: "BINANCE_API_KEY / BINANCE_API_SECRET not configured. Using manual fallback."
    });
  }

  try {
    const marketPrices = await parseMarketPrices(req);
    const result = await fetchBinanceExchangePositions({ marketPrices });

    return res.status(200).json({
      ...result,
      diagnostics: {
        envConfigured: true,
        binanceSignedRequest: "success",
        btcMarketPrice: marketPrices?.BTC?.price || 0
      }
    });
  } catch (error) {
    const diagnostics = sanitizeBinanceError(error);
    return res.status(200).json({
      ok: false,
      configured: true,
      source: "binance_exchange_readonly",
      holdings: [],
      error: diagnostics.message,
      status: diagnostics.httpStatus,
      diagnostics,
      message: "Binance exchange sync failed. Using manual fallback."
    });
  }
}

module.exports = handler;
