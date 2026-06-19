// DCA Discount Hunter V15.10 - Homepage Wallet Sync API
// Cost basis comes from Moralis transfer history.
// Official quantities come from live BNB Chain balanceOf(), which should match Binance Web3 Wallet more closely.

const { fetchWalletTokenTransfers, hasMoralisKey, hasMegaNodeKey } = require("../../lib/xstocks/transfer-source");
const { buildBuyRecordsFromTransfers, calculateHoldings } = require("../../lib/xstocks/costBasis");
const { fetchTokenPrices, fetchReferenceStockPrices } = require("../../lib/xstocks/prices");
const { fetchWalletBalancesViaRpc } = require("../../lib/xstocks/rpcBalances");
const { WATCHLIST } = require("../../lib/xstocks/constants");

function cleanAddress(value) {
  return String(value || "").trim();
}

function isEvmAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(cleanAddress(value));
}

function upper(value) {
  return String(value || "").trim().toUpperCase();
}

function stripOn(symbol) {
  return upper(symbol).replace(/ON$/, "");
}

function safeNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function uniqueTransfers(transfers) {
  const seen = new Set();
  const out = [];
  for (const tx of transfers || []) {
    const key = [tx.hash, tx.contractAddress, tx.from, tx.to, tx.value, tx.valueDecimal].map((v) => String(v || "").toLowerCase()).join("|");
    if (!tx.hash || seen.has(key)) continue;
    seen.add(key);
    out.push(tx);
  }
  return out;
}

function normalizePriceMap(prices) {
  const map = {};
  for (const [key, value] of Object.entries(prices || {})) {
    const k = upper(key);
    map[k] = value;
    map[stripOn(k)] = value;
    if (!k.endsWith("ON")) map[`${k}ON`] = value;
  }
  return map;
}

function pickPrice(prices, symbol) {
  const map = normalizePriceMap(prices);
  const s = upper(symbol);
  return map[s] || map[stripOn(s)] || map[`${stripOn(s)}ON`] || null;
}

function normalizeSymbolMap(items) {
  const map = new Map();
  for (const item of items || []) {
    const s = upper(item.symbol);
    if (!s) continue;
    map.set(s, item);
    map.set(stripOn(s), item);
    if (!s.endsWith("ON")) map.set(`${s}ON`, item);
  }
  return map;
}

function mergeLiveQuantities(costHoldings, liveHoldings) {
  const liveMap = normalizeSymbolMap(liveHoldings);

  return (costHoldings || []).map((h) => {
    const symbol = upper(h.symbol);
    const live = liveMap.get(symbol) || liveMap.get(stripOn(symbol));
    const liveQuantity = safeNumber(live?.quantity);

    return {
      ...h,
      symbol,
      costBasisQuantity: safeNumber(h.quantity),
      quantity: liveQuantity > 0 ? liveQuantity : safeNumber(h.quantity),
      quantitySource: liveQuantity > 0 ? "bsc_rpc_balanceOf_live" : "moralis_cost_basis_fallback",
      liveBalanceContractAddress: live?.contractAddress || null,
      liveBalanceDecimals: live?.decimals ?? null,
    };
  });
}

function enrichHoldings(holdings, tokenPrices, referencePrices) {
  return (holdings || []).map((h) => {
    const symbol = upper(h.symbol);
    const quantity = safeNumber(h.quantity);
    const totalCost = safeNumber(h.totalCost);
    const tokenPriceData = pickPrice(tokenPrices, symbol);
    const referencePriceData = pickPrice(referencePrices, symbol);
    const tokenPrice = safeNumber(tokenPriceData?.price);
    const currentValue = quantity * tokenPrice;
    const unrealizedPnL = currentValue - totalCost;
    const pnlPct = totalCost > 0 ? unrealizedPnL / totalCost : 0;
    const referenceStockPrice = safeNumber(referencePriceData?.price);
    const premiumDiscount = tokenPrice - referenceStockPrice;
    const premiumDiscountPct = referenceStockPrice > 0 ? premiumDiscount / referenceStockPrice : 0;

    return {
      ...h,
      symbol,
      quantity,
      totalCost,
      averageCost: quantity > 0 && totalCost > 0 ? totalCost / quantity : safeNumber(h.averageCost),
      tokenPrice,
      marketPrice: tokenPrice,
      currentValue,
      marketValue: currentValue,
      positionValue: currentValue,
      unrealizedPnL,
      pnlPct,
      returnPct: pnlPct,
      referenceStockPrice,
      premiumDiscount,
      premiumDiscountPct,
      priceSource: tokenPriceData?.source || null,
      referencePriceSource: referencePriceData?.source || null,
      rawTokenPrice: tokenPriceData?.rawTokenPrice || null,
      sharesMultiplier: tokenPriceData?.sharesMultiplier || null,
      ...(tokenPrice > 0 ? {} : { priceWarning: `No token price found for ${symbol}` }),
    };
  });
}

