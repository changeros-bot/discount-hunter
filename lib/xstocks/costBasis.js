// DCA Discount Hunter V15.12 - Exact Cost Basis Engine
// Reconstructs holdings by matching stablecoin OUT + xStock IN as buys,
// and stablecoin IN + xStock OUT as sells.
// Buy cost is NET stablecoin spend (stable OUT minus same-tx stable refund IN),
// never the rounded UI amount and never gross outflow alone.

const { WATCHLIST, STABLECOINS, toLower, convertValue } = require("./constants");
const { XSTOCK_CONTRACTS } = require("./contracts");

const STABLE_CONTRACTS = {
  "0x55d398326f99059ff775485246999027b3197955": "BSC-USD",
  "0xe9e7cea3dedca5984780bafc599bd69add087d56": "BUSD",
  "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d": "USDC",
  "0x1f8955e640cbd9abc3c3bb408c9e2e1f5f20dfe6": "USDon",
};

const NAME_HINTS = [
  { symbol: "GOOGLON", hints: ["GOOGL", "GOOGLE", "ALPHABET"] },
  { symbol: "NVDAON", hints: ["NVDA", "NVIDIA"] },
  { symbol: "QQQON", hints: ["QQQ", "INVESCO QQQ", "NASDAQ 100"] },
  { symbol: "TSMON", hints: ["TSMON", "TAIWAN SEMICONDUCTOR", "TSMC", "TAIWAN SEMI"] },
  { symbol: "SPCXON", hints: ["SPCX", "SPACEX", "SPACE X"] },
  { symbol: "AMDON", hints: ["AMD", "ADVANCED MICRO"] },
  { symbol: "MRVLON", hints: ["MRVL", "MARVELL"] },
  { symbol: "RKLBON", hints: ["RKLB", "ROCKET LAB"] },
  { symbol: "AVGOON", hints: ["AVGO", "BROADCOM"] },
];

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

function looksRawInteger(value, decimals) {
  const str = String(value || "").trim();
  if (!/^\d+$/.test(str)) return false;
  const d = Number.parseInt(decimals, 10);
  const safeDecimals = Number.isFinite(d) ? d : 18;
  return str.length > Math.max(12, Math.floor(safeDecimals * 0.75));
}

const WATCHLIST_UPPER = WATCHLIST.map((s) => upper(s));

const XSTOCK_BY_CONTRACT = Object.fromEntries(
  Object.values(XSTOCK_CONTRACTS).map((item) => [cleanAddress(item.contractAddress), upper(item.symbol)])
);

function inferSymbolFromText(tx) {
  const rawSymbol = upper(tx.tokenSymbol);
  const rawName = upper(tx.tokenName);
  const text = `${rawSymbol} ${rawName}`;

  if (WATCHLIST_UPPER.includes(rawSymbol)) return rawSymbol;
  if (WATCHLIST_UPPER.includes(`${rawSymbol}ON`)) return `${rawSymbol}ON`;

  for (const item of NAME_HINTS) {
    if (item.hints.some((hint) => text.includes(upper(hint)))) return item.symbol;
  }

  return null;
}

function getXStockSymbol(tx) {
  const byContract = XSTOCK_BY_CONTRACT[cleanAddress(tx.contractAddress)];
  if (byContract) return byContract;
  return inferSymbolFromText(tx);
}

function isStablecoin(tx) {
  const byContract = STABLE_CONTRACTS[cleanAddress(tx.contractAddress)];
  if (byContract) return true;

  const symbol = upper(tx.tokenSymbol);
  const name = upper(tx.tokenName);
  const stablecoinUpper = STABLECOINS.map((s) => upper(s));
  return (
    stablecoinUpper.includes(symbol) ||
    symbol === "USDON" ||
    symbol === "BSC-USD" ||
    name.includes("BINANCE-PEG BSC-USD") ||
    name.includes("TETHER USD") ||
    name.includes("USD COIN")
  );
}

function stableAssetKey(tx) {
  const contract = cleanAddress(tx.contractAddress);
  if (contract) return contract;
  return upper(tx.tokenSymbol || tx.tokenName || "UNKNOWN_STABLE");
}

