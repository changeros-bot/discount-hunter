// DCA折價獵人 V15.0 - Mock price fetchers

const { PRICE_SYMBOL_MAP } = require("./constants");

async function fetchTokenPrices(symbols) {
  const mockTokenPrices = {
    GOOGLON: 429.0,
    NVDAON: 206.74,
    QQQON: 729.5,
    TSMON: 428.0,
    SPCXON: 206.5,
    AMDON: 510.2,
    MRVLON: 282.9,
    RKLBON: 104.5,
    AVGOON: 404.53,
  };

  const result = {};
  for (const symbol of symbols) {
    const upperSymbol = String(symbol || "").toUpperCase();
    if (mockTokenPrices[upperSymbol] !== undefined) {
      result[upperSymbol] = {
        symbol: upperSymbol,
        price: mockTokenPrices[upperSymbol],
        source: "mock",
      };
    }
  }
  return result;
}

async function fetchReferenceStockPrices(symbols) {
  const mockStockPrices = {
    GOOGL: 428.5,
    NVDA: 207.59,
    QQQ: 730.12,
    TSM: 428.81,
    SPCX: 207.04,
    AMD: 509.45,
    MRVL: 283.61,
    RKLB: 104.92,
    AVGO: 378.93,
  };

  const result = {};
  for (const symbol of symbols) {
    const upperSymbol = String(symbol || "").toUpperCase();
    const stockSymbol = PRICE_SYMBOL_MAP[upperSymbol];
    if (stockSymbol && mockStockPrices[stockSymbol] !== undefined) {
      result[upperSymbol] = {
        symbol: upperSymbol,
        stockSymbol,
        price: mockStockPrices[stockSymbol],
        source: "mock",
      };
    }
  }
  return result;
}

module.exports = {
  fetchTokenPrices,
  fetchReferenceStockPrices,
};
