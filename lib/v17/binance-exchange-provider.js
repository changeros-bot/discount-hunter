const crypto = require("crypto");

const DEFAULT_BINANCE_REST_URL = "https://discount-hunter-binance.chang-eros.workers.dev";
const DEFAULT_RECV_WINDOW = 5000;

function safeNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function getBinanceRestUrl() {
  return String(process.env.BINANCE_REST_BASE_URL || DEFAULT_BINANCE_REST_URL).trim().replace(/\/$/, "");
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
    throw err;
  }
  return json;
}

async function fetchSpotAccount() {
  return signedBinanceRequest("/api/v3/account");
}

async function fetchMyTrades(symbol = "BTCUSDT") {
  return signedBinanceRequest("/api/v3/myTrades", { symbol, limit: 1000 });
}\n
function balanceFor(account, asset) {
  const row = (account?.balances || []).find((b) => String(b.asset || "").toUpperCase() === String(asset).toUpperCase());
  return {
    free: safeNumber(row?.free),
    locked: safeNumber(row?.locked),
    quantity: safeNumber(row?.free) + safeNumber(row?.locked)
  };
}

function applyTradeToPosition(position, trade) {
  const qty = safeNumber(trade.qty);
  const quoteQty = safeNumber(trade.quoteQty);
  if (qty <= 0) return position;

  if (trade.isBuyer) {
    position.quantity += qty;
    position.totalCost += quoteQty;
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

  const tradeAverageBuyPrice = position.quantity > 0 ? position.totalCost / position.quantity : 0;
  const quantity = safeNumber(liveQuantity) || position.quantity;
  const totalCost = tradeAverageBuyPrice > 0 && quantity > 0 ? tradeAverageBuyPrice * quantity : position.totalCost;
  return {
    quantity,
    totalCost,
    averageBuyPrice: tradeAverageBuyPrice,
    buyCount: position.buyCount,
    sellCount: position.sellCount,
    firstBuyTime: position.firstBuyTime,
    lastBuyTime: position.lastBuyTime,
    lastSellTime: position.lastSellTime,
    tradeCount: sorted.length
  };
}

function normalizeBtcPosition({ account, trades, marketPrice }) {
  const balance = balanceFor(account, "BTC");
  const cost = buildAverageCostFromTrades(trades, balance.quantity);
  const price = safeNumber(marketPrice);
  const currentValue = price > 0 ? cost.quantity * price : 0;
  const unrealizedPnL = currentValue - cost.totalCost;
  const pnlPct = cost.totalCost > 0 ? unrealizedPnL / cost.totalCost : 0;

  return {
    symbol: "BTC",
    quantity: cost.quantity,
    valuationQuantity: cost.quantity,
    totalCost: cost.totalCost,
    rawTotalCost: cost.totalCost,
    averageCost: cost.averageBuyPrice,
    averageBuyPrice: cost.averageBuyPrice,
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
    costBasisSource: "binance_myTrades_weighted_average",
    averageBuyPriceSource: "binance_myTrades_weighted_average",
    priceSource: "V17 market price",
    checkedAt: new Date().toISOString()
  };
}

async function fetchBinanceExchangePositions({ marketPrices = {} } = {}) {
  const account = await fetchSpotAccount();
  const btcTrades = await fetchMyTrades("BTCUSDT");
  const btcMarketPrice = safeNumber(marketPrices.BTC?.price || marketPrices.BTC || 0);
  const btc = normalizeBtcPosition({ account, trades: btcTrades, marketPrice: btcMarketPrice });
  return {
    ok: true,
    configured: true,
    source: "binance_exchange_readonly",
    providerBaseUrl: getBinanceRestUrl(),
    holdings: btc.quantity > 0 ? [btc] : [],
    checkedAt: new Date().toISOString()
  };
}

module.exports = {
  requiredEnv,
  getBinanceRestUrl,
  fetchBinanceExchangePositions,
  buildAverageCostFromTrades
};
