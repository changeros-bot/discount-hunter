// DCA折價獵人 V15.0 - Sync Wallet API Route

const { fetchBep20TransfersLegacy } = require("../../lib/xstocks/bscscan-legacy");
const { buildBuyRecordsFromTransfers, calculateHoldings } = require("../../lib/xstocks/costBasis");
const { fetchTokenPrices, fetchReferenceStockPrices } = require("../../lib/xstocks/prices");
const { calculatePnL, summarizePortfolio } = require("../../lib/xstocks/pnl");

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { walletAddress } = req.body || {};

    if (!walletAddress || typeof walletAddress !== "string") {
      return res.status(400).json({ error: "walletAddress is required" });
    }

    const cleanWalletAddress = walletAddress.trim();
    const transfers = await fetchBep20TransfersLegacy(cleanWalletAddress);
    const buyRecords = buildBuyRecordsFromTransfers(transfers, cleanWalletAddress);
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

module.exports = handler;
