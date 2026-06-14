export default async function handler(req, res) {
  const symbols = ["QQQ", "NVDA", "TSM", "AVGO", "GOOGL", "AMD", "MRVL", "RKLB"];

  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(",")}`;
    const response = await fetch(url);
    const data = await response.json();

    const result = data.quoteResponse.result.map((item) => ({
      symbol: item.symbol,
      price: item.regularMarketPrice,
      high: item.fiftyTwoWeekHigh,
      currency: item.currency,
      marketState: item.marketState
    }));

    result.push({
      symbol: "SPCX",
      price: 161.29,
      high: 176.00,
      currency: "USD",
      marketState: "MANUAL"
    });

    res.status(200).json({
      updatedAt: new Date().toISOString(),
      data: result
    });
  } catch (error) {
    res.status(500).json({
      error: "price_fetch_failed",
      message: error.message
    });
  }
}