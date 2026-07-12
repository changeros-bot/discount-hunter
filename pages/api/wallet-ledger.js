// DCA Discount Hunter V15.8 - Wallet Ledger / V17 Real Holdings Mirror
// Source of truth: /api/sync-wallet for xStocks + Binance exchange read-only for BTC.
// This endpoint is consumed by /financial-os and must mirror the V17 real holdings card totalValue.

const syncWalletHandler = require("./sync-wallet");
const { hasMoralisKey, hasMegaNodeKey } = require("../../lib/xstocks/transfer-source");
const { WATCHLIST, STABLECOINS } = require("../../lib/xstocks/constants");
const { getBinanceRestUrl, fetchBinanceExchangePositions, requiredEnv } = require("../../lib/v17/binance-exchange-provider");

function safeNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function upper(value) {
  return String(value || "").trim().toUpperCase();
}

function holdingValue(holding) {
  return safeNumber(holding?.currentValue || holding?.marketValue || holding?.positionValue || holding?.rawCurrentValue || 0);
}

function hasVerifiableCost(holding) {
  const cost = safeNumber(holding?.totalCost);
  if (!(cost > 0)) return false;
  if (holding?.costBasisMissing) return false;
  return true;
}

function mergeHoldingsBySymbol(...groups) {
  const map = new Map();
  for (const group of groups || []) {
    for (const holding of group || []) {
      const symbol = upper(holding?.symbol);
      if (!symbol || safeNumber(holding?.quantity) <= 0) continue;
      map.set(symbol, { ...holding, symbol });
    }
  }
  return [...map.values()];
}

function summarizeHoldings(holdings = []) {
  const live = (holdings || []).filter((h) => safeNumber(h.quantity) > 0);
  const known = live.filter(hasVerifiableCost);
  const missing = live.filter((h) => !hasVerifiableCost(h));
  const totalCostReady = live.length > 0 && missing.length === 0;
  const totalCost = known.reduce((sum, h) => sum + safeNumber(h.totalCost), 0);
  const marketValue = live.reduce((sum, h) => sum + holdingValue(h), 0);
  const unrealizedPnL = totalCostReady ? marketValue - totalCost : null;
  const returnPct = totalCostReady && totalCost > 0 ? unrealizedPnL / totalCost : null;
  return {
    holdingCount: live.length,
    knownCostCount: known.length,
    costBasisMissingCount: missing.length,
    costBasisMissingSymbols: missing.map((h) => upper(h.symbol)),
    totalCostReady,
    totalCost: totalCostReady ? totalCost : null,
    marketValue,
    currentValue: marketValue,
    unrealizedPnL,
    returnPct,
    returnPctDisplay: returnPct === null ? null : returnPct * 100,
    actualTotalInvested: totalCostReady ? totalCost : null,
    portfolioTotalCost: totalCostReady ? totalCost : null,
    portfolioMarketValue: marketValue,
    portfolioUnrealizedPnL: unrealizedPnL,
    portfolioPnLPct: returnPct,
  };
}

async function captureApiJson(handler, reqPatch = {}) {
  return await new Promise((resolve) => {
    const req = {
      method: reqPatch.method || "GET",
      query: reqPatch.query || {},
      body: reqPatch.body || {},
      headers: {},
    };
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(key, value) { this.headers[key] = value; },
      status(code) { this.statusCode = code; return this; },
      json(payload) { resolve({ statusCode: this.statusCode, payload }); },
      send(payload) { resolve({ statusCode: this.statusCode, payload }); },
    };
    Promise.resolve(handler(req, res)).catch((error) => resolve({ statusCode: 500, payload: { ok: false, error: error.message } }));
  });
}

async function fetchBtcMarketPrice() {
  try {
    const baseUrl = getBinanceRestUrl();
    const response = await fetch(`${baseUrl}/api/v3/ticker/price?symbol=BTCUSDT`, { cache: "no-store" });
    const json = await response.json();
    return safeNumber(json?.price);
  } catch {
    return 0;
  }
}

