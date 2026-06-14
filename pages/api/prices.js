export default async function handler(req, res) {
  const key = process.env.ALPHA_VANTAGE_KEY;

  const assets = [
    { symbol: "QQQ", high: 748.65 },
    { symbol: "NVDA", high: 236.54 },
    { symbol: "TSM", high: 450.16 },
    { symbol: "AVGO", high: 495 },
    { symbol: "GOOGL", high: 408.61 },
    { symbol: "AMD", high: 546.44 },
    { symbol: "MRVL", high: 324.2 },
    { symbol: "RKLB", high: 151 }
  ];

  try {
    const results = [];

    for (const asset of assets) {
      const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${asset.symbol}&apikey=${key}`;
      const response = await fetch(url);
      const quoteData = await response.json();

      results.push({
        symbol: asset.symbol,
        price: Number(quoteData["Global Quote"]?.["05. price"] || 0),
        high: asset.high,
        currency: "USD"
      });
    }

    results.push({
      symbol: "SPCX",
      price: 161.29,
      high: 176,
      currency: "USD",
      source: "manual"
    });

    res.status(200).json({
      updatedAt: new Date().toISOString(),
      source: "Alpha Vantage + manual 52W high",
      data: results
    });
  } catch (error) {
    res.status(500).json({
      error: "alpha_vantage_failed",
      message: error.message
    });
  }
}