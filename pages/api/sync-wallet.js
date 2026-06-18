// DCA折價獵人 V15.1 - Background Wallet Sync API Route
// Reads WALLET_ADDRESS from Vercel Environment Variables by default.
// Optional body.walletAddress is kept only as a development fallback.

const { fetchBep20TransfersLegacy } = require("../../lib/xstocks/bscscan-legacy");
const { buildBuyRecordsFromTransfers, calculateHoldings } = require("../../lib/xstocks/costBasis");
const { fetchTokenPrices, fetchReferenceStockPrices } = require("../../lib/xstocks/prices");
const { calculatePnL, summarizePortfolio } = require("../../lib/xstocks/pnl");

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const bodyWalletAddress = req.body && typeof req.body.walletAddress === "string"
      ? req.body.walletAddress.trim()
      : "";
    const envWalletAddress = process.env.WALLET_ADDRESS
      ? String(process.env.WALLET_ADDRESS).trim()
      : "";

    const cleanWalletAddress = bodyWalletAddress || envWalletAddress;

    if (!cleanWalletAddress) {
      return res.status(400).json({
        error: "WALLET_ADDRESS not found in Vercel environment variables",
      });
    }

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

    return res.status(200).json({
      ...summary,
      walletAddress: `${cleanWalletAddress.slice(0, 6)}...${cleanWalletAddress.slice(-4)}`,
      positionSource: bodyWalletAddress ? "manual_body" : "env_wallet_address",
    });
  } catch (error) {
    console.error("sync-wallet error:", error);
    return res.status(500).json({ error: error.message || "Unknown error" });
  }
}

module.exports = handler;