async function fetchExchangeHoldings() {
  const env = requiredEnv();
  if (!env.configured) {
    return { ok: false, configured: false, holdings: [], diagnostics: { envConfigured: false } };
  }
  try {
    const btcPrice = await fetchBtcMarketPrice();
    const marketPrices = btcPrice > 0 ? { BTC: { price: btcPrice } } : {};
    const result = await fetchBinanceExchangePositions({ marketPrices });
    return { ...result, diagnostics: { envConfigured: true, btcMarketPrice: btcPrice } };
  } catch (error) {
    return { ok: false, configured: true, holdings: [], error: error.message || "binance_exchange_sync_failed" };
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  try {
    const [syncResult, exchangeData] = await Promise.all([
      captureApiJson(syncWalletHandler, { method: "GET", query: req.query || {} }),
      fetchExchangeHoldings(),
    ]);

    const walletData = syncResult.payload || {};
    if (syncResult.statusCode >= 400 || walletData.ok === false) {
      return res.status(syncResult.statusCode || 500).json({
        ok: false,
        error: "wallet_ledger_sync_wallet_failed",
        message: walletData.message || walletData.error || "sync-wallet failed",
        syncWalletStatusCode: syncResult.statusCode,
        syncWallet: walletData,
      });
    }

    const walletHoldings = Array.isArray(walletData.holdings) ? walletData.holdings : [];
    const exchangeHoldings = Array.isArray(exchangeData?.holdings) ? exchangeData.holdings : [];
    const holdings = mergeHoldingsBySymbol(walletHoldings, exchangeHoldings);
    const summary = summarizeHoldings(holdings);
    const now = new Date().toISOString();
    const priceSources = Array.from(new Set([...walletHoldings, ...exchangeHoldings].map((h) => h.priceSource || h.source).filter(Boolean))).sort();

    return res.status(200).json({
      ok: true,
      version: "15.8-wallet-ledger-sync-wallet-source-of-truth",
      updatedAt: now,
      checkedAt: now,
      lastSyncTime: now,
      source: "V17 real holdings mirror: sync-wallet holdings + binance exchange read-only",
      walletAddress: walletData.fullWalletAddress || walletData.walletAddress || null,
      watchlist: WATCHLIST,
      stablecoins: STABLECOINS,
      ...summary,
      totalCost: summary.totalCost,
      marketValue: summary.marketValue,
      currentValue: summary.currentValue,
      actualTotalInvested: summary.actualTotalInvested,
      portfolioTotalCost: summary.portfolioTotalCost,
      portfolioMarketValue: summary.portfolioMarketValue,
      portfolioUnrealizedPnL: summary.portfolioUnrealizedPnL,
      portfolioPnLPct: summary.portfolioPnLPct,
      priceSource: priceSources.join("、") || "sync_wallet_and_exchange_live",
      referencePriceSource: "v17_real_holdings_mirror",
      mirrorOf: "pages/v17.js PortfolioSummaryCard walletSummary(totalValue)",
      configured: {
        moralis: hasMoralisKey(),
        megaNode: hasMegaNodeKey(),
        legacyBscScan: Boolean(process.env.BSCSCAN_API_KEY),
        syncWallet: Boolean(walletData.ok),
        binanceExchange: Boolean(exchangeData?.configured || exchangeData?.ok),
      },
      walletSync: {
        version: walletData.version,
        source: walletData.source,
        lastSyncTime: walletData.lastSyncTime,
        portfolioMarketValue: walletData.portfolioMarketValue,
        portfolioTotalCost: walletData.portfolioTotalCost,
        holdingCount: walletData.holdingCount || walletData.holdings?.length || 0,
      },
      binanceExchange: exchangeData,
      debugCounts: {
        walletHoldingCount: walletHoldings.length,
        exchangeHoldingCount: exchangeHoldings.length,
        mergedHoldingCount: holdings.length,
        walletHoldingSymbols: walletHoldings.map((h) => upper(h.symbol)),
        exchangeHoldingSymbols: exchangeHoldings.map((h) => upper(h.symbol)),
        mergedHoldingSymbols: holdings.map((h) => upper(h.symbol)),
        costBasisMissingSymbols: summary.costBasisMissingSymbols,
      },
      holdings,
      walletHoldings,
      exchangeHoldings,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "wallet_ledger_failed",
      message: error.message,
      configured: {
        moralis: hasMoralisKey(),
        megaNode: hasMegaNodeKey(),
        legacyBscScan: Boolean(process.env.BSCSCAN_API_KEY),
      },
    });
  }
}
