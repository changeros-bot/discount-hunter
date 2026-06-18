
// DCA折價獵人 V15.0 - Constants

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

const STABLECOINS = ["BSC-USD", "USDT", "BUSD"];

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
  return addr.toLowerCase();
}

function convertValue(rawValue, decimals) {
  const decimalNum = parseInt(decimals, 10) || 18;
  return Number(rawValue) / Math.pow(10, decimalNum);
}

module.exports = {
  WATCHLIST,
  STABLECOINS,
  PRICE_SYMBOL_MAP,
  toLower,
  convertValue,
};