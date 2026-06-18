// DCA折價獵人 V15.0 - PnL Calculator

function calculatePnL(holdings, tokenPrices, referencePrices) {
  return holdings.map((h) => {
    const tokenPriceData = tokenPrices[h.symbol];
    const referencePriceData = referencePrices[h.symbol];

    let tokenPrice = 0;
    let currentValue = 0;
    let unrealizedPnL = 0;
    let pnlPct = 0;
    let priceWarning;
    let excludeFromPortfolioPnL;

    if (tokenPriceData) {
      tokenPrice = tokenPriceData.price;
      currentValue = h.quantity * tokenPrice;
      unrealizedPnL = currentValue - h.totalCost;
      pnlPct = h.totalCost > 0 ? unrealizedPnL / h.totalCost : 0;
    } else {
      priceWarning = `No token price found for ${h.symbol} - excluded from PnL calculation`;
      excludeFromPortfolioPnL = true;
    }

    let referenceStockPrice = 0;
    let premiumDiscount = 0;
    let premiumDiscountPct = 0;
    let referenceWarning;

    if (referencePriceData) {
      referenceStockPrice = referencePriceData.price;
      premiumDiscount = tokenPrice - referenceStockPrice;
      premiumDiscountPct = referenceStockPrice > 0 ? premiumDiscount / referenceStockPrice : 0;
    } else {
      referenceWarning = `No reference stock price found for ${h.symbol} - premium/discount unavailable`;
    }

    return {
      ...h,
      tokenPrice,
      currentValue,
      unrealizedPnL,
      pnlPct,
      referenceStockPrice,
      premiumDiscount,
      premiumDiscountPct,
      ...(priceWarning ? { priceWarning } : {}),
      ...(referenceWarning ? { referenceWarning } : {}),
      ...(excludeFromPortfolioPnL ? { excludeFromPortfolioPnL } : {}),
    };
  });
}

function summarizePortfolio(holdingsWithPnL) {
  const actualTotalInvested = holdingsWithPnL.reduce((sum, h) => sum + h.totalCost, 0);
  const pricedHoldings = holdingsWithPnL.filter((h) => !h.excludeFromPortfolioPnL);
  const unpricedHoldings = holdingsWithPnL.filter((h) => h.excludeFromPortfolioPnL);

  const portfolioTotalCost = pricedHoldings.reduce((sum, h) => sum + h.totalCost, 0);
  const portfolioMarketValue = pricedHoldings.reduce((sum, h) => sum + h.currentValue, 0);
  const portfolioUnrealizedPnL = portfolioMarketValue - portfolioTotalCost;
  const portfolioPnLPct = portfolioTotalCost > 0 ? portfolioUnrealizedPnL / portfolioTotalCost : 0;
  const totalPremiumDiscountValue = pricedHoldings.reduce((sum, h) => sum + h.premiumDiscount * h.quantity, 0);
  const unpricedCost = unpricedHoldings.reduce((sum, h) => sum + h.totalCost, 0);

  return {
    holdings: holdingsWithPnL,
    actualTotalInvested,
    portfolioTotalCost,
    portfolioMarketValue,
    portfolioUnrealizedPnL,
    portfolioPnLPct,
    totalPremiumDiscountValue,
    unpricedCost,
    unpricedHoldingsCount: unpricedHoldings.length,
    lastSyncTime: new Date().toISOString(),
  };
}

module.exports = {
  calculatePnL,
  summarizePortfolio,
};
