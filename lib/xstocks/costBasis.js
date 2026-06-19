// DCA Discount Hunter V15.3 - Cost Basis Engine
// Reconstructs buy records by matching stablecoin OUT + xStock IN in the same txHash.

const { WATCHLIST, STABLECOINS, toLower, convertValue } = require("./constants");
const { XSTOCK_CONTRACTS } = require("./contracts");

const STABLE_CONTRACTS = {
  // BSC USDT / Binance-Peg BSC-USD
  "0x55d398326f99059ff775485246999027b3197955": "BSC-USD",
  // BUSD
  "0xe9e7cea3dedca5984780bafc599bd69add087d56": "BUSD",
  // USDC
  "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d": "USDC",
  // USDon / Ondo dollar token, if used by GM flows
  "0x1f8955e640cbd9abc3c3bb408c9e2e1f5f20dfe6": "USDon",
};

function upper(value) {
  return String(value || "").trim().toUpperCase();
}

function cleanAddress(value) {
  return String(value || "").trim().toLowerCase();
}

function safeNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

const XSTOCK_BY_CONTRACT = Object.fromEntries(
  Object.values(XSTOCK_CONTRACTS).map((item) => [cleanAddress(item.contractAddress), item.symbol])
);

function getXStockSymbol(tx) {
  const byContract = XSTOCK_BY_CONTRACT[cleanAddress(tx.contractAddress)];
  if (byContract) return byContract;

  const symbol = upper(tx.tokenSymbol);
  const watchlistUpper = WATCHLIST.map((s) => upper(s));
  return watchlistUpper.includes(symbol) ? symbol : null;
}

function isStablecoin(tx) {
  const byContract = STABLE_CONTRACTS[cleanAddress(tx.contractAddress)];
  if (byContract) return true;

  const symbol = upper(tx.tokenSymbol);
  const stablecoinUpper = STABLECOINS.map((s) => upper(s));
  return stablecoinUpper.includes(symbol) || symbol === "USDON";
}

function txAmount(tx) {
  return safeNumber(convertValue(tx.value, tx.tokenDecimal));
}

function groupByHash(transfers) {
  const groups = new Map();
  for (const tx of transfers || []) {
    const hash = String(tx.hash || "").trim();
    if (!hash) continue;
    const existing = groups.get(hash) || [];
    existing.push(tx);
    groups.set(hash, existing);
  }
  return groups;
}

function buildBuyRecordsFromTransfers(transfers, walletAddress) {
  const myAddress = toLower(walletAddress);
  const groups = groupByHash(transfers);
  const records = [];

  for (const [hash, txs] of groups.entries()) {
    const stableOutflows = txs.filter((tx) => isStablecoin(tx) && toLower(tx.from) === myAddress);
    const stableInflows = txs.filter((tx) => isStablecoin(tx) && toLower(tx.to) === myAddress);
    const xstockInflows = txs.filter((tx) => getXStockSymbol(tx) && toLower(tx.to) === myAddress);
    const xstockOutflows = txs.filter((tx) => getXStockSymbol(tx) && toLower(tx.from) === myAddress);

    const stableOutUsd = stableOutflows.reduce((sum, tx) => sum + txAmount(tx), 0);
    const stableInUsd = stableInflows.reduce((sum, tx) => sum + txAmount(tx), 0);

    // BUY: stablecoin OUT + xStock IN in the same txHash.
    for (const xtx of xstockInflows) {
      const symbol = getXStockSymbol(xtx);
      const quantity = txAmount(xtx);
      const costUsd = stableOutUsd;

      records.push({
        symbol,
        txHash: hash,
        quantity: safeNumber(quantity),
        costUsd: safeNumber(costUsd),
        timestamp: xtx.timeStamp,
        stablecoinOutflowCount: stableOutflows.length,
        stablecoinInflowCount: stableInflows.length,
        xstockOutflowCount: xstockOutflows.length,
        type: costUsd > 0 ? "BUY" : "TRANSFER_IN",
        ...(costUsd > 0 ? {} : { warning: `No stablecoin outflow found for hash ${hash} - treated as transfer-in with cost 0` }),
      });
    }

    // SELL support is intentionally deferred for V16. Keep debug visibility for later.
    if (xstockOutflows.length > 0 && stableInUsd > 0) {
      for (const xtx of xstockOutflows) {
        records.push({
          symbol: getXStockSymbol(xtx),
          txHash: hash,
          quantity: -safeNumber(txAmount(xtx)),
          costUsd: -safeNumber(stableInUsd),
          timestamp: xtx.timeStamp,
          stablecoinOutflowCount: stableOutflows.length,
          stablecoinInflowCount: stableInflows.length,
          type: "SELL_DEBUG_ONLY",
          warning: "Sell detected; V15 holdings use buy-side cost basis only. FIFO realized PnL deferred to V16.",
        });
      }
    }
  }

  return records.sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0));
}

function calculateHoldings(records) {
  const grouped = new Map();

  for (const r of records) {
    const symbol = upper(r.symbol);
    if (!symbol || r.type === "SELL_DEBUG_ONLY") continue;

    const quantity = safeNumber(r.quantity);
    const costUsd = safeNumber(r.costUsd);
    const existing = grouped.get(symbol);

    if (!existing) {
      grouped.set(symbol, {
        quantity,
        totalCost: costUsd,
        buyCount: costUsd > 0 ? 1 : 0,
        firstBuyTimestamp: costUsd > 0 ? r.timestamp : null,
        lastBuyTimestamp: costUsd > 0 ? r.timestamp : null,
      });
    } else {
      existing.quantity += quantity;
      existing.totalCost += costUsd;
      if (costUsd > 0) existing.buyCount += 1;

      if (costUsd > 0 && (!existing.firstBuyTimestamp || Number(r.timestamp) < Number(existing.firstBuyTimestamp))) {
        existing.firstBuyTimestamp = r.timestamp;
      }
      if (costUsd > 0 && (!existing.lastBuyTimestamp || Number(r.timestamp) > Number(existing.lastBuyTimestamp))) {
        existing.lastBuyTimestamp = r.timestamp;
      }
    }
  }

  const holdings = [];
  for (const [symbol, v] of grouped.entries()) {
    holdings.push({
      symbol,
      quantity: v.quantity,
      totalCost: v.totalCost,
      averageCost: v.quantity > 0 ? v.totalCost / v.quantity : 0,
      buyCount: v.buyCount,
      firstBuyTimestamp: v.firstBuyTimestamp,
      lastBuyTimestamp: v.lastBuyTimestamp,
    });
  }

  return holdings.sort((a, b) => b.totalCost - a.totalCost);
}

module.exports = {
  buildBuyRecordsFromTransfers,
  calculateHoldings,
};
