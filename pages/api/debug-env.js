// Safe environment diagnostics. Does not expose secret values.

function mask(value) {
  if (!value) return null;
  const s = String(value);
  if (s.length <= 10) return `${s.slice(0, 2)}...${s.slice(-2)}`;
  return `${s.slice(0, 6)}...${s.slice(-4)}`;
}

export default function handler(req, res) {
  const keys = [
    "WALLET_ADDRESS",
    "BSCSCAN_API_KEY",
    "BSC_SCAN_API_KEY",
    "ETHERSCAN_API_KEY",
    "FINNHUB_API_KEY",
  ];

  const env = {};
  for (const key of keys) {
    const value = process.env[key];
    env[key] = {
      exists: Boolean(value),
      length: value ? String(value).length : 0,
      preview: mask(value),
    };
  }

  res.status(200).json({
    ok: true,
    checkedAt: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV || null,
    env,
  });
}
