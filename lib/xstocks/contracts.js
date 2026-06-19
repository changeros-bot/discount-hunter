// DCA Discount Hunter V15.3 - Verified BSC xStocks contract mapping
// Source: BscScan wallet token holdings / token transfer CSV verification.
// Binance public metadata may return CT_501 internal IDs; do not use those for balanceOf().

const XSTOCK_CONTRACTS = {
  TSMON: {
    symbol: "TSMON",
    ticker: "TSM",
    contractAddress: "0xc37042a7a4fa510d8884a433762ab87257b91965",
    decimals: 18,
    source: "bscscan_verified",
  },
  AVGOON: {
    symbol: "AVGOON",
    ticker: "AVGO",
    contractAddress: "0x0ed2e3180edf393e6bf8db124bd15ddd54de150a",
    decimals: 18,
    source: "bscscan_verified",
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
};

function upper(value) {
  return String(value || "").trim().toUpperCase();
}

function getKnownContract(symbol) {
  return XSTOCK_CONTRACTS[upper(symbol)] || null;
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
