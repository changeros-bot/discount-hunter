async function callJson(baseUrl, path, options = {}) {
  const startedAt = Date.now();
  try {
    const response = await fetch(`${baseUrl}${path}`, { cache: "no-store", ...options });
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

function summarizePrices(result) {
  const rows = Array.isArray(result?.json?.data) ? result.json.data : [];
  const btc = rows.find((row) => String(row.symbol || "").toUpperCase() === "BTC") || null;
  return {
    ok: result.ok && Boolean(btc),
    status: result.status,
    latencyMs: result.latencyMs,
    count: rows.length,
    btc: btc ? {
      price: btc.price,
      cycleHigh: btc.cycleHigh || btc.high,
      cycleHighDate: btc.cycleHighDate || null,
      discount: btc.discount,
      signalLevel: btc.signal?.level ?? null,
      pass: Boolean(btc.cycleHighDate)
    } : null
  };
}

function summarizeWallet(result) {
  const holdings = Array.isArray(result?.json?.holdings) ? result.json.holdings : [];
  return {
    ok: result.ok,
    status: result.status,
    latencyMs: result.latencyMs,
    holdingsCount: holdings.length,
    symbols: holdings.map((h) => h.symbol).filter(Boolean),
    source: result?.json?.walletSyncSource || result?.json?.source || null
  };
}

function summarizeExchange(result) {
  const holdings = Array.isArray(result?.json?.holdings) ? result.json.holdings : [];
  const btc = holdings.find((h) => String(h.symbol || "").toUpperCase() === "BTC") || null;
  return {
    ok: result.ok,
    configured: result?.json?.configured ?? null,
    status: result.status,
    latencyMs: result.latencyMs,
    source: result?.json?.source || "binance_exchange_readonly",
    btc: btc ? {
      quantity: btc.quantity,
      totalCost: btc.totalCost,
      averageBuyPrice: btc.averageBuyPrice || btc.averageCost,
      currentValue: btc.currentValue,
      returnPct: btc.returnPct,
      quantitySource: btc.quantitySource,
      costBasisSource: btc.costBasisSource
    } : null,
    message: result?.json?.message || result?.json?.error || null
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const baseUrl = baseUrlFromReq(req);
  const prices = await callJson(baseUrl, "/api/prices");
  const btcPrice = prices?.json?.data?.find((row) => String(row.symbol || "").toUpperCase() === "BTC")?.price || 0;
  const [wallet, exchange] = await Promise.all([
    callJson(baseUrl, "/api/sync-wallet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }),
    callJson(baseUrl, `/api/binance-exchange-position?btcPrice=${encodeURIComponent(btcPrice)}`)
  ]);

  const checks = {
    prices: summarizePrices(prices),
    wallet: summarizeWallet(wallet),
    exchange: summarizeExchange(exchange)
  };

  const ok = Boolean(
    checks.prices.ok &&
    checks.prices.btc?.pass &&
    checks.wallet.ok
  );

  return res.status(ok ? 200 : 500).json({
    ok,
    version: "V17-smoke-v1",
    checkedAt: new Date().toISOString(),
    checks,
    note: "Exchange may be unconfigured before BINANCE_API_KEY and BINANCE_API_SECRET are set in Vercel; that does not block xStocks wallet smoke test."
  });
}
