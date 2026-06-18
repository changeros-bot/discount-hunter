function isEvmAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value || ""));
}

function maskAddress(address) {
  const s = String(address || "");
  if (!isEvmAddress(s)) return "";
  return `${s.slice(0, 6)}...${s.slice(-4)}`;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  const walletAddress = String(req.query.address || process.env.WALLET_ADDRESS || "").trim();

  if (!isEvmAddress(walletAddress)) {
    return res.status(400).json({
      ok: false,
      error: "invalid_wallet_address",
      message: "WALLET_ADDRESS is missing or invalid. Set WALLET_ADDRESS in Vercel, or call /api/wallet-holdings?address=0x...",
    });
  }

  return res.status(200).json({
    ok: true,
    version: "15.1-env-wallet-address-check",
    walletAddress: maskAddress(walletAddress),
    walletAddressSource: req.query.address ? "query_address" : "env_wallet_address",
    updatedAt: new Date().toISOString(),
    note: "wallet-holdings now reads WALLET_ADDRESS from Vercel env. Full balance sync is handled by /api/sync-wallet.",
  });
}
