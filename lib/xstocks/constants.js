// DCA Discount Hunter V15.12 - Constants

const WATCHLIST = [
  "GOOGLON",
  "NVDAON",
  "QQQON",
  "TSMON",
  "SPCXON",
  "AMDON",
  "MRVLON",
  "RKLBON",
  "AVGOON",
];

const STABLECOINS = ["BSC-USD", "USDT", "BUSD", "USDC"];

const PRICE_SYMBOL_MAP = {
  GOOGLON: "GOOGL",
  NVDAON: "NVDA",
  QQQON: "QQQ",
  TSMON: "TSM",
  SPCXON: "SPCX",
  AMDON: "AMD",
  MRVLON: "MRVL",
  RKLBON: "RKLB",
  AVGOON: "AVGO",
};

function toLower(addr) {
  return String(addr || "").trim().toLowerCase();
}

function convertValue(rawValue, decimals) {
  const decimalNum = parseInt(decimals, 10);
  const safeDecimals = Number.isFinite(decimalNum) ? decimalNum : 18;
  return Number(rawValue || 0) / Math.pow(10, safeDecimals);
}

module.exports = {
  WATCHLIST,
  STABLECOINS,
  PRICE_SYMBOL_MAP,
  toLower,
  convertValue,
};
