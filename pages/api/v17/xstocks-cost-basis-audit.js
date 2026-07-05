const { fetchWalletTokenTransfers, hasMoralisKey, hasMegaNodeKey, hasBscScanKey, scoreTransfers } = require("../../../lib/xstocks/transfer-source");
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
  for (const [hash, txs] of byHash.entries()) {
    const xIn = txs.filter((tx) => getXStockSymbol(tx) && toLower(tx.to) === my);
    const xOut = txs.filter((tx) => getXStockSymbol(tx) && toLower(tx.from) === my);
    const stableOut = txs.filter((tx) => isStablecoinLike(tx) && toLower(tx.from) === my);
    const stableIn = txs.filter((tx) => isStablecoinLike(tx) && toLower(tx.to) === my);
    xstockTransferCount += xIn.length + xOut.length;
    stableTransferCount += stableOut.length + stableIn.length;
    if (xIn.length > 0 && stableOut.length > 0) possibleBuyHashCount += 1;
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
  return { uniqueHashCount: byHash.size, xstockTransferCount, stableTransferCount, possibleBuyHashCount, sample };
}
function normalizeHoldingMap(holdings) {
  const map = new Map();
  for (const h of holdings || []) map.set(normalizeSymbol(h.symbol), h);
  return map;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ ok: false, message: "Method not allowed" });

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
    policy: {
      xstocksQuantitySource: "BSC balanceOf",
      transferSourcePriority: "Unified source: prefer provider that produces BUY cost basis",
      costBasisRule: "stablecoin OUT + xStock IN in same tx hash = BUY",
      noEstimatedCost: true,
      noFallbackCost: true
    }
  };
  if (!isEvmAddress(walletAddress)) return res.status(200).json({ ...base, status: "NO_WALLET_ADDRESS", diagnosis: "WALLET_ADDRESS missing or invalid." });

  let transfers = [];
  let transferError = null;
  try { transfers = await fetchWalletTokenTransfers(walletAddress); } catch (error) { transferError = error.message || String(error); }

  let liveBalanceResult = { holdings: [], errors: [] };
  try { liveBalanceResult = await fetchWalletBalancesViaRpc(walletAddress, WATCHLIST, []); } catch (error) { liveBalanceResult = { holdings: [], errors: [error.message] }; }

  const score = scoreTransfers(transfers || [], walletAddress);
  const buyRecords = buildBuyRecordsFromTransfers(transfers || [], walletAddress);
  const officialBuyRecords = buyRecords.filter((r) => r.type === "BUY");
  const transferInRecords = buyRecords.filter((r) => r.type === "TRANSFER_IN");
  const sellRecords = buyRecords.filter((r) => r.type === "SELL");
  const costHoldings = calculateHoldings(buyRecords);
  const costMap = normalizeHoldingMap(costHoldings);
  const liveHoldings = (liveBalanceResult.holdings || []).filter((h) => safeNumber(h.quantity) > 0).map((h) => {
    const symbol = normalizeSymbol(h.symbol);
    const cost = costMap.get(symbol);
    return {
      symbol,
      quantity: safeNumber(h.quantity),
      contractAddress: h.contractAddress || null,
      balanceSource: h.source || null,
      costStatus: cost?.totalCost > 0 ? "PASS" : "MISSING",
      totalCost: safeNumber(cost?.totalCost),
      buyCount: safeNumber(cost?.buyCount),
      sellCount: safeNumber(cost?.sellCount)
    };
  });
  const transferSummary = summarizeTransfers(transfers || [], walletAddress);

  let status = "CHECK";
  let diagnosis = "";
  if (transferError) { status = "TRANSFER_FETCH_ERROR"; diagnosis = transferError; }
  else if (!transfers.length) { status = "TRANSFER_API_RETURNED_ZERO"; diagnosis = "Unified transfer source returned zero transfers."; }
  else if (officialBuyRecords.length === 0 && transferInRecords.length > 0) { status = "ONLY_TRANSFER_IN_NO_BUY_PATTERN"; diagnosis = "xStock inflows exist, but no same-hash stablecoin outflow was found."; }
  else if (officialBuyRecords.length === 0) { status = "NO_BUY_RECORDS"; diagnosis = "Transfers exist, but no BUY pattern was found."; }
  else if (liveHoldings.some((h) => h.costStatus === "MISSING")) { status = "PARTIAL_COST_BASIS"; diagnosis = "Some live xStocks still lack cost basis."; }
  else { status = "PASS"; diagnosis = "Live xStocks and transfer-history cost basis are both available."; }

  return res.status(200).json({
    ...base,
    status,
    diagnosis,
    transferError,
    transferSourceUsed: "unified_fetchWalletTokenTransfers",
    sourceDiagnostics: [{ name: "Unified transfer source", configured: true, status: score.usableForCostBasis ? "PASS" : transfers.length ? "NO_BUY_COST" : "ZERO", transferCount: transfers.length, error: null, score }],
    transferCount: transfers.length,
    transferSummary,
    buyRecordCount: buyRecords.length,
    officialBuyRecordCount: officialBuyRecords.length,
    transferInRecordCount: transferInRecords.length,
    sellRecordCount: sellRecords.length,
    costHoldingCount: costHoldings.length,
    liveBalanceCount: liveHoldings.length,
    liveBalanceErrors: liveBalanceResult.errors || [],
    liveHoldings,
    costHoldings,
    sampleBuyRecords: buyRecords.slice(0, 20).map((r) => ({ symbol: r.symbol, type: r.type, quantity: r.quantity, costUsd: r.costUsd, txHash: r.txHash, stablecoinOutflowCount: r.stablecoinOutflowCount, warning: r.warning || null }))
  });
}
