const { hasMegaNodeKey, hasMoralisKey } = require("../../lib/xstocks/transfer-source");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const moralisConfigured = hasMoralisKey();
  const megaNodeConfigured = hasMegaNodeKey();

  return res.status(200).json({
    ok: true,
    checkedAt: new Date().toISOString(),
    walletAddressExists: Boolean(process.env.WALLET_ADDRESS),
    moralisConfigured,
    megaNodeConfigured,
    legacyBscScanKeyExists: Boolean(process.env.BSCSCAN_API_KEY),
    legacyEtherscanKeyExists: Boolean(process.env.ETHERSCAN_API_KEY),
    rpcUrlExists: Boolean(process.env.BSC_RPC_URL),
    expectedPrimary: moralisConfigured ? "Moralis" : megaNodeConfigured ? "MegaNode" : "Legacy fallback",
  });
};
