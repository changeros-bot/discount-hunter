// DCA折價獵人 V15.0 - Sync Wallet API Route

const { fetchBep20Transfers } = require("../../lib/xstocks/bscscan");
const { buildBuyRecordsFromTransfers, calculateHoldings } = require("../../lib/xstocks/costBasis");
const { fetchTokenPrices, fetchReferenceStockPrices } = require("../../lib/xstocks/prices");
const { calculatePnL, summarizePortfolio } = require("../../lib/xstocks/pnl");

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { walletAddress } = req.body || {};

    if (!walletAddress || typeof walletAddress !== "string") {
      return res.status(400).json({ error: "walletAddress is required" });
    }

    const transfers = await fetchBep20Transfers(walletAddress.trim());
    const buyRecords = buildBuyRecordsFromTransfers(transfers, walletAddress.trim());
    const holdings = calculateHoldings(buyRecords);
    const symbols = holdings.map((h) => h.symbol);

    const [tokenPrices, referencePrices] = await Promise.all([
      fetchTokenPrices(symbols),
      fetchReferenceStockPrices(symbols),
    ]);

    const holdingsWithPnL = calculatePnL(holdings, tokenPrices, referencePrices);
    const summary = summarizePortfolio(holdingsWithPnL);

    return res.status(200).json(summary);
  } catch (error) {
    console.error("sync-wallet error:", error);
    return res.status(500).json({ error: error.message || "Unknown error" });
  }
}
