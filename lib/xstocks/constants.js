// DCA Discount Hunter V15.11 - Constants

const WATCHLIST = [
  "NVDAON",
  "TSMON",
  "AMDON",
  "AVGOON",
  "MRVLON",
  "VRTON",
  "RKLBON",
  "LITEON",
  "SPCXON",
];

const STABLECOINS = ["BSC-USD", "USDT", "BUSD", "USDC"];

const PRICE_SYMBOL_MAP = {
  NVDAON: "NVDA",
  TSMON: "TSM",
  AMDON: "AMD",
  AVGOON: "AVGO",
  MRVLON: "MRVL",
  VRTON: "VRT",
  RKLBON: "RKLB",
  LITEON: "LITE",
  SPCXON: "SPCX",
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
