export default async function handler(req, res) {
  const key = process.env.FINNHUB_API_KEY;

  const assets = [
    { symbol: "QQQ", name: "Invesco QQQ", grade: "A+", description: "核心ETF｜Nasdaq 100", rules: [-15, -25, -35, -50], amounts: [5, 10, 15, 20] },
    { symbol: "NVDA", name: "NVIDIA", grade: "A", description: "AI GPU核心龍頭", rules: [-15, -25, -35, -50], amounts: [5, 10, 15, 20] },
    { symbol: "TSM", name: "Taiwan Semiconductor", grade: "A", description: "全球先進製程龍頭", rules: [-15, -25, -35, -50], amounts: [5, 10, 15, 20], manualHigh: 450.16 },
    { symbol: "AVGO", name: "Broadcom", grade: "A", description: "AI網路 + ASIC龍頭", rules: [-15, -25, -35, -50], amounts: [5, 10, 15, 20] },
    { symbol: "SPCX", name: "SpaceX", grade: "A-", description: "高成長太空龍頭", rules: [-20, -35, -50, -65], amounts: [5, 10, 15, 20], manualHigh: 176.52, highType: "IPO以來高點" },
    { symbol: "GOOGL", name: "Alphabet", grade: "B", description: "AI + 搜尋 + 雲端", rules: [-20, -35, -50, -65], amounts: [5, 10, 15, 20] },
    { symbol: "AMD", name: "Advanced Micro Devices", grade: "B", description: "AI GPU挑戰者", rules: [-20, -35, -50, -65], amounts: [5, 10, 15, 20] },
    { symbol: "MRVL", name: "Marvell", grade: "B", description: "AI網通與ASIC供應鏈", rules: [-20, -35, -50, -65], amounts: [5, 10, 15, 20] },
    { symbol: "RKLB", name: "Rocket Lab", grade: "C", description: "高風險太空成長股", rules: [-25, -40, -60], amounts: [5, 10, 15] }
  ];

  function getSignal(discount, rules, amounts) {
    for (let i = rules.length - 1; i >= 0; i--) {
      if (discount <= rules[i]) {
        return {
          text: `第${i + 1}買點`,
          amount: `${amounts[i]} 美元`,
          level: i + 1
        };
      }
    }

    return {
      text: "尚未到買點",
      amount: "0",
      level: 0
    };
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

      const signal = getSignal(discount, asset.rules, asset.amounts);

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