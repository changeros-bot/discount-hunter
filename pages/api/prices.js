export default async function handler(req, res) {
  const key = process.env.FINNHUB_API_KEY;

  const assets = [
    "QQQ",
    "NVDA",
    "TSM",
    "AVGO",
    "GOOGL",
    "AMD",
    "MRVL",
    "RKLB"
  ];

  try {
    const results = [];

    for (const symbol of assets) {
      const quoteUrl =
        `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${key}`;

      const metricUrl =
        `https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${key}`;

      const quoteRes = await fetch(quoteUrl);
      const quoteData = await quoteRes.json();

      const metricRes = await fetch(metricUrl);
      const metricData = await metricRes.json();

      const price = Number(quoteData.c || 0);

      const high = Number(
        metricData?.metric?.["52WeekHigh"] || 0
      );

      const discount =
        high > 0
          ? Number((((price - high) / high) * 100).toFixed(1))
          : 0;

      results.push({
        symbol,
        price,
        high,
        discount
      });
    }

    results.push({
      symbol: "SPCX",
      price: 161.29,
      high: 176,
      discount: -8.4,
      source: "manual"
    });

    res.status(200).json({
      updatedAt: new Date().toISOString(),
      source: "Finnhub",
      data: results
    });

  } catch (error) {

    res.status(500).json({
      error: "finnhub_failed",
      message: error.message
    });

  }
}