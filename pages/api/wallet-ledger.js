// DCA Discount Hunter V15.7 - Wallet Ledger / V17 Real Holdings Mirror
// Source priority: Moralis -> MegaNode -> Legacy fallback.
// Reconstructs cost basis from wallet-wide BEP-20 transfers, enriches positions with live Binance xStocks prices,
// and mirrors V17 real holdings by merging Binance exchange read-only holdings such as BTC.

const { fetchWalletTokenTransfers, hasMoralisKey, hasMegaNodeKey } = require("../../lib/xstocks/transfer-source");
const { buildBuyRecordsFromTransfers, calculateHoldings } = require("../../lib/xstocks/costBasis");
const { fetchTokenPrices } = require("../../lib/xstocks/prices");
const { WATCHLIST, STABLECOINS, toLower } = require("../../lib/xstocks/constants");
const { XSTOCK_CONTRACTS } = require("../../lib/xstocks/contracts");
const { getBinanceRestUrl, fetchBinanceExchangePositions, requiredEnv } = require("../../lib/v17/binance-exchange-provider");

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

function holdingValue(holding) {
  return safeNumber(holding?.currentValue || holding?.marketValue || holding?.positionValue || holding?.rawCurrentValue || 0);
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
      quantity,
      totalCost,
      marketPrice,
      tokenPrice: marketPrice,
      marketValue,
      currentValue: marketValue,
      positionValue: marketValue,
      unrealizedPnL,
      pnlPct: returnPct,
      returnPct,
      returnPctDisplay: returnPct * 100,
      priceSource: priceItem?.source || null,
      priceUpdated: new Date().toISOString(),
      rawTokenPrice: priceItem?.rawTokenPrice || null,
      sharesMultiplier: priceItem?.sharesMultiplier || null,
      ...(marketPrice > 0 ? {} : { priceWarning: `No live xStocks price found for ${symbol}` }),
    };
  });
}

function mergeHoldingsBySymbol(...groups) {
  const map = new Map();
  for (const group of groups || []) {
    for (const holding of group || []) {
      const symbol = upper(holding?.symbol);
      if (symbol && safeNumber(holding.quantity) > 0) map.set(symbol, { ...holding, symbol });
    }
  }
  return [...map.values()];
}

async function fetchBtcMarketPrice() {
  try {
    const baseUrl = getBinanceRestUrl();
    const response = await fetch(`${baseUrl}/api/v3/ticker/price?symbol=BTCUSDT`, { cache: "no-store" });
    const json = await response.json();
    return safeNumber(json?.price);
  } catch {
    return 0;
  }
}

async function fetchExchangeHoldings() {
  const env = requiredEnv();
  if (!env.configured) {
    return { ok: false, configured: false, holdings: [], diagnostics: { envConfigured: false } };
  }
  try {
    const btcPrice = await fetchBtcMarketPrice();
    const marketPrices = btcPrice > 0 ? { BTC: { price: btcPrice } } : {};
    const result = await fetchBinanceExchangePositions({ marketPrices });
    return { ...result, diagnostics: { envConfigured: true, btcMarketPrice: btcPrice } };
  } catch (error) {
    return { ok: false, configured: true, holdings: [], error: error.message || "binance_exchange_sync_failed" };
  }
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

    const [rawTransfers, exchangeData] = await Promise.all([
      fetchWalletTokenTransfers(walletAddress),
      fetchExchangeHoldings(),
    ]);

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

    const walletHoldings = enrichHoldingsWithMarket(baseHoldings, livePrices);
    const exchangeHoldings = Array.isArray(exchangeData?.holdings) ? exchangeData.holdings : [];
    const holdings = mergeHoldingsBySymbol(walletHoldings, exchangeHoldings);
    const onlyBuys = buyRecords.filter((r) => r.type === "BUY");
    const transferIns = buyRecords.filter((r) => r.type === "TRANSFER_IN");
    const totalCost = holdings.reduce((sum, h) => sum + safeNumber(h.totalCost), 0);
    const marketValue = holdings.reduce((sum, h) => sum + holdingValue(h), 0);
    const unrealizedPnL = marketValue - totalCost;
    const returnPct = totalCost > 0 ? unrealizedPnL / totalCost : 0;
    const priceSources = Array.from(new Set([...walletHoldings, ...exchangeHoldings].map((h) => h.priceSource || h.source).filter(Boolean))).sort();
    const now = new Date().toISOString();

    res.status(200).json({
      ok: true,
      version: "15.7-wallet-ledger-v17-real-holdings-mirror",
      walletAddress,
      updatedAt: now,
      checkedAt: now,
      lastSyncTime: now,
      source: "V17 real holdings mirror: wallet transfers + binance exchange read-only",
      configured: {
        moralis: hasMoralisKey(),
        megaNode: hasMegaNodeKey(),
        legacyBscScan: Boolean(process.env.BSCSCAN_API_KEY),
        binanceExchange: Boolean(exchangeData?.configured || exchangeData?.ok),
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
      walletHoldingCount: walletHoldings.length,
      exchangeHoldingCount: exchangeHoldings.length,
      priceCount: Object.keys(livePrices || {}).length,
      priceError,
      totalCost,
      marketValue,
      currentValue: marketValue,
      unrealizedPnL,
      returnPct,
      returnPctDisplay: returnPct * 100,
      actualTotalInvested: totalCost,
      portfolioTotalCost: totalCost,
      portfolioMarketValue: marketValue,
      portfolioUnrealizedPnL: unrealizedPnL,
      portfolioPnLPct: returnPct,
      priceSource: priceSources.join("、") || "wallet_and_exchange_live",
      referencePriceSource: "v17_real_holdings_mirror",
      mirrorOf: "pages/v17.js PortfolioSummaryCard walletSummary(totalValue)",
      binanceExchange: exchangeData,
      debugCounts: {
        totalTransfers: transfers.length,
        buyRecordsCount: buyRecords.length,
        holdingsCount: holdings.length,
        walletHoldingSymbols: walletHoldings.map((h) => h.symbol),
        exchangeHoldingSymbols: exchangeHoldings.map((h) => h.symbol),
        mergedHoldingSymbols: holdings.map((h) => h.symbol),
        tokenPriceSymbols: Object.keys(livePrices || {}).sort(),
        tokenPriceSources: priceSources,
      },
      holdings,
      walletHoldings,
      exchangeHoldings,
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
