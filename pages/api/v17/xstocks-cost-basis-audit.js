const { hasMegaNodeKey } = require("../../../lib/xstocks/transfer-source");
const { fetchMoralisTokenTransfers, hasMoralisKey } = require("../../../lib/xstocks/moralis");
const { fetchMegaNodeTransfers } = require("../../../lib/xstocks/meganode");
const { fetchBscScanTokenTransfers, hasBscScanKey } = require("../../../lib/xstocks/bscscan");
const { fetchWalletBalancesViaRpc } = require("../../../lib/xstocks/rpcBalances");
const { buildBuyRecordsFromTransfers, calculateHoldings, getXStockSymbol, txAmount } = require("../../../lib/xstocks/costBasis");
const { WATCHLIST, STABLECOINS, toLower } = require("../../../lib/xstocks/constants");

function cleanAddress(value) { return String(value || "").trim(); }
function isEvmAddress(value) { return /^0x[a-fA-F0-9]{40}$/.test(cleanAddress(value)); }
function maskAddress(address) { const a = cleanAddress(address); return a ? `${a.slice(0, 6)}...${a.slice(-4)}` : ""; }
function upper(value) { return String(value || "").trim().toUpperCase(); }
function safeNumber(value) { const n = Number(value || 0); return Number.isFinite(n) ? n : 0; }
function normalizeSymbol(symbol) { const s = upper(symbol); return s.endsWith("ON") ? s : `${s}ON`; }

