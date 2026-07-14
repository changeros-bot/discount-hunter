const crypto = require("crypto");

const BINANCE_PROXY_REST_URL = "http://158.179.185.67:3001";
const DEFAULT_RECV_WINDOW = 5000;
const BTC_TRADE_SYMBOLS = ["BTCUSDT", "BTCUSDC", "BTCFDUSD", "BTCTUSD", "BTCBUSD"];
const QUANTITY_TOLERANCE = 0.00000001;

// Josh 已確認的 BTC 成本基準：2026-07-14 15:58:42（台北時間）以前。
// 後續只累加此時間點之後的 Binance 成交，避免把多年歷史交易、轉入轉出
// 與目前極小餘額混算成數百 USDT 的假成本。
const BTC_COST_BASELINE = Object.freeze({
  quantity: 0.0002699,
  totalCost: 9.76,
  cutoffTime: Date.parse("2026-07-14T07:58:42Z"),
  source: "josh_verified_baseline_2026_07_14"
});

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
  return { apiKey, apiSecret, restBaseUrl: getBinanceRestUrl(), configured: Boolean(apiKey && apiSecret) };
}

function sign(query, secret) {
  return crypto.createHmac("sha256", secret).update(query).digest("hex");
}

async function signedBinanceRequest(path, params = {}) {
  const { apiKey, apiSecret, configured, restBaseUrl } = requiredEnv();
  if (!configured) throw new Error("BINANCE_API_KEY / BINANCE_API_SECRET not configured");
  const search = new URLSearchParams({ ...params, recvWindow: String(params.recvWindow || DEFAULT_RECV_WINDOW), timestamp: String(Date.now()) });
  search.set("signature", sign(search.toString(), apiSecret));
  const response = await fetch(`${restBaseUrl}${path}?${search.toString()}`, {
    method: "GET",
    headers: { "X-MBX-APIKEY": apiKey },
    cache: "no-store"
  });
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!response.ok) {
    const error = new Error(json?.msg || text || `Binance ${response.status}`);
    error.status = response.status;
    error.payload = json;
    throw error;
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
  const trades = [];
  const successfulSymbols = [];
  const errors = [];
  for (const symbol of symbols) {
    try {
      const rows = await fetchMyTrades(symbol);
      if (Array.isArray(rows)) {
        trades.push(...rows.map((row) => ({ ...row, symbol })));
        successfulSymbols.push(symbol);
      }
    } catch (error) {
      errors.push({ symbol, message: error.message, status: error.status || null, code: error.payload?.code || null });
    }
  }
  return { trades, successfulSymbols, errors };
}

function balanceFor(account, asset) {
  const row = (account?.balances || []).find((item) => String(item.asset || "").toUpperCase() === String(asset).toUpperCase());
  return { free: safeNumber(row?.free), locked: safeNumber(row?.locked), quantity: safeNumber(row?.free) + safeNumber(row?.locked) };
}

function quoteCommission(trade) {
  const symbol = String(trade?.symbol || "").toUpperCase();
  const quoteAsset = symbol.replace(/^BTC/, "");
  return String(trade?.commissionAsset || "").toUpperCase() === quoteAsset ? safeNumber(trade.commission) : 0;
}

function applyTrade(position, trade) {
  const quantity = safeNumber(trade.qty);
  const quoteAmount = safeNumber(trade.quoteQty) + quoteCommission(trade);
  if (quantity <= 0) return position;
  if (trade.isBuyer) {
    position.quantity += quantity;
    position.totalCost += quoteAmount;
    position.buyCount += 1;
    position.lastBuyTime = trade.time || position.lastBuyTime;
  } else {
    const averageCost = position.quantity > 0 ? position.totalCost / position.quantity : 0;
    position.totalCost = Math.max(0, position.totalCost - Math.min(position.totalCost, quantity * averageCost));
    position.quantity = Math.max(0, position.quantity - quantity);
    position.sellCount += 1;
    position.lastSellTime = trade.time || position.lastSellTime;
  }
  return position;
}

function buildAverageCostFromTrades(trades = [], liveQuantity = 0) {
  const laterTrades = [...trades]
    .filter((trade) => safeNumber(trade.time) > BTC_COST_BASELINE.cutoffTime)
    .sort((a, b) => safeNumber(a.time) - safeNumber(b.time));

  const position = laterTrades.reduce(applyTrade, {
    quantity: BTC_COST_BASELINE.quantity,
    totalCost: BTC_COST_BASELINE.totalCost,
    buyCount: 0,
    sellCount: 0,
    lastBuyTime: null,
    lastSellTime: null
  });

  const quantity = safeNumber(liveQuantity) || position.quantity;
  const quantityDifference = quantity - position.quantity;
  const quantityReconciled = Math.abs(quantityDifference) <= QUANTITY_TOLERANCE;
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
    firstBuyTime: BTC_COST_BASELINE.cutoffTime,
    lastBuyTime: position.lastBuyTime,
    lastSellTime: position.lastSellTime,
    tradeCount: laterTrades.length,
    baseline: BTC_COST_BASELINE
  };
}

function normalizeBtcPosition({ account, trades, marketPrice, tradeMeta = {} }) {
  const balance = balanceFor(account, "BTC");
  const cost = buildAverageCostFromTrades(Array.isArray(trades) ? trades : [], balance.quantity);
  const price = safeNumber(marketPrice);
  const currentValue = price > 0 ? cost.quantity * price : 0;
  const hasCostBasis = cost.totalCost > 0;
  const unrealizedPnL = hasCostBasis ? currentValue - cost.totalCost : null;
  const pnlPct = hasCostBasis ? unrealizedPnL / cost.totalCost : null;

  return {
    symbol: "BTC",
    quantity: cost.quantity,
    valuationQuantity: cost.quantity,
    reconstructedTradeQuantity: cost.reconstructedQuantity,
    quantityDifference: cost.quantityDifference,
    quantityReconciled: cost.quantityReconciled,
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
    costBasisSource: "josh_verified_baseline_plus_binance_trades",
    costBasisMissing: false,
    costBasisWarning: cost.quantityReconciled ? null : "即時餘額與基準加後續成交的數量不一致，需檢查轉入、轉出或贈送。",
    averageBuyPriceSource: "verified_baseline_plus_later_trades_divided_by_live_quantity",
    strategyAccounting: "DCA 與逢低買進分開；本成本只代表總持倉成本，不代表 D 層完成度。",
    baseline: cost.baseline,
    tradeSymbolsUsed: tradeMeta.successfulSymbols || [],
    tradeFetchErrors: tradeMeta.errors || [],
    priceSource: "V17 market price",
    checkedAt: new Date().toISOString()
  };
}

async function fetchBinanceExchangePositions({ marketPrices = {} } = {}) {
  const account = await fetchSpotAccount();
  const tradeMeta = await fetchBtcTradesAcrossSymbols();
  const btc = normalizeBtcPosition({ account, trades: tradeMeta.trades, marketPrice: safeNumber(marketPrices.BTC?.price || marketPrices.BTC), tradeMeta });
  return {
    ok: true,
    configured: true,
    source: "binance_exchange_readonly",
    providerBaseUrl: getBinanceRestUrl(),
    holdings: btc.quantity > 0 ? [btc] : [],
    btcTradeFetch: { successfulSymbols: tradeMeta.successfulSymbols, errors: tradeMeta.errors, tradeCount: tradeMeta.trades.length },
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
