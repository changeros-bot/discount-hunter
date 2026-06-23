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

async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");

  try {
    const queryWalletAddress = req.query && typeof req.query.address === "string" ? req.query.address.trim() : "";
    const envWalletAddress = process.env.WALLET_ADDRESS ? String(process.env.WALLET_ADDRESS).trim() : "";
    const walletAddress = cleanAddress(queryWalletAddress || envWalletAddress);

    if (!isEvmAddress(walletAddress)) {
      return res.status(400).json({ ok: false, error: "WALLET_ADDRESS not found or invalid" });
    }

    const symbols = Array.from(new Set(["AMDON", "AMD", ...(WATCHLIST || [])]));
    const result = await fetchWalletBalancesViaRpc(walletAddress, symbols, []);
    const amdContractHoldings = (result.contractHoldings || []).filter((h) => upper(h.symbol) === "AMDON" || upper(h.symbol) === "AMD");
    const amdAggregatedHoldings = (result.holdings || []).filter((h) => upper(h.symbol) === "AMDON" || upper(h.symbol) === "AMD");
    const amdMetadata = (result.tokenMetadata || []).filter((t) => upper(t.symbol) === "AMDON" || upper(t.symbol) === "AMD");

    return res.status(200).json({
      ok: true,
      version: "debug-rpc-amd-v1",
      checkedAt: new Date().toISOString(),
      walletAddress: `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
      fullWalletAddress: walletAddress,
      symbols,
      checkedBlockNumber: result.checkedBlockNumber || null,
      errors: result.errors || [],
      liveBalanceSymbols: (result.holdings || []).map((h) => upper(h.symbol)),
      tokenMetadataSymbols: (result.tokenMetadata || []).map((t) => upper(t.symbol)),
      amdInTokenMetadata: amdMetadata.length > 0,
      amdInContractHoldings: amdContractHoldings.length > 0,
      amdInAggregatedHoldings: amdAggregatedHoldings.length > 0,
      amdMetadata,
      amdContractHoldings,
      amdAggregatedHoldings,
      contractHoldings: result.contractHoldings || [],
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || "Unknown debug-rpc-amd error",
    });
  }
}

module.exports = handler;