function txAmount(tx) {
  const explicitDecimal = tx.valueDecimal || tx.amountFormatted || tx.amount_decimal || tx.value_decimal;
  if (explicitDecimal !== undefined && explicitDecimal !== null && String(explicitDecimal).trim() !== "") {
    return safeNumber(explicitDecimal);
  }

  const raw = String(tx.value || "0").trim();
  const decimals = tx.tokenDecimal || 18;

  if (looksRawInteger(raw, decimals)) {
    return safeNumber(convertValue(raw, decimals));
  }

  return safeNumber(raw);
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

function sumByStableAsset(rows = []) {
  const map = new Map();
  for (const tx of rows) {
    const key = stableAssetKey(tx);
    map.set(key, safeNumber(map.get(key)) + txAmount(tx));
  }
  return map;
}

function netStableSpend(stableOutflows = [], stableInflows = []) {
  const outByAsset = sumByStableAsset(stableOutflows);
  const inByAsset = sumByStableAsset(stableInflows);
  let grossOut = 0;
  let refundIn = 0;
  let netOut = 0;

  for (const [key, outAmount] of outByAsset.entries()) {
    const matchedRefund = Math.min(outAmount, safeNumber(inByAsset.get(key)));
    grossOut += outAmount;
    refundIn += matchedRefund;
    netOut += Math.max(0, outAmount - matchedRefund);
  }

  return { grossOut, refundIn, netOut };
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

    const stableFlow = netStableSpend(stableOutflows, stableInflows);
    const stableInUsd = stableInflows.reduce((sum, tx) => sum + txAmount(tx), 0);

    // A standard swap should produce one xStock inflow. If a router emits more than one,
    // do not duplicate the entire net spend across every inflow. Allocate by received quantity
    // as a deterministic fallback and expose allocation metadata for audits.
    const totalXStockInQuantity = xstockInflows.reduce((sum, tx) => sum + Math.max(0, txAmount(tx)), 0);

    for (const xtx of xstockInflows) {
      const symbol = getXStockSymbol(xtx);
      const quantity = txAmount(xtx);
      const allocationRatio = xstockInflows.length <= 1 || totalXStockInQuantity <= 0
        ? 1
        : Math.max(0, quantity) / totalXStockInQuantity;
      const costUsd = stableFlow.netOut * allocationRatio;
      const type = costUsd > 0 ? "BUY" : "TRANSFER_IN";

      records.push({
        symbol,
        txHash: hash,
        quantity: safeNumber(quantity),
        costUsd: safeNumber(costUsd),
        grossStablecoinOutUsd: safeNumber(stableFlow.grossOut * allocationRatio),
        stablecoinRefundUsd: safeNumber(stableFlow.refundIn * allocationRatio),
        netStablecoinSpendUsd: safeNumber(costUsd),
        costCalculation: "same_tx_net_stablecoin_out_minus_matched_refund",
        allocationRatio,
        timestamp: xtx.timeStamp,
        tokenSymbol: xtx.tokenSymbol,
        tokenName: xtx.tokenName,
        contractAddress: cleanAddress(xtx.contractAddress),
        rawValue: xtx.value,
        valueDecimal: xtx.valueDecimal || null,
        tokenDecimal: xtx.tokenDecimal,
        stablecoinOutflowCount: stableOutflows.length,
        stablecoinInflowCount: stableInflows.length,
        xstockInflowCount: xstockInflows.length,
        xstockOutflowCount: xstockOutflows.length,
        type,
        officialHolding: type === "BUY",
        ...(type === "BUY" ? {} : { warning: `No net stablecoin spend found for hash ${hash} - excluded from official holdings and PnL` }),
      });
    }

    if (xstockOutflows.length > 0 && stableInUsd > 0) {
      const totalXStockOutQuantity = xstockOutflows.reduce((sum, tx) => sum + Math.max(0, txAmount(tx)), 0);
      for (const xtx of xstockOutflows) {
        const sellQty = safeNumber(txAmount(xtx));
        const allocationRatio = xstockOutflows.length <= 1 || totalXStockOutQuantity <= 0
          ? 1
          : Math.max(0, sellQty) / totalXStockOutQuantity;
        records.push({
          symbol: getXStockSymbol(xtx),
          txHash: hash,
          quantity: -sellQty,
          costUsd: -safeNumber(stableInUsd * allocationRatio),
          timestamp: xtx.timeStamp,
          tokenSymbol: xtx.tokenSymbol,
          tokenName: xtx.tokenName,
          contractAddress: cleanAddress(xtx.contractAddress),
          rawValue: xtx.value,
          valueDecimal: xtx.valueDecimal || null,
          tokenDecimal: xtx.tokenDecimal,
          stablecoinOutflowCount: stableOutflows.length,
          stablecoinInflowCount: stableInflows.length,
          xstockInflowCount: xstockInflows.length,
          type: "SELL",
          officialHolding: true,
          allocationRatio,
          warning: "Sell detected and subtracted from official holdings.",
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
    if (!symbol || !["BUY", "SELL"].includes(r.type)) continue;

    const quantity = safeNumber(r.quantity);
    const costUsd = safeNumber(r.costUsd);
    if (quantity === 0) continue;

    const existing = grouped.get(symbol) || {
      quantity: 0,
      totalCost: 0,
      buyCount: 0,
      sellCount: 0,
      firstBuyTimestamp: null,
      lastBuyTimestamp: null,
      lastSellTimestamp: null,
      grossStablecoinOutUsd: 0,
      stablecoinRefundUsd: 0,
    };

    if (r.type === "BUY") {
      if (quantity <= 0 || costUsd <= 0) continue;
      existing.quantity += quantity;
      existing.totalCost += costUsd;
      existing.grossStablecoinOutUsd += safeNumber(r.grossStablecoinOutUsd || costUsd);
      existing.stablecoinRefundUsd += safeNumber(r.stablecoinRefundUsd);
      existing.buyCount += 1;
      if (!existing.firstBuyTimestamp || Number(r.timestamp) < Number(existing.firstBuyTimestamp)) existing.firstBuyTimestamp = r.timestamp;
      if (!existing.lastBuyTimestamp || Number(r.timestamp) > Number(existing.lastBuyTimestamp)) existing.lastBuyTimestamp = r.timestamp;
    }

    if (r.type === "SELL") {
      const sellQty = Math.abs(quantity);
      if (sellQty <= 0 || existing.quantity <= 0) continue;
      const averageCost = existing.quantity > 0 ? existing.totalCost / existing.quantity : 0;
      const actualSellQty = Math.min(sellQty, existing.quantity);
      existing.quantity -= actualSellQty;
      existing.totalCost = Math.max(0, existing.totalCost - actualSellQty * averageCost);
      existing.sellCount += 1;
      existing.lastSellTimestamp = r.timestamp;
    }

    grouped.set(symbol, existing);
  }

  const holdings = [];
  for (const [symbol, v] of grouped.entries()) {
    if (v.quantity <= 0.00000001) continue;
    holdings.push({
      symbol,
      quantity: v.quantity,
      totalCost: v.totalCost,
      averageCost: v.quantity > 0 ? v.totalCost / v.quantity : 0,
      grossStablecoinOutUsd: v.grossStablecoinOutUsd,
      stablecoinRefundUsd: v.stablecoinRefundUsd,
      costCalculation: "net_stablecoin_spend_from_raw_transfers",
      buyCount: v.buyCount,
      sellCount: v.sellCount,
      firstBuyTimestamp: v.firstBuyTimestamp,
      lastBuyTimestamp: v.lastBuyTimestamp,
      lastSellTimestamp: v.lastSellTimestamp,
      officialHolding: true,
    });
  }

  return holdings.sort((a, b) => b.totalCost - a.totalCost);
}

module.exports = {
  buildBuyRecordsFromTransfers,
  calculateHoldings,
  getXStockSymbol,
  txAmount,
  netStableSpend,
};
