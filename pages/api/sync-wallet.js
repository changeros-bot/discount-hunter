// DCA Discount Hunter - Strict Onchain Wallet Sync API
// Source of truth for current xStocks holdings is live BNB Chain balanceOf().
// Transfer history is used only when it can derive a real cost basis.
// No fallback cost is injected in strict mode.

const { fetchWalletTokenTransfers, hasMoralisKey, hasMegaNodeKey } = require("../../lib/xstocks/transfer-source");
const { buildBuyRecordsFromTransfers, calculateHoldings, getXStockSymbol } = require("../../lib/xstocks/costBasis");
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

function normalizeOnSymbol(symbol) {
  const s = upper(symbol);
  if (!s) return "";
  return s.endsWith("ON") ? s : `${s}ON`;
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

function buildContractHints(transfers) {
  const map = new Map();
  for (const tx of transfers || []) {
    const symbol = normalizeOnSymbol(getXStockSymbol(tx));
    const contractAddress = cleanAddress(tx.contractAddress).toLowerCase();
    if (!symbol || !isEvmAddress(contractAddress)) continue;
    const key = `${symbol}:${contractAddress}`;
    if (map.has(key)) continue;
    map.set(key, {
      symbol,
      contractAddress,
      decimals: Number(tx.tokenDecimal || 18) || 18,
      tokenSymbol: tx.tokenSymbol || null,
      tokenName: tx.tokenName || null,
      source: "moralis_transfer_contract_hint",
    });
  }
  return [...map.values()];
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

function detailValue(detail, tokenPrice) {
  return safeNumber(detail?.quantity) * safeNumber(tokenPrice);
}

function selectBestLiveContracts(liveHoldings, costHoldings, tokenPrices) {
  const costMap = normalizeSymbolMap(costHoldings);
  const selected = [];
  const excluded = [];

  for (const live of liveHoldings || []) {
    const symbol = upper(live.symbol);
    const details = Array.isArray(live.details) && live.details.length > 0 ? live.details : [live];
    const cost = costMap.get(symbol) || costMap.get(stripOn(symbol)) || {};
    const totalCost = safeNumber(cost.totalCost);
    const tokenPrice = safeNumber(pickPrice(tokenPrices, symbol)?.price);

    const enrichedDetails = details.map((detail) => ({
      ...detail,
      symbol,
      quantity: safeNumber(detail.quantity),
      estimatedValueUSD: detailValue(detail, tokenPrice),
      tokenPrice,
      distanceToCost: totalCost > 0 && tokenPrice > 0 ? Math.abs(detailValue(detail, tokenPrice) - totalCost) : null,
    })).filter((detail) => detail.quantity > 0);

    if (enrichedDetails.length === 0) continue;

    if (enrichedDetails.length === 1 || totalCost <= 0 || tokenPrice <= 0) {
      const only = enrichedDetails[0];
      selected.push({
        ...live,
        quantity: only.quantity,
        contractAddress: only.contractAddress || live.contractAddress || null,
        contractAddresses: [only.contractAddress || live.contractAddress].filter(Boolean),
        details: [only],
        selectionReason: enrichedDetails.length === 1 ? "single_live_contract" : "no_cost_or_price_for_contract_selection",
      });
      continue;
    }

    const sorted = [...enrichedDetails].sort((a, b) => a.distanceToCost - b.distanceToCost);
    const best = sorted[0];
    const rejected = sorted.slice(1).map((detail) => ({
      ...detail,
      excludedReason: "estimated_value_farther_from_cost_basis_than_selected_contract",
      selectedContractAddress: best.contractAddress || null,
    }));

    selected.push({
      ...live,
      quantity: best.quantity,
      contractAddress: best.contractAddress || live.contractAddress || null,
      contractAddresses: [best.contractAddress || live.contractAddress].filter(Boolean),
      details: [best],
      excludedDetails: rejected,
      selectionReason: "selected_contract_value_closest_to_cost_basis",
    });
    excluded.push(...rejected.map((detail) => ({ symbol, ...detail })));
  }

  return { selected, excluded };
}

function mergeLiveQuantities(costHoldings, liveHoldings) {
  const costMap = normalizeSymbolMap(costHoldings);
  const merged = [];

  for (const live of liveHoldings || []) {
    const symbol = upper(live.symbol);
    const liveQuantity = safeNumber(live.quantity);
    if (!symbol || liveQuantity <= 0) continue;

    const cost = costMap.get(symbol) || costMap.get(stripOn(symbol)) || {};
    const costQuantity = safeNumber(cost.quantity);
    const rawTotalCost = safeNumber(cost.totalCost);
    const hasRealCostBasis = rawTotalCost > 0;
    const totalCost = hasRealCostBasis ? rawTotalCost : 0;
    const costBasisAverageCost = costQuantity > 0 && rawTotalCost > 0 ? rawTotalCost / costQuantity : safeNumber(cost.averageCost);

    merged.push({
      ...cost,
      symbol,
      costBasisQuantity: costQuantity,
      quantity: liveQuantity,
      totalCost,
      rawTotalCost,
      averageCost: liveQuantity > 0 && totalCost > 0 ? totalCost / liveQuantity : 0,
      costBasisAverageCost,
      buyCount: cost.buyCount || 0,
      sellCount: cost.sellCount || 0,
      firstBuyTimestamp: cost.firstBuyTimestamp || null,
      lastBuyTimestamp: cost.lastBuyTimestamp || null,
      lastSellTimestamp: cost.lastSellTimestamp || null,
      officialHolding: true,
      costBasisSource: hasRealCostBasis ? "transfer_history" : "missing_real_cost_basis",
      costBasisEstimated: false,
      costBasisMissing: !hasRealCostBasis,
      costBasisWarning: hasRealCostBasis ? null : `No real transfer-history cost found for ${symbol}; cost/PnL are hidden instead of using fallback cost.`,
      quantitySource: "bsc_rpc_balanceOf_live",
      liveBalanceContractAddress: live.contractAddress || null,
      liveBalanceContractAddresses: live.contractAddresses || (live.contractAddress ? [live.contractAddress] : []),
      liveBalanceDetails: live.details || [],
      excludedLiveBalanceDetails: live.excludedDetails || [],
      liveBalanceDecimals: live.decimals ?? null,
      liveBalanceSource: live.source || null,
      liveContractSelectionReason: live.selectionReason || null,
    });
  }

  return merged;
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
    const hasCost = totalCost > 0;
    const unrealizedPnL = hasCost ? currentValue - totalCost : null;
    const pnlPct = hasCost ? unrealizedPnL / totalCost : null;
    const referenceStockPrice = safeNumber(referencePriceData?.price);
    const premiumDiscount = tokenPrice - referenceStockPrice;
    const premiumDiscountPct = referenceStockPrice > 0 ? premiumDiscount / referenceStockPrice : 0;

    return {
      ...h,
      symbol,
      quantity,
      valuationQuantity: quantity,
      totalCost,
      averageCost: quantity > 0 && totalCost > 0 ? totalCost / quantity : 0,
      tokenPrice,
      marketPrice: tokenPrice,
      currentValue,
      rawCurrentValue: currentValue,
      marketValue: currentValue,
      positionValue: currentValue,
      unrealizedPnL,
      pnlPct,
      returnPct: pnlPct,
      referenceStockPrice,
      premiumDiscount,
      premiumDiscountPct,
      valuationGuardApplied: false,
      valuationWarning: null,
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
  const portfolioRawMarketValue = holdings.reduce((sum, h) => sum + safeNumber(h.rawCurrentValue), 0);
  const costBasisMissingCount = holdings.filter((h) => h.costBasisMissing).length;
  const portfolioUnrealizedPnL = portfolioTotalCost > 0 ? portfolioMarketValue - portfolioTotalCost : null;
  const portfolioPnLPct = portfolioTotalCost > 0 ? portfolioUnrealizedPnL / portfolioTotalCost : null;
  return {
    actualTotalInvested: portfolioTotalCost,
    portfolioTotalCost,
    portfolioMarketValue,
    portfolioRawMarketValue,
    portfolioUnrealizedPnL,
    portfolioPnLPct,
    totalCost: portfolioTotalCost,
    marketValue: portfolioMarketValue,
    rawMarketValue: portfolioRawMarketValue,
    currentValue: portfolioMarketValue,
    unrealizedPnL: portfolioUnrealizedPnL,
    returnPct: portfolioPnLPct,
    costBasisMissingCount,
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
    const contractHints = buildContractHints(transfers);
    const liveScanSymbols = WATCHLIST;

    let liveBalanceResult = { holdings: [], errors: [], tokenMetadata: [], contractHoldings: [] };
    try {
      liveBalanceResult = await fetchWalletBalancesViaRpc(walletAddress, liveScanSymbols, contractHints);
    } catch (error) {
      liveBalanceResult = { holdings: [], errors: [error.message], tokenMetadata: [], contractHoldings: [] };
    }

    const prePriceSymbols = liveBalanceResult.holdings?.length > 0 ? liveBalanceResult.holdings.map((h) => upper(h.symbol)) : liveScanSymbols;
    const [tokenPrices, referencePrices] = await Promise.all([
      fetchTokenPrices(prePriceSymbols),
      fetchReferenceStockPrices(prePriceSymbols),
    ]);

    const liveSelection = selectBestLiveContracts(liveBalanceResult.holdings, costHoldings, tokenPrices);
    const baseHoldings = mergeLiveQuantities(costHoldings, liveSelection.selected);
    const holdings = enrichHoldings(baseHoldings, tokenPrices, referencePrices);
    const summary = summarize(holdings);
    const tokenPriceSources = Array.from(new Set(Object.values(tokenPrices || {}).map((p) => p.source).filter(Boolean))).sort();
    const referencePriceSources = Array.from(new Set(Object.values(referencePrices || {}).map((p) => p.source).filter(Boolean))).sort();

    return res.status(200).json({
      ok: true,
      version: "strict-onchain-no-fallback-cost-v17",
      strictOnchain: true,
      ...summary,
      holdings,
      walletAddress: `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
      fullWalletAddress: walletAddress,
      positionSource: bodyWalletAddress ? "manual_body" : queryWalletAddress ? "query_address" : "env_wallet_address",
      walletSyncSource: hasMoralisKey() ? "moralis_cost_basis + verified_bsc_rpc_balanceOf_source_of_truth" : hasMegaNodeKey() ? "meganode_cost_basis + verified_bsc_rpc_balanceOf_source_of_truth" : "legacy_cost_basis + verified_bsc_rpc_balanceOf_source_of_truth",
      source: hasMoralisKey() ? "Moralis cost basis + verified live RPC balances" : hasMegaNodeKey() ? "MegaNode cost basis + verified live RPC balances" : "Legacy cost basis + verified live RPC balances",
      priceSource: tokenPriceSources.join("、") || "binance_xstocks_live",
      referencePriceSource: referencePriceSources.join("、") || "binance_stock_reference_live",
      lastSyncTime: new Date().toISOString(),
      checkedAt: new Date().toISOString(),
      configured: {
        moralis: hasMoralisKey(),
        megaNode: hasMegaNodeKey(),
        legacyBscScan: Boolean(process.env.BSCSCAN_API_KEY),
        rpcBalance: true,
        fallbackFirstLayerCostUsd: 0,
      },
      debugCounts: {
        walletAddressLength: walletAddress.length,
        totalTransfers: transfers.length,
        buyRecordsCount: buyRecords.length,
        costHoldingsCount: costHoldings.length,
        contractHintsCount: contractHints.length,
        contractHintSymbols: Array.from(new Set(contractHints.map((h) => upper(h.symbol)))).sort(),
        liveScanSymbols,
        liveBalanceHoldingsCount: liveBalanceResult.holdings?.length || 0,
        selectedLiveBalanceHoldingsCount: liveSelection.selected.length,
        excludedLiveBalanceDetailsCount: liveSelection.excluded.length,
        excludedLiveBalanceDetails: liveSelection.excluded,
        liveContractHoldingsCount: liveBalanceResult.contractHoldings?.length || 0,
        liveBalanceErrors: liveBalanceResult.errors || [],
        liveBalanceBlockNumber: liveBalanceResult.checkedBlockNumber || null,
        holdingsCount: holdings.length,
        costBasisMissingCount: holdings.filter((h) => h.costBasisMissing).length,
        costBasisMissingSymbols: holdings.filter((h) => h.costBasisMissing).map((h) => h.symbol),
        tokenPriceSymbols: Object.keys(tokenPrices || {}).sort(),
        referencePriceSymbols: Object.keys(referencePrices || {}).sort(),
        buyRecordSymbols: Array.from(new Set(buyRecords.map((r) => upper(r.symbol)))).sort(),
        costHoldingSymbols: costHoldings.map((h) => h.symbol),
        liveBalanceSymbols: (liveBalanceResult.holdings || []).map((h) => upper(h.symbol)),
        selectedLiveBalanceSymbols: liveSelection.selected.map((h) => upper(h.symbol)),
        holdingSymbols: holdings.map((h) => h.symbol),
        liveTokenMetadata: (liveBalanceResult.tokenMetadata || []).map((t) => ({ symbol: t.symbol, contractAddress: t.contractAddress, source: t.source })),
        holdingPriceDebug: holdings.map((h) => ({
          symbol: h.symbol,
          quantity: h.quantity,
          valuationQuantity: h.valuationQuantity,
          costBasisQuantity: h.costBasisQuantity,
          costBasisSource: h.costBasisSource,
          costBasisMissing: h.costBasisMissing,
          costBasisWarning: h.costBasisWarning,
          quantitySource: h.quantitySource,
          liveBalanceSource: h.liveBalanceSource,
          liveBalanceContractAddress: h.liveBalanceContractAddress,
          liveBalanceContractAddresses: h.liveBalanceContractAddresses,
          liveBalanceDetails: h.liveBalanceDetails,
          excludedLiveBalanceDetails: h.excludedLiveBalanceDetails,
          tokenPrice: h.tokenPrice,
          currentValue: h.currentValue,
          rawCurrentValue: h.rawCurrentValue,
          totalCost: h.totalCost,
          rawTotalCost: h.rawTotalCost,
          valuationGuardApplied: h.valuationGuardApplied,
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
