const { fetchBep20TransfersLegacy } = require("../../lib/xstocks/bscscan-legacy");
const { fetchWalletTokenTransfers } = require("../../lib/xstocks/transfer-source");
const { buildBuyRecordsFromTransfers } = require("../../lib/xstocks/costBasis");

function norm(value) {
  return String(value || "").trim();
}

function upper(value) {
  return norm(value).toUpperCase();
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const walletAddress = norm(process.env.WALLET_ADDRESS);
    if (!walletAddress) return res.status(400).json({ error: "WALLET_ADDRESS not found" });

    const transfers = await fetchWalletTokenTransfers(walletAddress, fetchBep20TransfersLegacy);
    const records = buildBuyRecordsFromTransfers(transfers, walletAddress);
    const tokenSymbols = Array.from(new Set(transfers.map((t) => upper(t.tokenSymbol)))).sort();

    const stableTransfers = transfers.filter((t) => ["USDT", "BSC-USD", "BUSD", "USDC", "USDON"].includes(upper(t.tokenSymbol)));
    const xstockTransfers = transfers.filter((t) => upper(t.tokenSymbol).endsWith("ON"));

    let sameTxSample = [];
    if (xstockTransfers[0]?.hash) {
      sameTxSample = transfers
        .filter((t) => t.hash === xstockTransfers[0].hash)
        .map((t) => ({
          hash: t.hash,
          symbol: upper(t.tokenSymbol),
          from: t.from,
          to: t.to,
          value: t.value,
          tokenDecimal: t.tokenDecimal,
          contractAddress: t.contractAddress,
        }));
    }

    return res.status(200).json({
      ok: true,
      checkedAt: new Date().toISOString(),
      walletAddress: `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
      totalTransfers: transfers.length,
      stableTransfersCount: stableTransfers.length,
      xstockTransfersCount: xstockTransfers.length,
      buyRecordCount: records.filter((r) => r.type === "BUY").length,
      transferInRecordCount: records.filter((r) => r.type === "TRANSFER_IN").length,
      tokenSymbols,
      sameTxSample,
      buyRecords: records.slice(0, 20),
    });
  } catch (error) {
    console.error("debug-transfers error:", error);
    return res.status(500).json({ error: error.message || "Unknown error" });
  }
};
