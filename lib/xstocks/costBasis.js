// DCA折價獵人 V15.0 - Cost Basis Engine

const { WATCHLIST, STABLECOINS, toLower, convertValue } = require("./constants");

function buildBuyRecordsFromTransfers(transfers, walletAddress) {
  const myAddress = toLower(walletAddress);
  const watchlistUpper = WATCHLIST.map((s) => s.toUpperCase());

  const incomingXStocks = transfers.filter((tx) => {
    const symbol = String(tx.tokenSymbol || "").toUpperCase();
    return watchlistUpper.includes(symbol) && toLower(tx.to) === myAddress;
  });

  const myStablecoinOutflows = transfers.filter((tx) => {
    const symbol = String(tx.tokenSymbol || "").toUpperCase();
    return STABLECOINS.includes(symbol) && toLower(tx.from) === myAddress;
  });

  const stablecoinByHash = new Map();
  for (const out of myStablecoinOutflows) {
    const existing = stablecoinByHash.get(out.hash) || [];
    existing.push(out);
    stablecoinByHash.set(out.hash, existing);
  }

  return incomingXStocks.map((xtx) => {
    const symbol = String(xtx.tokenSymbol || "").toUpperCase();
    const quantity = convertValue(xtx.value, xtx.tokenDecimal);
    const matchedOutflows = stablecoinByHash.get(xtx.hash) || [];

    let costUsd = 0;
    let warning;

    if (matchedOutflows.length === 0) {
      warning = `No stablecoin outflow found for hash ${xtx.hash} - cost set to 0, needs manual review`;
    } else {
      costUsd = matchedOutflows.reduce((sum, out) => {
        return sum + convertValue(out.value, out.tokenDecimal);
      }, 0);
    }

    return {
      symbol,
      txHash: xtx.hash,
      quantity,
      costUsd,
      timestamp: xtx.timeStamp,
      ...(warning ? { warning } : {}),
    };
  });
}

function calculateHoldings(records) {
  const grouped = new Map();

  for (const r of records) {
    const symbol = String(r.symbol || "").toUpperCase();
    const existing = grouped.get(symbol);

    if (!existing) {
      grouped.set(symbol, {
        quantity: r.quantity,
        totalCost: r.costUsd,
        buyCount: 1,
        firstBuyTimestamp: r.timestamp,
        lastBuyTimestamp: r.timestamp,
      });
    } else {
      existing.quantity += r.quantity;
      existing.totalCost += r.costUsd;
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
