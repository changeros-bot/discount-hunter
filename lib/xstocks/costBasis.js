// DCA Discount Hunter V15.2 - Cost Basis Engine

const { WATCHLIST, STABLECOINS, toLower, convertValue } = require("./constants");

function upper(value) {
  return String(value || "").trim().toUpperCase();
}

function safeNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function buildBuyRecordsFromTransfers(transfers, walletAddress) {
  const myAddress = toLower(walletAddress);
  const watchlistUpper = WATCHLIST.map((s) => upper(s));
  const stablecoinUpper = STABLECOINS.map((s) => upper(s));

  const incomingXStocks = transfers.filter((tx) => {
    const symbol = upper(tx.tokenSymbol);
    return watchlistUpper.includes(symbol) && toLower(tx.to) === myAddress;
  });

  const myStablecoinOutflows = transfers.filter((tx) => {
    const symbol = upper(tx.tokenSymbol);
    return stablecoinUpper.includes(symbol) && toLower(tx.from) === myAddress;
  });

  const stablecoinByHash = new Map();
  for (const out of myStablecoinOutflows) {
    const hash = String(out.hash || "").trim();
    if (!hash) continue;
    const existing = stablecoinByHash.get(hash) || [];
    existing.push(out);
    stablecoinByHash.set(hash, existing);
  }

  return incomingXStocks.map((xtx) => {
    const symbol = upper(xtx.tokenSymbol);
    const quantity = convertValue(xtx.value, xtx.tokenDecimal);
    const hash = String(xtx.hash || "").trim();
    const matchedOutflows = stablecoinByHash.get(hash) || [];

    let costUsd = 0;
    let warning;

    if (matchedOutflows.length === 0) {
      warning = `No stablecoin outflow found for hash ${hash} - cost set to 0, needs manual review`;
    } else {
      costUsd = matchedOutflows.reduce((sum, out) => {
        return sum + convertValue(out.value, out.tokenDecimal);
      }, 0);
    }

    return {
      symbol,
      txHash: hash,
      quantity: safeNumber(quantity),
      costUsd: safeNumber(costUsd),
      timestamp: xtx.timeStamp,
      stablecoinOutflowCount: matchedOutflows.length,
      ...(warning ? { warning } : {}),
    };
  });
}

function calculateHoldings(records) {
  const grouped = new Map();

  for (const r of records) {
    const symbol = upper(r.symbol);
    if (!symbol) continue;

    const quantity = safeNumber(r.quantity);
    const costUsd = safeNumber(r.costUsd);
    const existing = grouped.get(symbol);

    if (!existing) {
      grouped.set(symbol, {
        quantity,
        totalCost: costUsd,
        buyCount: 1,
        firstBuyTimestamp: r.timestamp,
        lastBuyTimestamp: r.timestamp,
      });
    } else {
      existing.quantity += quantity;
      existing.totalCost += costUsd;
      existing.buyCount += 1;

      if (Number(r.timestamp) < Number(existing.firstBuyTimestamp)) {
        existing.firstBuyTimestamp = r.timestamp;
      }
      if (Number(r.timestamp) > Number(existing.lastBuyTimestamp)) {
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
