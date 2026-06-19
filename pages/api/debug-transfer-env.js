const { hasMegaNodeKey, hasMoralisKey } = require("../../lib/xstocks/transfer-source");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  return res.status(200).json({
    ok: true,
    checkedAt: new Date().toISOString(),
    walletAddressExists: Boolean(process.env.WALLET_ADDRESS),
    megaNodeConfigured: hasMegaNodeKey(),
    moralisConfigured: hasMoralisKey(),
    legacyBscScanKeyExists: Boolean(process.env.BSCSCAN_API_KEY),
    legacyEtherscanKeyExists: Boolean(process.env.ETHERSCAN_API_KEY),
    rpcUrlExists: Boolean(process.env.BSC_RPC_URL),
    expectedPrimary: hasMegaNodeKey() ? "MegaNode" : hasMoralisKey() ? "Moralis" : "Legacy fallback",
  });
};
