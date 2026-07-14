const crypto = require("crypto");

const BINANCE_PROXY_REST_URL = "http://158.179.185.67:3001";
const DEFAULT_RECV_WINDOW = 5000;
const BTC_TRADE_SYMBOLS = ["BTCUSDT", "BTCUSDC", "BTCFDUSD", "BTCTUSD", "BTCBUSD"];
const QUANTITY_TOLERANCE = 0.00000001;

function safeNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function getBinanceRestUrl() {
  return BINANCE_PROXY_REST_URL;
}

function requiredEnv() {
  const apiKey = String(process.env.BINANCE_API_KEY || "").trim();
  const apiSecret = String(process.env.BINANCE_API_SECRET || "").trim();
  const restBaseUrl = getBinanceRestUrl();
  return { apiKey, apiSecret, restBaseUrl, configured: Boolean(apiKey && apiSecret) };
}

function sign(query, secret) {
  return crypto.createHmac("sha256", secret).update(query).digest("hex");
}

async function signedBinanceRequest(path, params = {}) {
  const { apiKey, apiSecret, configured, restBaseUrl } = requiredEnv();
  if (!configured) {
    const err = new Error("BINANCE_API_KEY / BINANCE_API_SECRET not configured");
    err.code = "BINANCE_NOT_CONFIGURED";
    throw err;
  }

  const search = new URLSearchParams({
    ...params,
    recvWindow: String(params.recvWindow || DEFAULT_RECV_WINDOW),
    timestamp: String(Date.now())
  });
  const signature = sign(search.toString(), apiSecret);
  search.set("signature", signature);

  const response = await fetch(`${restBaseUrl}${path}?${search.toString()}`, {
    method: "GET",
    headers: { "X-MBX-APIKEY": apiKey },
    cache: "no-store"
  });
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!response.ok) {
    const err = new Error(json?.msg || text || `Binance ${response.status}`);
    err.status = response.status;
    err.payload = json;
    err.restBaseUrl = restBaseUrl;
    err.path = path;
    err.params = params;
    throw err;
  }
  return json;
}

async function fetchSpotAccount() {
  return signedBinanceRequest("/api/v3/account");
}

async function fetchMyTrades(symbol = "BTCUSDT") {
  return signedBinanceRequest("/api/v3/myTrades", { symbol, limit: 1000 });
}

async function fetchBtcTradesAcrossSymbols(symbols = BTC_TRADE_SYMBOLS) {
  const errors = [];
  const allTrades = [];
  const successfulSymbols = [];

  for (const symbol of symbols) {
    try {
      const trades = await fetchMyTrades(symbol);
      if (Array.isArray(trades)) {
        allTrades.push(...trades.map((t) => ({ ...t, symbol })));
        successfulSymbols.push(symbol);
      }
    } catch (error) {
      errors.push({ symbol, message: error.message, status: error.status || null, code: error.payload?.code || null });
    }
  }

  return { trades: allTrades, successfulSymbols, errors };
}

function balanceFor(account, asset) {
  const row = (account?.balances || []).find((b) => String(b.asset || "").toUpperCase() === String(asset).toUpperCase());
  return {
    free: safeNumber(row?.free),
    locked: safeNumber(row?.locked),
    quantity: safeNumber(row?.free) + safeNumber(row?.locked)
  };
}

function quoteCommission(trade) {
  const asset = String(trade?.commissionAsset || "").toUpperCase();
  const quoteAsset = String(trade?.symbol || "").toUpperCase().replace(/^BTC/, "");
  return asset && asset === quoteAsset ? safeNumber(trade.commission) : 0;
}

function applyTradeToPosition(position, trade) {
  const qty = safeNumber(trade.qty);
  const quoteQty = safeNumber(trade.quoteQty);
  if (qty <= 0) return position;

  if (trade.isBuyer) {
    position.quantity += qty;
    position.totalCost += quoteQty + quoteCommission(trade);
    position.buyCount += 1;
    position.lastBuyTime = trade.time || position.lastBuyTime;
    if (!position.firstBuyTime) position.firstBuyTime = trade.time || null;
    return position;
  }

  const avg = position.quantity > 0 ? position.totalCost / position.quantity : 0;
  const closedCost = Math.min(position.totalCost, qty * avg);
  position.quantity = Math.max(0, position.quantity - qty);
  position.totalCost = Math.max(0, position.totalCost - closedCost);
  position.sellCount += 1;
  position.lastSellTime = trade.time || position.lastSellTime;
  return position;
}

