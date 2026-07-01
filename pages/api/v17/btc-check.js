async function callJson(baseUrl, path) {
  const startedAt = Date.now();
  try {
    const response = await fetch(`${baseUrl}${path}`, { cache: "no-store" });
    const json = await response.json().catch(() => null);
    return {
      ok: response.ok && json?.ok !== false,
      status: response.status,
      latencyMs: Date.now() - startedAt,
      json
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      latencyMs: Date.now() - startedAt,
      error: error.message
    };
  }
}

function baseUrlFromReq(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;
  return `${proto}://${host}`;
}

function pickBtcPrice(pricesResult) {
  const rows = Array.isArray(pricesResult?.json?.data) ? pricesResult.json.data : [];
  const btc = rows.find((row) => String(row.symbol || "").toUpperCase() === "BTC") || null;
  return Number(btc?.price || 0);
}

function sanitizeBtcHolding(holding) {
  if (!holding) return null;
  return {
    symbol: holding.symbol,
    quantity: holding.quantity,
    totalCost: holding.totalCost,
    averageBuyPrice: holding.averageBuyPrice || holding.averageCost,
    currentValue: holding.currentValue,
    unrealizedPnL: holding.unrealizedPnL,
    returnPct: holding.returnPct,
    buyCount: holding.buyCount,
    sellCount: holding.sellCount,
    tradeCount: holding.tradeCount,
    quantitySource: holding.quantitySource,
    costBasisSource: holding.costBasisSource,
    averageBuyPriceSource: holding.averageBuyPriceSource,
    checkedAt: holding.checkedAt
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const baseUrl = baseUrlFromReq(req);
  const prices = await callJson(baseUrl, "/api/prices");
  const btcPrice = pickBtcPrice(prices);
  const exchange = await callJson(baseUrl, `/api/binance-exchange-position?btcPrice=${encodeURIComponent(btcPrice)}`);
  const holdings = Array.isArray(exchange?.json?.holdings) ? exchange.json.holdings : [];
  const btc = holdings.find((holding) => String(holding.symbol || "").toUpperCase() === "BTC") || null;

  const configured = exchange?.json?.configured ?? null;
  const pass = Boolean(exchange.ok && configured && btc && Number(btc.quantity) > 0);

  return res.status(pass ? 200 : 500).json({
    ok: pass,
    version: "V17-BTC-check-v1",
    checkedAt: new Date().toISOString(),
    market: {
      btcPrice,
      pricesOk: prices.ok,
      pricesStatus: prices.status,
      pricesLatencyMs: prices.latencyMs
    },
    exchange: {
      configured,
      ok: exchange.ok,
      status: exchange.status,
      latencyMs: exchange.latencyMs,
      source: exchange?.json?.source || "binance_exchange_readonly",
      message: exchange?.json?.message || exchange?.json?.error || null
    },
    btc: sanitizeBtcHolding(btc),
    next: pass
      ? "BTC provider is reading Binance Spot account data. Dashboard can use binance_exchange_readonly."
      : "Check Vercel BINANCE_API_KEY / BINANCE_API_SECRET, Binance API permissions, and whether BTC is in Spot."
  });
}
