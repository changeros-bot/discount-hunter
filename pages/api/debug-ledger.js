const { fetchBep20TransfersLegacy } = require("../../lib/xstocks/bscscan-legacy");
const { buildBuyRecordsFromTransfers } = require("../../lib/xstocks/costBasis");

function norm(value) {
  return String(value || "").trim();
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
    const buyRecords = buildBuyRecordsFromTransfers(transfers, walletAddress);

    return res.status(200).json({
      walletAddress: `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
      totalTransfers: transfers.length,
      buyRecordsCount: buyRecords.length,
      buyRecordSymbols: Array.from(new Set(buyRecords.map((r) => String(r.symbol || "").toUpperCase()))).sort(),
      buyRecords: buyRecords.map((r) => ({
        symbol: r.symbol,
        quantity: r.quantity,
        costUsd: r.costUsd,
        avgPrice: r.quantity > 0 ? r.costUsd / r.quantity : 0,
        txHash: r.txHash,
        timestamp: r.timestamp,
        warning: r.warning,
      })),
    });
  } catch (error) {
    console.error("debug-ledger error:", error);
    return res.status(500).json({ error: error.message || "Unknown error" });
  }
};
