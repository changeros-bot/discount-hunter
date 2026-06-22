// DCA Discount Hunter V15.22 - Verified BSC xStocks contract mapping
// Source: Binance App wallet holdings + BNB Chain balanceOf debug verification.
// Contract whitelist is the source of truth for balanceOf() contract selection.
// Moralis transfer hints are only fallback/debug data and must not override verified contracts.

const XSTOCK_CONTRACTS = {
  AMDON: {
    symbol: "AMDON",
    ticker: "AMD",
    contractAddress: "0x9f16e46c73b43bdb70861247d537bee4ae18f639",
    decimals: 18,
    source: "wallet_debug_verified",
  },
  AVGOON: {
    symbol: "AVGOON",
    ticker: "AVGO",
    contractAddress: "0x0ed2e3180edf393e6bf8db124bd15ddd54de150a",
    decimals: 18,
    source: "bscscan_verified",
  },
  GOOGLON: {
    symbol: "GOOGLON",
    ticker: "GOOGL",
    contractAddress: "0x091fc7778e6932d4009b087b191d1ee3bac5729a",
    decimals: 18,
    source: "wallet_debug_verified",
  },
  MRVLON: {
    symbol: "MRVLON",
    ticker: "MRVL",
    contractAddress: "0x1501ec83ffef405b4331cc4f73277a40fb0c627d",
    decimals: 18,
    source: "bscscan_verified",
  },
  NVDAON: {
    symbol: "NVDAON",
    ticker: "NVDA",
    contractAddress: "0xa9ee28c80f960b889dfbd1902055218cba016f75",
    decimals: 18,
    source: "bscscan_verified",
  },
  QQQON: {
    symbol: "QQQON",
    ticker: "QQQ",
    contractAddress: "0x0cde6936d305d5b34667fc46425e852efd73559a",
    decimals: 18,
    source: "bscscan_verified",
  },
  RKLBON: {
    symbol: "RKLBON",
    ticker: "RKLB",
    contractAddress: "0xb4d695569236273745b4cd54b539b1b9cc1513af",
    decimals: 18,
    source: "wallet_debug_verified",
  },
  SPCXON: {
    symbol: "SPCXON",
    ticker: "SPCX",
    contractAddress: "0xd0a58bc9d88d3ff48c0294cb7e45937d0e41a928",
    decimals: 18,
    source: "wallet_debug_verified",
  },
  TSMON: {
    symbol: "TSMON",
    ticker: "TSM",
    contractAddress: "0xc37042a7a4fa510d8884a433762ab87257b91965",
    decimals: 18,
    source: "bscscan_verified",
  },
};

function upper(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeOnSymbol(symbol) {
  const s = upper(symbol);
  if (!s) return "";
  return s.endsWith("ON") ? s : `${s}ON`;
}

function getKnownContract(symbol) {
  return XSTOCK_CONTRACTS[normalizeOnSymbol(symbol)] || null;
}

function getKnownContracts(symbols) {
  return (symbols || [])
    .map((symbol) => getKnownContract(symbol))
    .filter(Boolean);
}

module.exports = {
  XSTOCK_CONTRACTS,
  getKnownContract,
  getKnownContracts,
};
