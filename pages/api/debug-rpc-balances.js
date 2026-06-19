const { WATCHLIST } = require("../../lib/xstocks/constants");
const { fetchTokenMetadata } = require("../../lib/xstocks/prices");
const { fetchWalletBalancesViaRpc } = require("../../lib/xstocks/rpcBalances");

function norm(value) {
  return String(value || "").trim();
}

function summarizeRaw(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    keys: Object.keys(raw),
    symbol: raw.symbol,
    ticker: raw.ticker,
    chainId: raw.chainId,
    contractAddress: raw.contractAddress,
    tokenAddress: raw.tokenAddress,
    address: raw.address,
    multiplier: raw.multiplier,
    rawSymbol: raw.rawSymbol,
    name: raw.name,
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const walletAddress = norm(process.env.WALLET_ADDRESS);
    if (!walletAddress) {
      return res.status(400).json({ error: "WALLET_ADDRESS not found" });
    }

    const symbols = req.query.symbols
      ? String(req.query.symbols).split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
      : WATCHLIST;

    const metadata = await fetchTokenMetadata(symbols);
    const rpc = await fetchWalletBalancesViaRpc(walletAddress, symbols);

    return res.status(200).json({
      ok: true,
      checkedAt: new Date().toISOString(),
      walletAddress: `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
      walletAddressFull: walletAddress,
      requestedSymbols: symbols,
      metadataCount: metadata.length,
      metadata: metadata.map((m) => ({
        symbol: m.symbol,
        chainId: m.chainId,
        contractAddress: m.contractAddress,
        allEvmAddresses: m.allEvmAddresses || [],
        rawSummary: summarizeRaw(m.raw),
      })),
      checkedBlockNumber: rpc.checkedBlockNumber,
      holdingsCount: rpc.holdings.length,
      holdings: rpc.holdings,
      rpcErrors: rpc.errors,
    });
  } catch (error) {
    console.error("debug-rpc-balances error:", error);
    return res.status(500).json({ error: error.message || "Unknown error" });
  }
};
