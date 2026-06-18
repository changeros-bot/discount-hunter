// DCA Discount Hunter V15.2 - PnL Calculator

function upper(value) {
  return String(value || "").trim().toUpperCase();
}

function safeNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function calculatePnL(holdings, tokenPrices, referencePrices) {
  return holdings.map((h) => {
    const symbol = upper(h.symbol);
    const quantity = safeNumber(h.quantity);
    const totalCost = safeNumber(h.totalCost);
    const tokenPriceData = tokenPrices[symbol];
    const referencePriceData = referencePrices[symbol];

    let tokenPrice = 0;
    let currentValue = 0;
    let unrealizedPnL = 0;
    let pnlPct = 0;
    let priceWarning;
    let excludeFromPortfolioPnL;

    if (tokenPriceData) {
      tokenPrice = safeNumber(tokenPriceData.price);
      currentValue = quantity * tokenPrice;
      unrealizedPnL = currentValue - totalCost;
      pnlPct = totalCost > 0 ? unrealizedPnL / totalCost : 0;
    } else {
      priceWarning = `No token price found for ${symbol} - excluded from PnL calculation`;
      excludeFromPortfolioPnL = true;
    }

    let referenceStockPrice = 0;
    let premiumDiscount = 0;
    let premiumDiscountPct = 0;
    let referenceWarning;

    if (referencePriceData) {
      referenceStockPrice = safeNumber(referencePriceData.price);
      premiumDiscount = tokenPrice - referenceStockPrice;
      premiumDiscountPct = referenceStockPrice > 0 ? premiumDiscount / referenceStockPrice : 0;
    } else {
      referenceWarning = `No reference stock price found for ${symbol} - premium/discount unavailable`;
    }

    return {
      ...h,
      symbol,
      quantity,
      totalCost,
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
  const actualTotalInvested = holdingsWithPnL.reduce((sum, h) => sum + safeNumber(h.totalCost), 0);
  const pricedHoldings = holdingsWithPnL.filter((h) => !h.excludeFromPortfolioPnL);
  const unpricedHoldings = holdingsWithPnL.filter((h) => h.excludeFromPortfolioPnL);

  const portfolioTotalCost = pricedHoldings.reduce((sum, h) => sum + safeNumber(h.totalCost), 0);
  const portfolioMarketValue = pricedHoldings.reduce((sum, h) => sum + safeNumber(h.currentValue), 0);
  const portfolioUnrealizedPnL = portfolioMarketValue - portfolioTotalCost;
  const portfolioPnLPct = portfolioTotalCost > 0 ? portfolioUnrealizedPnL / portfolioTotalCost : 0;
  const totalPremiumDiscountValue = pricedHoldings.reduce((sum, h) => {
    return sum + safeNumber(h.premiumDiscount) * safeNumber(h.quantity);
  }, 0);
  const unpricedCost = unpricedHoldings.reduce((sum, h) => sum + safeNumber(h.totalCost), 0);

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
