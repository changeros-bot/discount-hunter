// DCA Discount Hunter V15.24 - Cost basis debug endpoint
// Debug-only API for inspecting transfer history -> buyRecords -> costHoldings.
// Focus: verify why latest buys such as SPCX second 5U are costed incorrectly.

const { fetchWalletTokenTransfers } = require("../../lib/xstocks/transfer-source");
const { buildBuyRecordsFromTransfers, calculateHoldings, getXStockSymbol, txAmount } = require("../../lib/xstocks/costBasis");
const { STABLECOINS, toLower } = require("../../lib/xstocks/constants");

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

function matchesSymbol(value, wanted) {
  if (!wanted) return true;
  const a = normalizeOnSymbol(value);
  const b = normalizeOnSymbol(wanted);
  return a === b || stripOn(a) === stripOn(b);
}

function normalizeTimestamp(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toISOString() : String(value);
}

function groupByHash(transfers) {
  const map = new Map();
  for (const tx of transfers || []) {
    const hash = String(tx.hash || "").trim();
    if (!hash) continue;
    const arr = map.get(hash) || [];
    arr.push(tx);
    map.set(hash, arr);
  }
  return map;
}

function isStablecoinDebug(tx) {
  const symbol = upper(tx.tokenSymbol);
  const name = upper(tx.tokenName);
  const stablecoinUpper = STABLECOINS.map((s) => upper(s));
  return stablecoinUpper.includes(symbol) || symbol === "USDON" || symbol === "BSC-USD" || name.includes("TETHER USD") || name.includes("USD COIN") || name.includes("BINANCE-PEG BSC-USD");
}

function summarizeTx(tx) {
  return {
    hash: tx.hash || tx.transactionHash || null,
    timestamp: normalizeTimestamp(tx.blockTimestamp || tx.timestamp || tx.timeStamp),
    inferredSymbol: normalizeOnSymbol(getXStockSymbol(tx)),
    tokenSymbol: tx.tokenSymbol || null,
    tokenName: tx.tokenName || null,
    contractAddress: cleanAddress(tx.contractAddress).toLowerCase(),
    from: cleanAddress(tx.from).toLowerCase(),
    to: cleanAddress(tx.to).toLowerCase(),
    value: tx.value || null,
    valueDecimal: tx.valueDecimal || null,
    tokenDecimal: tx.tokenDecimal || null,
    amount: txAmount(tx),
    isStablecoin: isStablecoinDebug(tx),
  };
}