function buildAverageCostFromTrades(trades = [], liveQuantity = 0) {
  const sorted = [...(trades || [])].sort((a, b) => safeNumber(a.time) - safeNumber(b.time));
  const position = sorted.reduce(applyTradeToPosition, {
    quantity: 0,
    totalCost: 0,
    buyCount: 0,
    sellCount: 0,
    firstBuyTime: null,
    lastBuyTime: null,
    lastSellTime: null
  });

  const quantity = safeNumber(liveQuantity) || position.quantity;
  const quantityDifference = quantity - position.quantity;
  const quantityReconciled = Math.abs(quantityDifference) <= QUANTITY_TOLERANCE;

  // 重要：總成本直接保留交易歷史回推值，不再把交易均價乘上即時餘額。
  // 舊算法在即時餘額與交易回推數量稍有差異時，會把總成本錯誤縮小。
  const totalCost = position.totalCost;
  const averageBuyPrice = quantity > 0 && totalCost > 0 ? totalCost / quantity : 0;

  return {
    quantity,
    reconstructedQuantity: position.quantity,
    quantityDifference,
    quantityReconciled,
    totalCost,
    averageBuyPrice,
    buyCount: position.buyCount,
    sellCount: position.sellCount,
    firstBuyTime: position.firstBuyTime,
    lastBuyTime: position.lastBuyTime,
    lastSellTime: position.lastSellTime,
    tradeCount: sorted.length
  };
}

function normalizeBtcPosition({ account, trades, marketPrice, tradeMeta = {} }) {
  const balance = balanceFor(account, "BTC");
  const hasTrades = Array.isArray(trades) && trades.length > 0;
  const cost = hasTrades
    ? buildAverageCostFromTrades(trades, balance.quantity)
    : { quantity: balance.quantity, reconstructedQuantity: 0, quantityDifference: balance.quantity, quantityReconciled: false, totalCost: 0, averageBuyPrice: 0, buyCount: 0, sellCount: 0, firstBuyTime: null, lastBuyTime: null, lastSellTime: null, tradeCount: 0 };
  const price = safeNumber(marketPrice);
  const currentValue = price > 0 ? cost.quantity * price : 0;
  const hasCostBasis = safeNumber(cost.totalCost) > 0;
  const unrealizedPnL = hasCostBasis ? currentValue - cost.totalCost : null;
  const pnlPct = hasCostBasis ? unrealizedPnL / cost.totalCost : null;

  return {
    symbol: "BTC",
    quantity: cost.quantity,
    valuationQuantity: cost.quantity,
    reconstructedTradeQuantity: cost.reconstructedQuantity,
    quantityDifference: cost.quantityDifference,
    quantityReconciled: cost.quantityReconciled,
    totalCost: hasCostBasis ? cost.totalCost : 0,
    rawTotalCost: hasCostBasis ? cost.totalCost : 0,
    averageCost: hasCostBasis ? cost.averageBuyPrice : 0,
    averageBuyPrice: hasCostBasis ? cost.averageBuyPrice : 0,
    tokenPrice: price,
    marketPrice: price,
    currentValue,
    rawCurrentValue: currentValue,
    marketValue: currentValue,
    positionValue: currentValue,
    unrealizedPnL,
    pnlPct,
    returnPct: pnlPct,
    buyCount: cost.buyCount,
    sellCount: cost.sellCount,
    firstBuyTimestamp: cost.firstBuyTime,
    lastBuyTimestamp: cost.lastBuyTime,
    lastSellTimestamp: cost.lastSellTime,
    tradeCount: cost.tradeCount,
    officialHolding: true,
    quantitySource: "binance_account_readonly",
    costBasisSource: hasCostBasis ? "binance_myTrades_remaining_cost" : "missing_binance_myTrades_cost_basis",
    costBasisMissing: !hasCostBasis,
    costBasisWarning: !hasCostBasis
      ? "BTC balance is real from Binance account, but myTrades cost basis is unavailable or empty."
      : cost.quantityReconciled
        ? null
        : "BTC live balance differs from reconstructed trade quantity; total cost is preserved from trade history and flagged for reconciliation.",
    averageBuyPriceSource: hasCostBasis ? "binance_myTrades_remaining_cost_divided_by_live_quantity" : "missing_binance_myTrades_cost_basis",
    tradeSymbolsUsed: tradeMeta.successfulSymbols || [],
    tradeFetchErrors: tradeMeta.errors || [],
    priceSource: "V17 market price",
    checkedAt: new Date().toISOString()
  };
}

async function fetchBinanceExchangePositions({ marketPrices = {} } = {}) {
  const account = await fetchSpotAccount();
  const tradeMeta = await fetchBtcTradesAcrossSymbols();
  const btcMarketPrice = safeNumber(marketPrices.BTC?.price || marketPrices.BTC || 0);
  const btc = normalizeBtcPosition({ account, trades: tradeMeta.trades, marketPrice: btcMarketPrice, tradeMeta });
  return {
    ok: true,
    configured: true,
    source: "binance_exchange_readonly",
    providerBaseUrl: getBinanceRestUrl(),
    holdings: btc.quantity > 0 ? [btc] : [],
    btcTradeFetch: {
      successfulSymbols: tradeMeta.successfulSymbols,
      errors: tradeMeta.errors,
      tradeCount: tradeMeta.trades.length
    },
    checkedAt: new Date().toISOString()
  };
}

module.exports = {
  requiredEnv,
  getBinanceRestUrl,
  fetchBinanceExchangePositions,
  fetchSpotAccount,
  fetchBtcTradesAcrossSymbols,
  buildAverageCostFromTrades
};
