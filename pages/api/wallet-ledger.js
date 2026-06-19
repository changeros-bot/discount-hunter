// DCA Discount Hunter V15.5 - Wallet Ledger
// Source priority: Moralis -> MegaNode -> Legacy fallback.
// Reconstructs cost basis from wallet-wide BEP-20 transfers.

const { fetchWalletTokenTransfers, hasMoralisKey, hasMegaNodeKey } = require("../../lib/xstocks/transfer-source");
const { buildBuyRecordsFromTransfers, calculateHoldings } = require("../../lib/xstocks/costBasis");
const { WATCHLIST, STABLECOINS, toLower } = require("../../lib/xstocks/constants");
const { XSTOCK_CONTRACTS } = require("../../lib/xstocks/contracts");

function isEvmAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value || ""));
}

function cleanAddress(value) {
  return String(value || "").trim();
}

function uniqueByHashContractDirection(transfers) {
  const seen = new Set();
  const out = [];
  for (const tx of transfers || []) {
    const key = [tx.hash, tx.contractAddress, tx.from, tx.to, tx.value].map((v) => String(v || "").toLowerCase()).join("|");
    if (!tx.hash || seen.has(key)) continue;
    seen.add(key);
    out.push(tx);
  }
  return out;
}

function buildTokenDebug(transfers) {
  const byContract = new Map();
  for (const tx of transfers || []) {
    const contract = toLower(tx.contractAddress);
    if (!contract) continue;
    const current = byContract.get(contract) || {
      contractAddress: contract,
      tokenSymbol: tx.tokenSymbol || "UNKNOWN",
      tokenName: tx.tokenName || "UNKNOWN",
      count: 0,
    };
    current.count += 1;
    if ((!current.tokenSymbol || current.tokenSymbol === "UNKNOWN") && tx.tokenSymbol) current.tokenSymbol = tx.tokenSymbol;
    if ((!current.tokenName || current.tokenName === "UNKNOWN") && tx.tokenName) current.tokenName = tx.tokenName;
    byContract.set(contract, current);
  }
  return Array.from(byContract.values()).sort((a, b) => b.count - a.count);
}

function buildTrackedTokens() {
  const known = Object.values(XSTOCK_CONTRACTS || {}).map((item) => ({
    symbol: item.symbol,
    ticker: item.ticker,
    contractAddress: item.contractAddress,
    decimals: item.decimals || 18,
    source: item.source || "static_mapping",
    found: true,
  }));

  const knownSymbols = new Set(known.map((item) => String(item.symbol || "").toUpperCase()));
  const pending = WATCHLIST
    .filter((symbol) => !knownSymbols.has(String(symbol || "").toUpperCase()))
    .map((symbol) => ({
      symbol,
      contractAddress: null,
      decimals: 18,
      source: "symbol_match_from_transfer_history",
      found: false,
    }));

  return [...known, ...pending];
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  try {
    const walletAddress = cleanAddress(req.query.address || process.env.WALLET_ADDRESS || "");
    if (!isEvmAddress(walletAddress)) {
      return res.status(400).json({
        ok: false,
        error: "invalid_wallet_address",
        message: "請輸入 0x 開頭的 EVM wallet address，或設定 WALLET_ADDRESS。",
      });
    }

    const rawTransfers = await fetchWalletTokenTransfers(walletAddress);
    const transfers = uniqueByHashContractDirection(rawTransfers);
    const buyRecords = buildBuyRecordsFromTransfers(transfers, walletAddress);
    const holdings = calculateHoldings(buyRecords);

    const onlyBuys = buyRecords.filter((r) => r.type === "BUY");
    const transferIns = buyRecords.filter((r) => r.type === "TRANSFER_IN");

    res.status(200).json({
      ok: true,
      version: "15.5-wallet-ledger-moralis-source",
      walletAddress,
      updatedAt: new Date().toISOString(),
      source: hasMoralisKey() ? "Moralis wallet token transfers" : hasMegaNodeKey() ? "MegaNode / NodeReal wallet transfers" : "Legacy fallback",
      configured: {
        moralis: hasMoralisKey(),
        megaNode: hasMegaNodeKey(),
        legacyBscScan: Boolean(process.env.BSCSCAN_API_KEY),
      },
      watchlist: WATCHLIST,
      stablecoins: STABLECOINS,
      trackedTokens: buildTrackedTokens(),
      transferCount: transfers.length,
      tokenDebug: buildTokenDebug(transfers),
      buyRecordCount: buyRecords.length,
      buyCount: onlyBuys.length,
      transferInCount: transferIns.length,
      holdingCount: holdings.length,
      totalCost: holdings.reduce((sum, h) => sum + Number(h.totalCost || 0), 0),
      holdings,
      buyRecords,
      sampleTransfers: transfers.slice(0, Number(req.query.sample || 20)),
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: "wallet_ledger_failed",
      message: error.message,
      configured: {
        moralis: hasMoralisKey(),
        megaNode: hasMegaNodeKey(),
        legacyBscScan: Boolean(process.env.BSCSCAN_API_KEY),
      },
    });
  }
}
