// DCA Discount Hunter V15.25 - Holdings debug endpoint
// Uses the same source pipeline as sync-wallet:
// Moralis/MegaNode transfers for cost basis + verified BSC RPC balanceOf for live holdings.

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
    const key = [tx.hash, tx.contractAddress, tx.from, tx.to, tx.value, tx.valueDecimal]
      .map((v) => String(v || "").toLowerCase())
      .join("|");
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

function mergeLiveAndCost(costHoldings, liveHoldings) {
  const costMap = normalizeSymbolMap(costHoldings);
  return (liveHoldings || []).map((live) => {
    const symbol = upper(live.symbol);
    const cost = costMap.get(symbol) || costMap.get(stripOn(symbol)) || {};
    const quantity = safeNumber(live.quantity);
    const totalCost = safeNumber(cost.totalCost);
    return {
      symbol,
      quantity,
      totalCost,
      averageCost: quantity > 0 && totalCost > 0 ? totalCost / quantity : 0,
      costBasisQuantity: safeNumber(cost.quantity),
      buyCount: cost.buyCount || 0,
      sellCount: cost.sellCount || 0,
      liveBalanceContractAddress: live.contractAddress || null,
      liveBalanceContractAddresses: live.contractAddresses || (live.contractAddress ? [live.contractAddress] : []),
      liveBalanceSource: live.source || null,
      liveBalanceDetails: live.details || [],
      hasCostBasis: totalCost > 0,
    };
  });
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const walletAddress = cleanAddress(process.env.WALLET_ADDRESS);
    if (!isEvmAddress(walletAddress)) {
      return res.status(400).json({ ok: false, error: "WALLET_ADDRESS not found or invalid" });
    }

    const rawTransfers = await fetchWalletTokenTransfers(walletAddress);
    const transfers = uniqueTransfers(rawTransfers);
    const buyRecords = buildBuyRecordsFromTransfers(transfers, walletAddress);
    const costHoldings = calculateHoldings(buyRecords);
    const contractHints = buildContractHints(transfers);
    const liveBalanceResult = await fetchWalletBalancesViaRpc(walletAddress, WATCHLIST, contractHints);
    const merged = mergeLiveAndCost(costHoldings, liveBalanceResult.holdings || []);

    const symbols = merged.length > 0 ? merged.map((h) => h.symbol) : WATCHLIST;
    const [tokenPrices, referencePrices] = await Promise.all([
      fetchTokenPrices(symbols),
      fetchReferenceStockPrices(symbols),
    ]);

    const holdings = merged.map((h) => {
      const tokenPriceData = pickPrice(tokenPrices, h.symbol);
      const tokenPrice = safeNumber(tokenPriceData?.price);
      const currentValue = safeNumber(h.quantity) * tokenPrice;
      const unrealizedPnL = currentValue - safeNumber(h.totalCost);
      return {
        ...h,
        tokenPrice,
        currentValue,
        unrealizedPnL,
        returnPct: safeNumber(h.totalCost) > 0 ? unrealizedPnL / safeNumber(h.totalCost) : 0,
        priceSource: tokenPriceData?.source || null,
      };
    });

    const totalCost = holdings.reduce((sum, h) => sum + safeNumber(h.totalCost), 0);
    const marketValue = holdings.reduce((sum, h) => sum + safeNumber(h.currentValue), 0);

    return res.status(200).json({
      ok: true,
      version: "15.25-debug-holdings-live-sources",
      walletAddress: `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
      fullWalletAddress: walletAddress,
      source: hasMoralisKey() ? "Moralis cost basis + verified BSC RPC live holdings" : hasMegaNodeKey() ? "MegaNode cost basis + verified BSC RPC live holdings" : "Legacy cost basis + verified BSC RPC live holdings",
      checkedAt: new Date().toISOString(),
      summary: {
        totalTransfers: transfers.length,
        buyRecordsCount: buyRecords.length,
        costHoldingsCount: costHoldings.length,
        liveHoldingsCount: liveBalanceResult.holdings?.length || 0,
        mergedHoldingsCount: holdings.length,
        totalCost,
        marketValue,
        unrealizedPnL: marketValue - totalCost,
        holdingSymbols: holdings.map((h) => h.symbol),
        costHoldingSymbols: costHoldings.map((h) => upper(h.symbol)),
        liveHoldingSymbols: (liveBalanceResult.holdings || []).map((h) => upper(h.symbol)),
        missingCostSymbols: holdings.filter((h) => !h.hasCostBasis).map((h) => h.symbol),
        liveBalanceErrors: liveBalanceResult.errors || [],
      },
      holdings,
      costHoldings,
      liveHoldings: liveBalanceResult.holdings || [],
      tokenMetadata: liveBalanceResult.tokenMetadata || [],
    });
  } catch (error) {
    console.error("debug-holdings error:", error);
    return res.status(500).json({ ok: false, error: error.message || "Unknown error" });
  }
};
