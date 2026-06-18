const { fetchBep20TransfersLegacy } = require("../../lib/xstocks/bscscan-legacy");

function norm(value) {
  return String(value || "").trim();
}

function upper(value) {
  return norm(value).toUpperCase();
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

    const transfers = await fetchBep20TransfersLegacy(walletAddress);
    const tokenSymbols = Array.from(new Set(transfers.map((t) => upper(t.tokenSymbol)))).sort();

    const xstockTransfers = transfers
      .filter((t) => upper(t.tokenSymbol).endsWith("ON"))
      .map((t) => ({
        hash: t.hash,
        symbol: upper(t.tokenSymbol),
        from: t.from,
        to: t.to,
        value: t.value,
        tokenDecimal: t.tokenDecimal,
        timeStamp: t.timeStamp,
      }));

    return res.status(200).json({
      walletAddress: `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
      walletAddressLength: walletAddress.length,
      totalTransfers: transfers.length,
      tokenSymbols,
      xstockTransfersCount: xstockTransfers.length,
      xstockSymbols: Array.from(new Set(xstockTransfers.map((t) => t.symbol))).sort(),
      xstockTransfers: xstockTransfers.slice(0, 100),
    });
  } catch (error) {
    console.error("debug-transfers error:", error);
    return res.status(500).json({ error: error.message || "Unknown error" });
  }
};
