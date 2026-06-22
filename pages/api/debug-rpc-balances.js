// DCA Discount Hunter V15.21 - RPC balance debug endpoint
// Debug-only API for inspecting per-contract BNB Chain balanceOf() results.
// Does not affect homepage holdings, buy point logic, Telegram alerts, or wallet sync.

const { fetchWalletTokenTransfers } = require("../../lib/xstocks/transfer-source");
const { getXStockSymbol } = require("../../lib/xstocks/costBasis");
const { fetchTokenPrices } = require("../../lib/xstocks/prices");
const { fetchWalletBalancesViaRpc } = require("../../lib/xstocks/rpcBalances");
const { WATCHLIST } = require("../../lib/xstocks/constants");

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

function buildContractHints(transfers) {
  const map = new Map();
  for (const tx of transfers || []) {
    const symbol = normalizeOnSymbol(getXStockSymbol(tx));
    const contractAddress = cleanAddress(tx.contractAddress).toLowerCase();
    if (!symbol || !isEvmAddress(contractAddress)) continue;
    const key = `${symbol}:${contractAddress}`;
    if (map.has(key)) continue;
    map.set(key, {
      symbol,
      contractAddress,
      decimals: Number(tx.tokenDecimal || 18) || 18,
      tokenSymbol: tx.tokenSymbol || null,
      tokenName: tx.tokenName || null,
      source: "moralis_transfer_contract_hint",
    });
  }
  return [...map.values()];
}

function normalizePriceMap(prices) {
  const map = {};
  for (const [key, value] of Object.entries(prices || {})) {
    const k = upper(key);
    map[k] = value;
    map[stripOn(k)] = value;
    if (!k.endsWith("ON")) map[`${k}ON`] = value;
  }
  return map;
}

function pickPrice(prices, symbol) {
  const map = normalizePriceMap(prices);
  const s = upper(symbol);
  return map[s] || map[stripOn(s)] || map[`${stripOn(s)}ON`] || null;
}

function buildHintMap(contractHints) {
  const map = new Map();
  for (const hint of contractHints || []) {
    if (!hint.contractAddress) continue;
    map.set(String(hint.contractAddress).toLowerCase(), hint);
  }
  return map;
}

async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");

  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const bodyWalletAddress = req.body && typeof req.body.walletAddress === "string" ? req.body.walletAddress.trim() : "";
    const queryWalletAddress = req.query && typeof req.query.address === "string" ? req.query.address.trim() : "";
    const envWalletAddress = process.env.WALLET_ADDRESS ? String(process.env.WALLET_ADDRESS).trim() : "";
    const walletAddress = cleanAddress(bodyWalletAddress || queryWalletAddress || envWalletAddress);

    if (!isEvmAddress(walletAddress)) {
      return res.status(400).json({ ok: false, error: "WALLET_ADDRESS not found or invalid" });
    }

    const querySymbols = req.query && typeof req.query.symbols === "string"
      ? String(req.query.symbols).split(",").map((s) => upper(s)).filter(Boolean)
      : [];
    const symbols = querySymbols.length > 0 ? querySymbols : WATCHLIST;

    const rawTransfers = await fetchWalletTokenTransfers(walletAddress);
    const transfers = uniqueTransfers(rawTransfers);
    const contractHints = buildContractHints(transfers);
    const hintMap = buildHintMap(contractHints);

    let liveBalanceResult = { holdings: [], contractHoldings: [], errors: [], tokenMetadata: [] };
    try {
      liveBalanceResult = await fetchWalletBalancesViaRpc(walletAddress, symbols, contractHints);
    } catch (error) {
      liveBalanceResult = { holdings: [], contractHoldings: [], errors: [error.message], tokenMetadata: [] };
    }

    const priceSymbols = Array.from(new Set([
      ...symbols.map(upper),
      ...(liveBalanceResult.contractHoldings || []).map((h) => upper(h.symbol)),
    ]));
    const tokenPrices = await fetchTokenPrices(priceSymbols);

    const details = (liveBalanceResult.contractHoldings || []).map((holding) => {
      const symbol = upper(holding.symbol);
      const contractAddress = String(holding.contractAddress || "").toLowerCase();
      const hint = hintMap.get(contractAddress) || {};
      const tokenPriceData = pickPrice(tokenPrices, symbol);
      const tokenPrice = safeNumber(tokenPriceData?.price);
      const quantity = safeNumber(holding.quantity);
      const estimatedValueUSD = quantity * tokenPrice;
      const matchedBy = holding.source === "moralis_transfer_contract_hint"
        ? "moralis_transfer_contract_hint"
        : holding.source === "binance_metadata_evm_primary"
          ? "binance_metadata"
          : holding.source || "unknown";

      return {
        symbol,
        contractAddress,
        rawBalance: holding.rawBalance || null,
        decimals: holding.decimals ?? null,
        quantity,
        tokenPrice,
        estimatedValueUSD,
        source: holding.source || null,
        tokenName: hint.tokenName || null,
        tokenSymbol: hint.tokenSymbol || null,
        matchedBy,
        isVerified: matchedBy === "binance_metadata",
        warning: matchedBy === "moralis_transfer_contract_hint" ? "Unverified Moralis transfer hint; inspect before using as holding source" : null,
      };
    }).sort((a, b) => {
      if (a.symbol !== b.symbol) return a.symbol.localeCompare(b.symbol);
      return safeNumber(b.estimatedValueUSD) - safeNumber(a.estimatedValueUSD);
    });

    const grouped = details.reduce((acc, item) => {
      if (!acc[item.symbol]) acc[item.symbol] = [];
      acc[item.symbol].push(item);
      return acc;
    }, {});

    return res.status(200).json({
      ok: true,
      version: "15.21-debug-rpc-balances",
      walletAddress: `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
      fullWalletAddress: walletAddress,
      checkedAt: new Date().toISOString(),
      symbols,
      summary: {
        transferCount: transfers.length,
        contractHintsCount: contractHints.length,
        tokenMetadataCount: liveBalanceResult.tokenMetadata?.length || 0,
        liveContractHoldingsCount: liveBalanceResult.contractHoldings?.length || 0,
        aggregatedHoldingsCount: liveBalanceResult.holdings?.length || 0,
        errors: liveBalanceResult.errors || [],
        checkedBlockNumber: liveBalanceResult.checkedBlockNumber || null,
      },
      details,
      grouped,
      tokenMetadata: liveBalanceResult.tokenMetadata || [],
    });
  } catch (error) {
    console.error("debug-rpc-balances error:", error);
    return res.status(500).json({ ok: false, error: error.message || "Unknown error" });
  }
}

module.exports = handler;
