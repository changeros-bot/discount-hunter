const { fetchWalletTokenTransfers, hasMoralisKey, hasMegaNodeKey } = require("../../../lib/xstocks/transfer-source");
const { buildBuyRecordsFromTransfers, calculateHoldings } = require("../../../lib/xstocks/costBasis");
const { fetchTokenPrices, fetchReferenceStockPrices } = require("../../../lib/xstocks/prices");
const { fetchWalletBalancesViaRpc } = require("../../../lib/xstocks/rpcBalances");
const { WATCHLIST } = require("../../../lib/xstocks/constants");
const { requiredEnv, getBinanceRestUrl, fetchBinanceExchangePositions } = require("../../../lib/v17/binance-exchange-provider");

function safeNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function cleanAddress(value) {
  return String(value || "").trim();
}

function isEvmAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(cleanAddress(value));
}

function maskAddress(address) {
  const a = cleanAddress(address);
  return a ? `${a.slice(0, 6)}...${a.slice(-4)}` : "";
}

function upper(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeSymbol(symbol) {
  const s = upper(symbol);
  return s.endsWith("ON") ? s : `${s}ON`;
}

function normalizeSymbolMap(items) {
  const map = new Map();
  for (const item of items || []) {
    const s = normalizeSymbol(item.symbol);
    if (!s) continue;
    map.set(s, item);
  }
  return map;
}

async function fetchBtcMarketPrice() {
  try {
    const response = await fetch(`${getBinanceRestUrl()}/api/v3/ticker/price?symbol=BTCUSDT`, { cache: "no-store" });
    const json = await response.json();
    return safeNumber(json?.price);
  } catch {
    return 0;
  }
}

async function auditBinanceBtc() {
  const env = requiredEnv();
  const base = {
    source: "binance_exchange_readonly",
    configured: env.configured,
    apiKeyPresent: Boolean(env.apiKey),
    apiSecretPresent: Boolean(env.apiSecret),
    restBaseUrl: env.restBaseUrl,
    status: env.configured ? "CHECKING" : "NOT_CONFIGURED",
    quantity: 0,
    totalCost: 0,
    averageBuyPrice: 0,
    marketValue: 0,
    pnl: null,
    pnlPct: null,
    message: env.configured ? "Binance read-only credentials are configured." : "BINANCE_API_KEY / BINANCE_API_SECRET are not configured."
  };

  if (!env.configured) return base;

  try {
    const btcPrice = await fetchBtcMarketPrice();
    const result = await fetchBinanceExchangePositions({ marketPrices: { BTC: { price: btcPrice } } });
    const btc = (result.holdings || []).find((h) => upper(h.symbol) === "BTC") || null;
    if (!btc || safeNumber(btc.quantity) <= 0) {
      return { ...base, status: "NO_BTC_BALANCE", marketPrice: btcPrice, message: "Binance read-only works, but BTC balance is zero or unavailable." };
    }
    return {
      ...base,
      status: "PASS",
      marketPrice: btcPrice,
      quantity: safeNumber(btc.quantity),
      totalCost: safeNumber(btc.totalCost),
      averageBuyPrice: safeNumber(btc.averageBuyPrice || btc.averageCost),
      marketValue: safeNumber(btc.currentValue || btc.marketValue),
      pnl: btc.unrealizedPnL ?? null,
      pnlPct: btc.pnlPct ?? btc.returnPct ?? null,
      tradeCount: btc.tradeCount || 0,
      quantitySource: btc.quantitySource,
      costBasisSource: btc.costBasisSource,
      message: "BTC is sourced from Binance spot read-only account and myTrades cost basis."
    };
  } catch (error) {
    return { ...base, status: "FAIL", error: error.message, message: "Binance read-only sync failed." };
  }
}

async function auditXStocks() {
  const walletAddress = cleanAddress(process.env.WALLET_ADDRESS);
  const base = {
    source: "bsc_rpc_balanceOf_live",
    walletConfigured: isEvmAddress(walletAddress),
    walletAddress: maskAddress(walletAddress),
    moralisConfigured: hasMoralisKey(),
    megaNodeConfigured: hasMegaNodeKey(),
    watchlist: WATCHLIST,
    status: isEvmAddress(walletAddress) ? "CHECKING" : "NO_WALLET_ADDRESS",
    liveBalanceCount: 0,
    transferCount: 0,
    buyRecordCount: 0,
    realCostCount: 0,
    missingCostCount: 0,
    holdings: [],
    message: isEvmAddress(walletAddress) ? "Checking BSC balanceOf and transfer-history cost basis." : "WALLET_ADDRESS is missing or invalid."
  };

  if (!base.walletConfigured) return base;

  try {
    const rawTransfers = await fetchWalletTokenTransfers(walletAddress);
    const buyRecords = buildBuyRecordsFromTransfers(rawTransfers || [], walletAddress);
    const costHoldings = calculateHoldings(buyRecords || []);
    const costMap = normalizeSymbolMap(costHoldings);

    let liveBalanceResult = { holdings: [], errors: [] };
    try {
      liveBalanceResult = await fetchWalletBalancesViaRpc(walletAddress, WATCHLIST, []);
    } catch (error) {
      liveBalanceResult = { holdings: [], errors: [error.message] };
    }

    const liveSymbols = (liveBalanceResult.holdings || []).map((h) => normalizeSymbol(h.symbol));
    const [tokenPrices, referencePrices] = await Promise.all([
      fetchTokenPrices(liveSymbols.length ? liveSymbols : WATCHLIST),
      fetchReferenceStockPrices(liveSymbols.length ? liveSymbols : WATCHLIST)
    ]);

    const holdings = (liveBalanceResult.holdings || [])
      .filter((h) => safeNumber(h.quantity) > 0)
      .map((h) => {
        const symbol = normalizeSymbol(h.symbol);
        const cost = costMap.get(symbol) || {};
        const totalCost = safeNumber(cost.totalCost);
        const tokenPrice = safeNumber(tokenPrices?.[symbol]?.price || tokenPrices?.[symbol.replace(/ON$/, "")]?.price);
        const marketValue = safeNumber(h.quantity) * tokenPrice;
        return {
          symbol,
          quantity: safeNumber(h.quantity),
          quantitySource: "bsc_rpc_balanceOf_live",
          totalCost,
          marketValue,
          tokenPrice,
          costBasisSource: totalCost > 0 ? "transfer_history" : "missing_real_cost_basis",
          costStatus: totalCost > 0 ? "PASS" : "MISSING",
          contractAddress: h.contractAddress || null,
          liveBalanceSource: h.source || null
        };
      });

    const realCostCount = holdings.filter((h) => h.totalCost > 0).length;
    const missingCostCount = holdings.length - realCostCount;
    const status = holdings.length > 0 && missingCostCount === 0 ? "PASS" : holdings.length > 0 ? "PARTIAL" : "NO_LIVE_BALANCE";

    return {
      ...base,
      status,
      transferCount: (rawTransfers || []).length,
      buyRecordCount: (buyRecords || []).length,
      liveBalanceCount: holdings.length,
      realCostCount,
      missingCostCount,
      liveBalanceErrors: liveBalanceResult.errors || [],
      tokenPriceSource: Array.from(new Set(Object.values(tokenPrices || {}).map((p) => p.source).filter(Boolean))).join("、") || "unknown",
      referencePriceSource: Array.from(new Set(Object.values(referencePrices || {}).map((p) => p.source).filter(Boolean))).join("、") || "unknown",
      holdings,
      message: status === "PASS"
        ? "xStocks live quantity and real transfer-history cost basis are both available."
        : status === "PARTIAL"
          ? "xStocks live quantity is available, but some cost basis is missing."
          : "No live xStocks balance found from BSC balanceOf."
    };
  } catch (error) {
    return { ...base, status: "FAIL", error: error.message, message: "xStocks real position audit failed." };
  }
}

function overallStatus(btc, xstocks) {
  if (btc.status === "PASS" && xstocks.status === "PASS") return "PASS";
  if ([btc.status, xstocks.status].includes("FAIL")) return "FAIL";
  if (btc.status === "PASS" || ["PASS", "PARTIAL"].includes(xstocks.status)) return "PARTIAL";
  return "CHECK";
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  const [btc, xstocks] = await Promise.all([auditBinanceBtc(), auditXStocks()]);
  const status = overallStatus(btc, xstocks);

  return res.status(200).json({
    ok: true,
    status,
    checkedAt: new Date().toISOString(),
    policy: {
      btcSource: "Binance spot read-only account",
      xstocksQuantitySource: "BSC / BNB Chain balanceOf",
      xstocksCostSource: "Moralis / MegaNode / NodeReal transfer history when available",
      noManualBtcFallback: true,
      noFallbackCost: true
    },
    btc,
    xstocks
  });
}
