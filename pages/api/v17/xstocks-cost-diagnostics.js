const { fetchWalletTokenTransfers, hasMoralisKey, hasMegaNodeKey, hasBscScanKey } = require("../../../lib/xstocks/transfer-source");
const { buildBuyRecordsFromTransfers, getXStockSymbol, txAmount } = require("../../../lib/xstocks/costBasis");
const { WATCHLIST, STABLECOINS, toLower } = require("../../../lib/xstocks/constants");

const STABLE_SET = new Set(STABLECOINS.map((s) => String(s).toUpperCase()).concat(["USDON", "BSC-USD"]));

function cleanAddress(value) { return String(value || "").trim(); }
function isEvmAddress(value) { return /^0x[a-fA-F0-9]{40}$/.test(cleanAddress(value)); }
function upper(value) { return String(value || "").trim().toUpperCase(); }
function isStable(tx) {
  const sym = upper(tx.tokenSymbol);
  const name = upper(tx.tokenName);
  const addr = String(tx.contractAddress || "").toLowerCase();
  return STABLE_SET.has(sym) || name.includes("TETHER") || name.includes("USD COIN") || name.includes("BSC-USD") || addr === "0x55d398326f99059ff775485246999027b3197955" || addr === "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d" || addr === "0xe9e7cea3dedca5984780bafc599bd69add087d56";
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
function groupByHash(transfers) {
  const groups = new Map();
  for (const tx of transfers || []) {
    const hash = String(tx.hash || "").trim();
    if (!hash) continue;
    const arr = groups.get(hash) || [];
    arr.push(tx);
    groups.set(hash, arr);
  }
  return groups;
}
function summarizeHash(hash, txs, walletAddress) {
  const my = toLower(walletAddress);
  const stableOutflows = txs.filter((tx) => isStable(tx) && toLower(tx.from) === my);
  const stableInflows = txs.filter((tx) => isStable(tx) && toLower(tx.to) === my);
  const xstockInflows = txs.filter((tx) => getXStockSymbol(tx) && toLower(tx.to) === my);
  const xstockOutflows = txs.filter((tx) => getXStockSymbol(tx) && toLower(tx.from) === my);
  const stableOutUsd = stableOutflows.reduce((s, tx) => s + Number(txAmount(tx) || 0), 0);
  return {
    hash,
    blockNumber: txs.map((tx) => Number(tx.blockNumber || 0)).filter(Boolean).sort((a, b) => a - b)[0] || null,
    stableOutUsd,
    stableOutflows: stableOutflows.map(formatTransfer),
    stableInflows: stableInflows.map(formatTransfer),
    xstockInflows: xstockInflows.map(formatTransfer),
    xstockOutflows: xstockOutflows.map(formatTransfer),
    buyCandidate: stableOutUsd > 0 && xstockInflows.length > 0,
    missingCostReason: stableOutUsd > 0 && xstockInflows.length > 0 ? null : "same_tx_stablecoin_out_not_found",
  };
}
function formatTransfer(tx) {
  return {
    symbol: upper(getXStockSymbol(tx) || tx.tokenSymbol),
    tokenSymbol: tx.tokenSymbol || null,
    tokenName: tx.tokenName || null,
    amount: Number(txAmount(tx) || 0),
    from: tx.from || null,
    to: tx.to || null,
    contractAddress: tx.contractAddress || null,
    blockNumber: tx.blockNumber || null,
  };
}

async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  try {
    const bodyWalletAddress = req.body && typeof req.body.walletAddress === "string" ? req.body.walletAddress.trim() : "";
    const queryWalletAddress = req.query && typeof req.query.address === "string" ? req.query.address.trim() : "";
    const envWalletAddress = process.env.WALLET_ADDRESS ? String(process.env.WALLET_ADDRESS).trim() : "";
    const walletAddress = cleanAddress(bodyWalletAddress || queryWalletAddress || envWalletAddress);
    if (!isEvmAddress(walletAddress)) return res.status(400).json({ ok: false, error: "WALLET_ADDRESS not found or invalid" });

    const rawTransfers = await fetchWalletTokenTransfers(walletAddress);
    const transfers = uniqueTransfers(rawTransfers);
    const records = buildBuyRecordsFromTransfers(transfers, walletAddress);
    const groups = groupByHash(transfers);
    const hashDiagnostics = [...groups.entries()].map(([hash, txs]) => summarizeHash(hash, txs, walletAddress));

    const bySymbol = WATCHLIST.map((symbol) => {
      const s = upper(symbol);
      const symbolRecords = records.filter((r) => upper(r.symbol) === s);
      const buys = symbolRecords.filter((r) => r.type === "BUY");
      const transferIns = symbolRecords.filter((r) => r.type === "TRANSFER_IN");
      const relatedHashes = new Set(symbolRecords.map((r) => r.txHash));
      const txs = hashDiagnostics.filter((h) => relatedHashes.has(h.hash));
      return {
        symbol: s,
        buyCount: buys.length,
        transferInCount: transferIns.length,
        chainCostUsd: buys.reduce((sum, r) => sum + Number(r.costUsd || 0), 0),
        chainQuantity: buys.reduce((sum, r) => sum + Number(r.quantity || 0), 0),
        transferInQuantity: transferIns.reduce((sum, r) => sum + Number(r.quantity || 0), 0),
        costStatus: buys.length > 0 ? "CHAIN_COST_FOUND" : transferIns.length > 0 ? "TRANSFER_IN_ONLY_NO_COST" : "NO_TRANSFER_FOUND",
        txs,
      };
    });

    return res.status(200).json({
      ok: true,
      walletAddress: `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
      fullWalletAddress: walletAddress,
      configured: { moralis: hasMoralisKey(), megaNode: hasMegaNodeKey(), bscscan: hasBscScanKey() },
      counts: {
        rawTransfers: rawTransfers.length,
        uniqueTransfers: transfers.length,
        records: records.length,
        buyRecords: records.filter((r) => r.type === "BUY").length,
        transferInRecords: records.filter((r) => r.type === "TRANSFER_IN").length,
        hashes: hashDiagnostics.length,
      },
      bySymbol,
      recentRelevantHashes: hashDiagnostics.filter((h) => h.xstockInflows.length || h.xstockOutflows.length || h.stableOutflows.length || h.stableInflows.length).slice(-40),
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "Unknown error", configured: { moralis: hasMoralisKey(), megaNode: hasMegaNodeKey(), bscscan: hasBscScanKey() } });
  }
}

module.exports = handler;