const STABLE_SYMBOLS = new Set([...STABLECOINS, "USDT", "USDC", "BUSD", "BSC-USD", "USDON", "USDon"].map(upper));
function isStablecoinLike(tx) {
  const symbol = upper(tx.tokenSymbol);
  const name = upper(tx.tokenName);
  return STABLE_SYMBOLS.has(symbol) || name.includes("TETHER") || name.includes("USD COIN") || name.includes("BINANCE-PEG BSC-USD");
}
function groupByHash(transfers) {
  const map = new Map();
  for (const tx of transfers || []) {
    const hash = String(tx.hash || "").trim();
    if (!hash) continue;
    const list = map.get(hash) || [];
    list.push(tx);
    map.set(hash, list);
  }
  return map;
}
function summarizeTransfers(transfers, walletAddress) {
  const my = toLower(walletAddress);
  const byHash = groupByHash(transfers);
  const sample = [];
  let xstockTransferCount = 0;
  let stableTransferCount = 0;
  let possibleBuyHashCount = 0;
  let xstockInWithoutStableOutCount = 0;
  let stableOutWithoutXstockInCount = 0;
  for (const [hash, txs] of byHash.entries()) {
    const xIn = txs.filter((tx) => getXStockSymbol(tx) && toLower(tx.to) === my);
    const xOut = txs.filter((tx) => getXStockSymbol(tx) && toLower(tx.from) === my);
    const stableOut = txs.filter((tx) => isStablecoinLike(tx) && toLower(tx.from) === my);
    const stableIn = txs.filter((tx) => isStablecoinLike(tx) && toLower(tx.to) === my);
    xstockTransferCount += xIn.length + xOut.length;
    stableTransferCount += stableOut.length + stableIn.length;
    if (xIn.length > 0 && stableOut.length > 0) possibleBuyHashCount += 1;
    if (xIn.length > 0 && stableOut.length === 0) xstockInWithoutStableOutCount += 1;
    if (stableOut.length > 0 && xIn.length === 0) stableOutWithoutXstockInCount += 1;
    if (sample.length < 20 && (xIn.length || xOut.length || stableOut.length || stableIn.length)) {
      sample.push({
        hash,
        xstockInflows: xIn.map((tx) => ({ symbol: getXStockSymbol(tx), amount: txAmount(tx), contractAddress: tx.contractAddress, tokenSymbol: tx.tokenSymbol, tokenName: tx.tokenName })),
        xstockOutflows: xOut.map((tx) => ({ symbol: getXStockSymbol(tx), amount: txAmount(tx), contractAddress: tx.contractAddress, tokenSymbol: tx.tokenSymbol, tokenName: tx.tokenName })),
        stableOutflows: stableOut.map((tx) => ({ tokenSymbol: tx.tokenSymbol, tokenName: tx.tokenName, amount: txAmount(tx), contractAddress: tx.contractAddress })),
        stableInflows: stableIn.map((tx) => ({ tokenSymbol: tx.tokenSymbol, tokenName: tx.tokenName, amount: txAmount(tx), contractAddress: tx.contractAddress })),
        diagnosis: xIn.length && stableOut.length ? "BUY_PATTERN_FOUND" : xIn.length ? "XSTOCK_IN_WITHOUT_STABLE_OUT" : stableOut.length ? "STABLE_OUT_WITHOUT_XSTOCK_IN" : "OTHER"
      });
    }
  }
  return { uniqueHashCount: byHash.size, xstockTransferCount, stableTransferCount, possibleBuyHashCount, xstockInWithoutStableOutCount, stableOutWithoutXstockInCount, sample };
}
function normalizeHoldingMap(holdings) {
  const map = new Map();
  for (const h of holdings || []) map.set(normalizeSymbol(h.symbol), h);
  return map;
}
async function runTransferSourceDiagnostics(walletAddress) {
  const sources = [
    { name: "Moralis", configured: hasMoralisKey(), fetcher: fetchMoralisTokenTransfers },
    { name: "MegaNode / NodeReal", configured: hasMegaNodeKey(), fetcher: fetchMegaNodeTransfers },
    { name: "BscScan / Etherscan V2", configured: hasBscScanKey(), fetcher: fetchBscScanTokenTransfers },
  ];
  const results = [];
  let selected = [];
  let selectedSource = "none";
  for (const source of sources) {
    if (!source.configured) {
      results.push({ name: source.name, configured: false, status: "OFF", transferCount: 0, error: null });
      continue;
    }
    try {
      const rows = await source.fetcher(walletAddress);
      const transferCount = Array.isArray(rows) ? rows.length : 0;
      const status = transferCount > 0 ? "PASS" : "ZERO";
      results.push({ name: source.name, configured: true, status, transferCount, error: null });
      if (selected.length === 0 && transferCount > 0) {
        selected = rows;
        selectedSource = source.name;
      }
    } catch (error) {
      results.push({ name: source.name, configured: true, status: "ERROR", transferCount: 0, error: error.message || String(error) });
    }
  }
  return { transfers: selected, selectedSource, sourceDiagnostics: results };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }
  const walletAddress = cleanAddress(process.env.WALLET_ADDRESS);
  const base = {
    ok: true,
    checkedAt: new Date().toISOString(),
    walletAddress: maskAddress(walletAddress),
    walletConfigured: isEvmAddress(walletAddress),
    moralisConfigured: hasMoralisKey(),
    megaNodeConfigured: hasMegaNodeKey(),
    bscScanConfigured: hasBscScanKey(),
    watchlist: WATCHLIST,
    policy: { xstocksQuantitySource: "BSC balanceOf", transferSourcePriority: "Moralis -> MegaNode / NodeReal -> BscScan / Etherscan V2", costBasisRule: "stablecoin OUT + xStock IN in same tx hash = BUY", noEstimatedCost: true, noFallbackCost: true }
  };
  if (!isEvmAddress(walletAddress)) return res.status(200).json({ ...base, status: "NO_WALLET_ADDRESS", message: "WALLET_ADDRESS missing or invalid." });

  let transfers = [];
  let transferError = null;
  let selectedSource = "none";
  let sourceDiagnostics = [];
  try {
    const result = await runTransferSourceDiagnostics(walletAddress);
    transfers = result.transfers;
    selectedSource = result.selectedSource;
    sourceDiagnostics = result.sourceDiagnostics;
  } catch (error) {
    transferError = error.message;
  }

  let liveBalanceResult = { holdings: [], errors: [] };
  try { liveBalanceResult = await fetchWalletBalancesViaRpc(walletAddress, WATCHLIST, []); } catch (error) { liveBalanceResult = { holdings: [], errors: [error.message] }; }

  const buyRecords = buildBuyRecordsFromTransfers(transfers || [], walletAddress);
  const officialBuyRecords = buyRecords.filter((r) => r.type === "BUY");
  const transferInRecords = buyRecords.filter((r) => r.type === "TRANSFER_IN");
  const sellRecords = buyRecords.filter((r) => r.type === "SELL");
  const costHoldings = calculateHoldings(buyRecords);
  const costMap = normalizeHoldingMap(costHoldings);
  const liveHoldings = (liveBalanceResult.holdings || []).filter((h) => safeNumber(h.quantity) > 0).map((h) => {
    const symbol = normalizeSymbol(h.symbol);
    const cost = costMap.get(symbol);
    return { symbol, quantity: safeNumber(h.quantity), contractAddress: h.contractAddress || null, balanceSource: h.source || null, costStatus: cost?.totalCost > 0 ? "PASS" : "MISSING", totalCost: safeNumber(cost?.totalCost), buyCount: safeNumber(cost?.buyCount), sellCount: safeNumber(cost?.sellCount) };
  });

  const transferSummary = summarizeTransfers(transfers || [], walletAddress);
  let status = "CHECK";
  let diagnosis = "";
  if (transferError) { status = "TRANSFER_FETCH_ERROR"; diagnosis = "Transfer API threw an error before returning data."; }
  else if (!transfers.length) { status = "TRANSFER_API_RETURNED_ZERO"; diagnosis = "All configured transfer sources returned 0 or no usable ERC20 transfers for this wallet, so cost basis cannot be reconstructed."; }
  else if (officialBuyRecords.length === 0 && transferInRecords.length > 0) { status = "ONLY_TRANSFER_IN_NO_BUY_PATTERN"; diagnosis = "xStock inflows exist, but no same-hash stablecoin outflow was found. These are transfer-ins, not buys under the current cost rule."; }
  else if (officialBuyRecords.length === 0 && transferSummary.xstockTransferCount === 0) { status = "TRANSFERS_FOUND_BUT_NO_XSTOCK_MATCH"; diagnosis = "Transfers exist, but none match known xStock contracts/symbols. Contract registry or symbol mapping may be wrong."; }
  else if (officialBuyRecords.length === 0) { status = "NO_BUY_RECORDS"; diagnosis = "Transfers exist, but no BUY pattern was found."; }
  else if (liveHoldings.some((h) => h.costStatus === "MISSING")) { status = "PARTIAL_COST_BASIS"; diagnosis = "Some xStocks have cost basis, but some live holdings still lack cost."; }
  else { status = "PASS"; diagnosis = "Live xStocks and transfer-history cost basis are both available."; }

  return res.status(200).json({ ...base, status, diagnosis, transferError, transferSourceUsed: selectedSource, sourceDiagnostics, transferCount: transfers.length, transferSummary, buyRecordCount: buyRecords.length, officialBuyRecordCount: officialBuyRecords.length, transferInRecordCount: transferInRecords.length, sellRecordCount: sellRecords.length, costHoldingCount: costHoldings.length, liveBalanceCount: liveHoldings.length, liveBalanceErrors: liveBalanceResult.errors || [], liveHoldings, costHoldings, sampleBuyRecords: buyRecords.slice(0, 20).map((r) => ({ symbol: r.symbol, type: r.type, quantity: r.quantity, costUsd: r.costUsd, txHash: r.txHash, stablecoinOutflowCount: r.stablecoinOutflowCount, warning: r.warning || null })) });
}
