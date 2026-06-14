export default async function handler(req, res) {
  const key = process.env.FINNHUB_API_KEY;

  const assets = [
    { symbol: "QQQ", name: "Invesco QQQ", grade: "A+", rules: [-15, -25, -35, -50] },
    { symbol: "NVDA", name: "NVIDIA", grade: "A", rules: [-15, -25, -35, -50] },
    { symbol: "TSM", name: "Taiwan Semiconductor", grade: "A", rules: [-15, -25, -35, -50], manualHigh: 450.16 },
    { symbol: "AVGO", name: "Broadcom", grade: "A", rules: [-15, -25, -35, -50] },
    { symbol: "SPCX", name: "SpaceX", grade: "A-", rules: [-20, -35, -50, -65], manualHigh: 176.52, highType: "IPO以來高點" },
    { symbol: "GOOGL", name: "Alphabet", grade: "B", rules: [-20, -35, -50, -65] },
    { symbol: "AMD", name: "Advanced Micro Devices", grade: "B", rules: [-20, -35, -50, -65] },
    { symbol: "MRVL", name: "Marvell", grade: "B", rules: [-20, -35, -50, -65] },
    { symbol: "RKLB", name: "Rocket Lab", grade: "C", rules: [-25, -40, -60] }
  ];

  function getSignal(discount, rules) {
    if (discount <= rules[3]) return { text: "第四買點", amount: "20 美元", color: "red" };
    if (discount <= rules[2]) return { text: "第三買點", amount: "15 美元", color: "orange" };
    if (discount <= rules[1]) return { text: "第二買點", amount: "10 美元", color: "gold" };
    if (discount <= rules[0]) return { text: "第一買點", amount: "5 美元", color: "lime" };
    return { text: "尚未到買點", amount: "0", color: "gray" };
  }

  try {
    const results = [];

    for (const asset of assets) {
      const quoteUrl = `https://finnhub.io/api/v1/quote?symbol=${asset.symbol}&token=${key}`;
      const quoteRes = await fetch(quoteUrl);
      const quoteData = await quoteRes.json();

      const price = Number(quoteData.c || 0);

      let high = asset.manualHigh;
      let highType = asset.highType || "52週高點";

      if (!high) {
        const metricUrl = `https://finnhub.io/api/v1/stock/metric?symbol=${asset.symbol}&metric=all&token=${key}`;
        const metricRes = await fetch(metricUrl);
        const metricData = await metricRes.json();
        high = Number(metricData?.metric?.["52WeekHigh"] || 0);
      }

      const discount =
        high > 0 && price > 0
          ? Number((((price - high) / high) * 100).toFixed(1))
          : 0;

      const signal = getSignal(discount, asset.rules);

      results.push({
        ...asset,
        price,
        high,
        highType,
        discount,
        signal
      });
    }

    res.status(200).json({
      updatedAt: new Date().toISOString(),
      source: "Finnhub V9",
      count: results.length,
      data: results
    });
  } catch (error) {
    res.status(500).json({
      error: "finnhub_failed",
      message: error.message
    });
  }
}