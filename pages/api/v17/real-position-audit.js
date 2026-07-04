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

function cleanAddress(value) { return String(value || "").trim(); }
function isEvmAddress(value) { return /^0x[a-fA-F0-9]{40}$/.test(cleanAddress(value)); }
function maskAddress(address) { const a = cleanAddress(address); return a ? `${a.slice(0, 6)}...${a.slice(-4)}` : ""; }
function upper(value) { return String(value || "").trim().toUpperCase(); }
function normalizeSymbol(symbol) { const s = upper(symbol); return s.endsWith("ON") ? s : `${s}ON`; }
function normalizeSymbolMap(items) { const map = new Map(); for (const item of items || []) { const s = normalizeSymbol(item.symbol); if (s) map.set(s, item); } return map; }

async function fetchBtcMarketPrice() {
  try {
    const response = await fetch(`${getBinanceRestUrl()}/api/v3/ticker/price?symbol=BTCUSDT`, { cache: "no-store" });
    const json = await response.json();
    return safeNumber(json?.price);
  } catch { return 0; }
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
    quantityStatus: "UNKNOWN",
    costStatus: "UNKNOWN",
    quantity: 0,
    totalCost: 0,
    averageBuyPrice: 0,
    marketValue: 0,
    pnl: null,
    pnlPct: null,
    estimated: false,
    message: env.configured ? "Binance read-only credentials are configured." : "BINANCE_API_KEY / BINANCE_API_SECRET are not configured."
  };

  if (!env.configured) return { ...base, quantityStatus: "NOT_CONFIGURED", costStatus: "NOT_CONFIGURED" };

  try {
    const btcPrice = await fetchBtcMarketPrice();
    const result = await fetchBinanceExchangePositions({ marketPrices: { BTC: { price: btcPrice } } });
    const btc = (result.holdings || []).find((h) => upper(h.symbol) === "BTC") || null;
    if (!btc || safeNumber(btc.quantity) <= 0) {
      return { ...base, status: "NO_BTC_BALANCE", quantityStatus: "NO_BALANCE", costStatus: "NO_BALANCE", marketPrice: btcPrice, message: "Binance account API synced, but BTC balance is zero or unavailable." };
    }

    const hasCost = safeNumber(btc.totalCost) > 0 && !btc.costBasisMissing;
    return {
      ...base,
      status: hasCost ? "PASS" : "PARTIAL_API_QUANTITY_ONLY",
      quantityStatus: "PASS_API_SYNCED",
      costStatus: hasCost ? "PASS_API_SYNCED" : "MISSING_API_COST",
      marketPrice: btcPrice,
      quantity: safeNumber(btc.quantity),
      totalCost: hasCost ? safeNumber(btc.totalCost) : 0,
      averageBuyPrice: hasCost ? safeNumber(btc.averageBuyPrice || btc.averageCost) : 0,
      marketValue: safeNumber(btc.currentValue || btc.marketValue),
      pnl: hasCost ? btc.unrealizedPnL ?? null : null,
      pnlPct: hasCost ? btc.pnlPct ?? btc.returnPct ?? null : null,
      tradeCount: btc.tradeCount || 0,
      tradeSymbolsUsed: btc.tradeSymbolsUsed || [],
      tradeFetchErrors: btc.tradeFetchErrors || result.btcTradeFetch?.errors || [],
      quantitySource: btc.quantitySource || "binance_account_readonly",
      costBasisSource: hasCost ? btc.costBasisSource : "missing_binance_myTrades_cost_basis",
      costBasisMissing: !hasCost,
      estimated: false,
      message: hasCost
        ? "BTC quantity and cost basis are both synced from Binance APIs."
        : "BTC quantity is synced from Binance account API. Cost/PnL are hidden because Binance myTrades did not return usable cost basis."
    };
  } catch (error) {
    return { ...base, status: "FAIL", quantityStatus: "FAIL", costStatus: "FAIL", error: error.message, message: "Binance read-only sync failed." };
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
    quantityStatus: "UNKNOWN",
    costStatus: "UNKNOWN",
    liveBalanceCount: 0,
    transferCount: 0,
    buyRecordCount: 0,
    realCostCount: 0,
    missingCostCount: 0,
    estimated: false,
    holdings: [],
    message: isEvmAddress(walletAddress) ? "Checking BSC balanceOf and transfer-history cost basis." : "WALLET_ADDRESS is missing or invalid."
  };

  if (!base.walletConfigured) return { ...base, quantityStatus: "NO_WALLET_ADDRESS", costStatus: "NO_WALLET_ADDRESS" };

  try {
    const rawTransfers = await fetchWalletTokenTransfers(walletAddress);
    const buyRecords = buildBuyRecordsFromTransfers(rawTransfers || [], walletAddress);
    const costHoldings = calculateHoldings(buyRecords || []);
    const costMap = normalizeSymbolMap(costHoldings);

    let liveBalanceResult = { holdings: [], errors: [] };
    try { liveBalanceResult = await fetchWalletBalancesViaRpc(walletAddress, WATCHLIST, []); }
    catch (error) { liveBalanceResult = { holdings: [], errors: [error.message] }; }

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
        const hasCost = totalCost > 0;
        return {
          symbol,
          quantity: safeNumber(h.quantity),
          quantitySource: "bsc_rpc_balanceOf_live",
          quantityStatus: "PASS_API_SYNCED",
          totalCost: hasCost ? totalCost : 0,
          marketValue,
          tokenPrice,
          pnl: hasCost ? marketValue - totalCost : null,
          pnlPct: hasCost ? (marketValue - totalCost) / totalCost : null,
          costBasisSource: hasCost ? "transfer_history" : "missing_real_cost_basis",
          costStatus: hasCost ? "PASS_API_SYNCED" : "MISSING_API_COST",
          estimated: false,
          contractAddress: h.contractAddress || null,
          liveBalanceSource: h.source || null
        };
      });

    const realCostCount = holdings.filter((h) => h.totalCost > 0).length;
    const missingCostCount = holdings.length - realCostCount;
    const status = holdings.length > 0 && missingCostCount === 0 ? "PASS" : holdings.length > 0 ? "PARTIAL_API_QUANTITY_ONLY" : "NO_LIVE_BALANCE";

    return {
      ...base,
      status,
      quantityStatus: holdings.length > 0 ? "PASS_API_SYNCED" : "NO_LIVE_BALANCE",
      costStatus: holdings.length > 0 && missingCostCount === 0 ? "PASS_API_SYNCED" : holdings.length > 0 ? "MISSING_API_COST" : "NO_LIVE_BALANCE",
      transferCount: (rawTransfers || []).length,
      buyRecordCount: (buyRecords || []).length,
      liveBalanceCount: holdings.length,
      realCostCount,
      missingCostCount,
      liveBalanceErrors: liveBalanceResult.errors || [],
      tokenPriceSource: Array.from(new Set(Object.values(tokenPrices || {}).map((p) => p.source).filter(Boolean))).join("、") || "unknown",
      referencePriceSource: Array.from(new Set(Object.values(referencePrices || {}).map((p) => p.source).filter(Boolean))).join("、") || "unknown",
      holdings,
      estimated: false,
      message: status === "PASS"
        ? "xStocks live quantity and transfer-history cost basis are both synced from APIs."
        : status === "PARTIAL_API_QUANTITY_ONLY"
          ? "xStocks live quantity is synced from BSC balanceOf. Cost/PnL are hidden where transfer-history cost is missing."
          : "No live xStocks balance found from BSC balanceOf."
    };
  } catch (error) {
    return { ...base, status: "FAIL", quantityStatus: "FAIL", costStatus: "FAIL", error: error.message, message: "xStocks real position audit failed." };
  }
}

function overallStatus(btc, xstocks) {
  if (btc.status === "PASS" && xstocks.status === "PASS") return "PASS";
  if ([btc.status, xstocks.status].includes("FAIL")) return "FAIL";
  if ([btc.status, xstocks.status].some((s) => ["PASS", "PARTIAL_API_QUANTITY_ONLY"].includes(s))) return "PARTIAL_API_QUANTITY_ONLY";
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
      btcQuantitySource: "Binance /api/v3/account",
      btcCostSource: "Binance /api/v3/myTrades only when API returns usable trades",
      xstocksQuantitySource: "BSC / BNB Chain balanceOf",
      xstocksCostSource: "Moralis / MegaNode / NodeReal transfer history only when API returns usable transfers",
      noManualBtcFallback: true,
      noScreenshotFallback: true,
      noFallbackCost: true,
      noEstimatedCost: true
    },
    btc,
    xstocks
  });
}
