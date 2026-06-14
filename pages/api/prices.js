export default async function handler(req, res) {
  const key = process.env.ALPHA_VANTAGE_KEY;

  const symbols = [
    "QQQ",
    "NVDA"
    
  ];

  try {
    const results = [];

    for (const symbol of symbols) {
      const quoteUrl =
        `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${key}`;

      results.push({
  symbol,
  price: Number(
    quoteData["Global Quote"]?.["05. price"] || 0
  ),
  currency: "USD"
});

      const overviewRes = await fetch(overviewUrl);
      const overviewData = await overviewRes.json();

      results.push({
        symbol,
        price: Number(
          quoteData["Global Quote"]?.["05. price"] || 0
        ),
        high: Number(
          overviewData["52WeekHigh"] || 0
        ),
        currency: "USD"
      });
    }

    results.push({
      symbol: "SPCX",
      price: 161.29,
      high: 176.0,
      currency: "USD",
      source: "manual"
    });

    res.status(200).json({
      updatedAt: new Date().toISOString(),
      source: "Alpha Vantage",
      data: results
    });

  } catch (error) {
    res.status(500).json({
      error: "alpha_vantage_failed",
      message: error.message
    });
  }
}