function summarize(holdings) {
  const portfolioTotalCost = holdings.reduce((sum, h) => sum + safeNumber(h.totalCost), 0);
  const portfolioMarketValue = holdings.reduce((sum, h) => sum + safeNumber(h.currentValue), 0);
  const portfolioUnrealizedPnL = portfolioMarketValue - portfolioTotalCost;
  const portfolioPnLPct = portfolioTotalCost > 0 ? portfolioUnrealizedPnL / portfolioTotalCost : 0;
  return {
    actualTotalInvested: portfolioTotalCost,
    portfolioTotalCost,
    portfolioMarketValue,
    portfolioUnrealizedPnL,
    portfolioPnLPct,
    totalCost: portfolioTotalCost,
    marketValue: portfolioMarketValue,
    currentValue: portfolioMarketValue,
    unrealizedPnL: portfolioUnrealizedPnL,
    returnPct: portfolioPnLPct,
  };
}

async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");

  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const bodyWalletAddress = req.body && typeof req.body.walletAddress === "string" ? req.body.walletAddress.trim() : "";
    const queryWalletAddress = req.query && typeof req.query.address === "string" ? req.query.address.trim() : "";
    const envWalletAddress = process.env.WALLET_ADDRESS ? String(process.env.WALLET_ADDRESS).trim() : "";
    const walletAddress = cleanAddress(bodyWalletAddress || queryWalletAddress || envWalletAddress);

    if (!isEvmAddress(walletAddress)) {
      return res.status(400).json({ error: "WALLET_ADDRESS not found or invalid" });
    }

    const rawTransfers = await fetchWalletTokenTransfers(walletAddress);
    const transfers = uniqueTransfers(rawTransfers);
    const buyRecords = buildBuyRecordsFromTransfers(transfers, walletAddress);
    const costHoldings = calculateHoldings(buyRecords);
    const symbols = costHoldings.length > 0 ? costHoldings.map((h) => upper(h.symbol)) : WATCHLIST;

    let liveBalanceResult = { holdings: [], errors: [] };
    try {
      liveBalanceResult = await fetchWalletBalancesViaRpc(walletAddress, symbols);
    } catch (error) {
      liveBalanceResult = { holdings: [], errors: [error.message] };
    }

    const baseHoldings = mergeLiveQuantities(costHoldings, liveBalanceResult.holdings);

    const [tokenPrices, referencePrices] = await Promise.all([
      fetchTokenPrices(symbols),
      fetchReferenceStockPrices(symbols),
    ]);

    const holdings = enrichHoldings(baseHoldings, tokenPrices, referencePrices);
    const summary = summarize(holdings);
    const tokenPriceSources = Array.from(new Set(Object.values(tokenPrices || {}).map((p) => p.source).filter(Boolean))).sort();
    const referencePriceSources = Array.from(new Set(Object.values(referencePrices || {}).map((p) => p.source).filter(Boolean))).sort();

    return res.status(200).json({
      ok: true,
      version: "15.10-live-balance-quantity",
      ...summary,
      holdings,
      walletAddress: `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
      fullWalletAddress: walletAddress,
      positionSource: bodyWalletAddress ? "manual_body" : queryWalletAddress ? "query_address" : "env_wallet_address",
      walletSyncSource: hasMoralisKey() ? "moralis_wallet_token_transfers + bsc_rpc_balanceOf" : hasMegaNodeKey() ? "meganode_wallet_token_transfers + bsc_rpc_balanceOf" : "legacy_fallback + bsc_rpc_balanceOf",
      source: hasMoralisKey() ? "Moralis cost basis + live RPC balances" : hasMegaNodeKey() ? "MegaNode cost basis + live RPC balances" : "Legacy fallback + live RPC balances",
      priceSource: tokenPriceSources.join("、") || "binance_xstocks_live",
      referencePriceSource: referencePriceSources.join("、") || "binance_stock_reference_live",
      lastSyncTime: new Date().toISOString(),
      checkedAt: new Date().toISOString(),
      configured: {
        moralis: hasMoralisKey(),
        megaNode: hasMegaNodeKey(),
        legacyBscScan: Boolean(process.env.BSCSCAN_API_KEY),
        rpcBalance: true,
      },
      debugCounts: {
        walletAddressLength: walletAddress.length,
        totalTransfers: transfers.length,
        buyRecordsCount: buyRecords.length,
        costHoldingsCount: costHoldings.length,
        liveBalanceHoldingsCount: liveBalanceResult.holdings?.length || 0,
        liveBalanceErrors: liveBalanceResult.errors || [],
        liveBalanceBlockNumber: liveBalanceResult.checkedBlockNumber || null,
        holdingsCount: holdings.length,
        tokenPriceSymbols: Object.keys(tokenPrices || {}).sort(),
        referencePriceSymbols: Object.keys(referencePrices || {}).sort(),
        tokenPriceSources,
        referencePriceSources,
        buyRecordSymbols: Array.from(new Set(buyRecords.map((r) => upper(r.symbol)))).sort(),
        holdingSymbols: holdings.map((h) => h.symbol),
        holdingPriceDebug: holdings.map((h) => ({
          symbol: h.symbol,
          quantity: h.quantity,
          costBasisQuantity: h.costBasisQuantity,
          quantitySource: h.quantitySource,
          tokenPrice: h.tokenPrice,
          currentValue: h.currentValue,
          totalCost: h.totalCost,
          priceSource: h.priceSource,
        })),
      },
    });
  } catch (error) {
    console.error("sync-wallet error:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Unknown error",
      configured: {
        moralis: hasMoralisKey(),
        megaNode: hasMegaNodeKey(),
        legacyBscScan: Boolean(process.env.BSCSCAN_API_KEY),
      },
    });
  }
}

module.exports = handler;
