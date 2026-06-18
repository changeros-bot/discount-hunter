const { fetchBep20TransfersLegacy } = require("../../lib/xstocks/bscscan-legacy");
const { buildBuyRecordsFromTransfers, calculateHoldings } = require("../../lib/xstocks/costBasis");

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
    const holdings = calculateHoldings(buyRecords);

    return res.status(200).json({
      walletAddress: `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
      totalTransfers: transfers.length,
      buyRecordsCount: buyRecords.length,
      holdingsCount: holdings.length,
      holdings: holdings.map((h) => ({
        symbol: h.symbol,
        quantity: h.quantity,
        totalCost: h.totalCost,
        averageCost: h.averageCost,
        buyCount: h.buyCount,
        firstBuyTimestamp: h.firstBuyTimestamp,
        lastBuyTimestamp: h.lastBuyTimestamp,
      })),
    });
  } catch (error) {
    console.error("debug-holdings error:", error);
    return res.status(500).json({ error: error.message || "Unknown error" });
  }
};
