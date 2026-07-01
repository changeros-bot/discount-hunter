import { fetchBinanceExchangePositions, requiredEnv } from "../../../lib/v17/binance-exchange-provider";

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

function sanitizeBinanceError(error) {
  const payload = error?.payload || null;
  return {
    message: error?.message || "Binance exchange position sync failed",
    httpStatus: error?.status || null,
    restBaseUrl: error?.restBaseUrl || null,
    binanceCode: payload?.code ?? null,
    binanceMessage: payload?.msg || payload?.raw || null,
    hint: payload?.code === -2015
      ? "API key permission, IP restriction, or invalid key problem. Confirm Enable Reading and IP restriction settings."
      : payload?.code === -1022
        ? "Signature verification failed. Check API secret and signing logic."
        : payload?.code === -1021
          ? "Timestamp outside recvWindow. Check server clock / recvWindow."
          : error?.status === 451
            ? "Route is still blocked by Binance location policy. Check restBaseUrl; if it is the Worker URL, Cloudflare is also blocked and needs another proxy region."
            : null
  };
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
  const env = requiredEnv();

  let exchange = null;
  let diagnostics = {
    envConfigured: env.configured,
    apiKeyPresent: Boolean(env.apiKey),
    apiSecretPresent: Boolean(env.apiSecret),
    restBaseUrl: env.restBaseUrl,
    directProviderCall: true
  };

  if (env.configured) {
    try {
      exchange = await fetchBinanceExchangePositions({ marketPrices: { BTC: { price: btcPrice } } });
      diagnostics = { ...diagnostics, providerBaseUrl: exchange.providerBaseUrl, binanceSignedRequest: "success" };
    } catch (error) {
      diagnostics = { ...diagnostics, ...sanitizeBinanceError(error), binanceSignedRequest: "failed" };
      exchange = { ok: false, configured: true, source: "binance_exchange_readonly", providerBaseUrl: diagnostics.restBaseUrl, holdings: [] };
    }
  } else {
    exchange = { ok: false, configured: false, source: "binance_exchange_readonly", providerBaseUrl: diagnostics.restBaseUrl, holdings: [] };
  }

  const holdings = Array.isArray(exchange?.holdings) ? exchange.holdings : [];
  const btc = holdings.find((holding) => String(holding.symbol || "").toUpperCase() === "BTC") || null;
  const pass = Boolean(exchange.ok && env.configured && btc && Number(btc.quantity) > 0);

  return res.status(pass ? 200 : 500).json({
    ok: pass,
    version: "V17-BTC-check-v3-route-visible",
    checkedAt: new Date().toISOString(),
    market: {
      btcPrice,
      pricesOk: prices.ok,
      pricesStatus: prices.status,
      pricesLatencyMs: prices.latencyMs
    },
    exchange: {
      configured: env.configured,
      ok: Boolean(exchange.ok),
      source: exchange?.source || "binance_exchange_readonly",
      providerBaseUrl: exchange?.providerBaseUrl || diagnostics.restBaseUrl,
      message: diagnostics.message || null
    },
    diagnostics,
    btc: sanitizeBtcHolding(btc),
    next: pass
      ? "BTC provider is reading Binance Spot account data. Dashboard can use binance_exchange_readonly."
      : "Check diagnostics.restBaseUrl first. If it is Worker URL but still 451, Cloudflare Worker egress is also restricted and we need another proxy region."
  });
}
