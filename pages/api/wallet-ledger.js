// DCA Discount Hunter V15.6 - Wallet Ledger
// Source priority: Moralis -> MegaNode -> Legacy fallback.
// Reconstructs cost basis from wallet-wide BEP-20 transfers and enriches positions with live Binance xStocks prices.

const { fetchWalletTokenTransfers, hasMoralisKey, hasMegaNodeKey } = require("../../lib/xstocks/transfer-source");
const { buildBuyRecordsFromTransfers, calculateHoldings } = require("../../lib/xstocks/costBasis");
const { fetchTokenPrices } = require("../../lib/xstocks/prices");
const { WATCHLIST, STABLECOINS, toLower } = require("../../lib/xstocks/constants");
const { XSTOCK_CONTRACTS } = require("../../lib/xstocks/contracts");

function isEvmAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value || ""));
}

function cleanAddress(value) {
  return String(value || "").trim();
}

function upper(value) {
  return String(value || "").trim().toUpperCase();
}

function safeNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
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

  const knownSymbols = new Set(known.map((item) => upper(item.symbol)));
  const pending = WATCHLIST
    .filter((symbol) => !knownSymbols.has(upper(symbol)))
    .map((symbol) => ({
      symbol,
      contractAddress: null,
      decimals: 18,
      source: "symbol_match_from_transfer_history",
      found: false,
    }));

  return [...known, ...pending];
}

function normalizePriceSymbol(symbol) {
  return upper(symbol);
}

function enrichHoldingsWithMarket(holdings, prices) {
  return (holdings || []).map((holding) => {
    const symbol = normalizePriceSymbol(holding.symbol);
    const priceItem = prices?.[symbol] || prices?.[holding.symbol] || null;
    const marketPrice = safeNumber(priceItem?.price);
    const quantity = safeNumber(holding.quantity);
    const totalCost = safeNumber(holding.totalCost);
    const marketValue = quantity * marketPrice;
    const unrealizedPnL = marketValue - totalCost;
    const returnPct = totalCost > 0 ? unrealizedPnL / totalCost : 0;

    return {
      ...holding,
      symbol,
      marketPrice,
      marketValue,
      currentValue: marketValue,
      positionValue: marketValue,
      unrealizedPnL,
      returnPct,
      returnPctDisplay: returnPct * 100,
      priceSource: priceItem?.source || null,
      priceUpdated: new Date().toISOString(),
      rawTokenPrice: priceItem?.rawTokenPrice || null,
      sharesMultiplier: priceItem?.sharesMultiplier || null,
    };
  });
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
    const baseHoldings = calculateHoldings(buyRecords);
    const priceSymbols = Array.from(new Set(baseHoldings.map((h) => normalizePriceSymbol(h.symbol)).filter(Boolean)));

    let priceError = null;
    let livePrices = {};
    try {
      livePrices = await fetchTokenPrices(priceSymbols);
    } catch (error) {
      priceError = error.message;
    }

    const holdings = enrichHoldingsWithMarket(baseHoldings, livePrices);
    const onlyBuys = buyRecords.filter((r) => r.type === "BUY");
    const transferIns = buyRecords.filter((r) => r.type === "TRANSFER_IN");
    const totalCost = holdings.reduce((sum, h) => sum + safeNumber(h.totalCost), 0);
    const marketValue = holdings.reduce((sum, h) => sum + safeNumber(h.marketValue), 0);
    const unrealizedPnL = marketValue - totalCost;
    const returnPct = totalCost > 0 ? unrealizedPnL / totalCost : 0;

    res.status(200).json({
      ok: true,
      version: "15.6-wallet-ledger-market-pnl",
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
      priceCount: Object.keys(livePrices || {}).length,
      priceError,
      totalCost,
      marketValue,
      currentValue: marketValue,
      unrealizedPnL,
      returnPct,
      returnPctDisplay: returnPct * 100,
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