async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");

  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const bodyWalletAddress = req.body && typeof req.body.walletAddress === "string" ? req.body.walletAddress.trim() : "";
    const queryWalletAddress = req.query && typeof req.query.address === "string" ? req.query.address.trim() : "";
    const envWalletAddress = process.env.WALLET_ADDRESS ? String(process.env.WALLET_ADDRESS).trim() : "";
    const walletAddress = cleanAddress(bodyWalletAddress || queryWalletAddress || envWalletAddress);
    const symbolFilter = req.query && typeof req.query.symbols === "string" ? String(req.query.symbols).split(",")[0] : "";

    if (!isEvmAddress(walletAddress)) {
      return res.status(400).json({ ok: false, error: "WALLET_ADDRESS not found or invalid" });
    }

    const myAddress = toLower(walletAddress);
    const rawTransfers = await fetchWalletTokenTransfers(walletAddress);
    const transfers = uniqueTransfers(rawTransfers);
    const buyRecords = buildBuyRecordsFromTransfers(transfers, walletAddress);
    const costHoldings = calculateHoldings(buyRecords);
    const groups = groupByHash(transfers);

    const filteredTransfers = transfers
      .map(summarizeTx)
      .filter((tx) => matchesSymbol(tx.inferredSymbol || tx.tokenSymbol, symbolFilter))
      .sort((a, b) => String(b.timestamp || "").localeCompare(String(a.timestamp || "")));

    const filteredBuyRecords = buyRecords
      .filter((r) => matchesSymbol(r.symbol, symbolFilter))
      .map((r) => ({
        symbol: normalizeOnSymbol(r.symbol),
        quantity: safeNumber(r.quantity),
        costUsd: safeNumber(r.costUsd),
        avgPrice: safeNumber(r.quantity) > 0 ? safeNumber(r.costUsd) / safeNumber(r.quantity) : 0,
        txHash: r.txHash || r.hash || null,
        timestamp: normalizeTimestamp(r.timestamp),
        stablecoinOutflowCount: r.stablecoinOutflowCount || 0,
        stablecoinInflowCount: r.stablecoinInflowCount || 0,
        xstockOutflowCount: r.xstockOutflowCount || 0,
        source: r.source || null,
        warning: r.warning || null,
      }))
      .sort((a, b) => String(b.timestamp || "").localeCompare(String(a.timestamp || "")));

    const relevantHashes = new Set(filteredBuyRecords.map((r) => r.txHash).filter(Boolean));
    const txGroups = [...relevantHashes].map((hash) => {
      const txs = groups.get(hash) || [];
      const stableOutflows = txs.filter((tx) => isStablecoinDebug(tx) && toLower(tx.from) === myAddress).map(summarizeTx);
      const stableInflows = txs.filter((tx) => isStablecoinDebug(tx) && toLower(tx.to) === myAddress).map(summarizeTx);
      const xstockInflows = txs.filter((tx) => getXStockSymbol(tx) && toLower(tx.to) === myAddress).map(summarizeTx);
      const xstockOutflows = txs.filter((tx) => getXStockSymbol(tx) && toLower(tx.from) === myAddress).map(summarizeTx);
      return {
        hash,
        timestamp: normalizeTimestamp(txs[0]?.blockTimestamp || txs[0]?.timestamp || txs[0]?.timeStamp),
        stableOutUsd: stableOutflows.reduce((sum, tx) => sum + safeNumber(tx.amount), 0),
        stableInUsd: stableInflows.reduce((sum, tx) => sum + safeNumber(tx.amount), 0),
        stableOutflowCount: stableOutflows.length,
        stableInflowCount: stableInflows.length,
        xstockInflowCount: xstockInflows.length,
        xstockOutflowCount: xstockOutflows.length,
        stableOutflows,
        stableInflows,
        xstockInflows,
        xstockOutflows,
      };
    }).sort((a, b) => String(b.timestamp || "").localeCompare(String(a.timestamp || "")));

    const filteredCostHoldings = costHoldings
      .filter((h) => matchesSymbol(h.symbol, symbolFilter))
      .map((h) => ({
        symbol: normalizeOnSymbol(h.symbol),
        quantity: safeNumber(h.quantity),
        totalCost: safeNumber(h.totalCost),
        averageCost: safeNumber(h.averageCost),
        buyCount: h.buyCount || 0,
        sellCount: h.sellCount || 0,
        firstBuyTimestamp: normalizeTimestamp(h.firstBuyTimestamp),
        lastBuyTimestamp: normalizeTimestamp(h.lastBuyTimestamp),
        lastSellTimestamp: normalizeTimestamp(h.lastSellTimestamp),
      }));

    return res.status(200).json({
      ok: true,
      version: "15.24-debug-cost-basis-groups",
      walletAddress: `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
      fullWalletAddress: walletAddress,
      checkedAt: new Date().toISOString(),
      symbolFilter: symbolFilter ? normalizeOnSymbol(symbolFilter) : "ALL",
      summary: {
        totalTransfers: transfers.length,
        matchedTransfers: filteredTransfers.length,
        totalBuyRecords: buyRecords.length,
        matchedBuyRecords: filteredBuyRecords.length,
        totalCostHoldings: costHoldings.length,
        matchedCostHoldings: filteredCostHoldings.length,
        matchedTotalCost: filteredCostHoldings.reduce((sum, h) => sum + safeNumber(h.totalCost), 0),
        matchedBuyCost: filteredBuyRecords.reduce((sum, r) => sum + safeNumber(r.costUsd), 0),
      },
      costHoldings: filteredCostHoldings,
      buyRecords: filteredBuyRecords,
      txGroups,
      transfers: filteredTransfers,
    });
  } catch (error) {
    console.error("debug-cost-basis error:", error);
    return res.status(500).json({ ok: false, error: error.message || "Unknown error" });
  }
}

module.exports = handler;
