const BINANCE_PRICE_ENDPOINT = "https://api.binance.com/api/v3/ticker/price";

const assets = [
  { symbol: "QQQ", binanceSymbol: "QQQONUSDT", name: "Invesco QQQ", grade: "A+", description: "核心ETF｜Nasdaq 100", rules: [-15, -25, -35, -50], amounts: [5, 10, 15, 20] },
  { symbol: "NVDA", binanceSymbol: "NVDAONUSDT", name: "NVIDIA", grade: "A", description: "AI GPU核心龍頭", rules: [-15, -25, -35, -50], amounts: [5, 10, 15, 20] },
  { symbol: "TSM", binanceSymbol: "TSMONUSDT", name: "Taiwan Semiconductor", grade: "A", description: "全球先進製程龍頭", rules: [-15, -25, -35, -50], amounts: [5, 10, 15, 20], manualHigh: 450.16 },
  { symbol: "AVGO", binanceSymbol: "AVGOONUSDT", name: "Broadcom", grade: "A", description: "AI網路 + ASIC龍頭", rules: [-15, -25, -35, -50], amounts: [5, 10, 15, 20] },
  { symbol: "SPCX", binanceSymbol: "SPCXONUSDT", name: "SpaceX", grade: "A-", description: "高成長太空龍頭", rules: [-20, -35, -50, -65], amounts: [5, 10, 15, 20], manualHigh: 176.52, highType: "IPO以來高點" },
  { symbol: "GOOGL", binanceSymbol: "GOOGLONUSDT", name: "Alphabet", grade: "B", description: "AI + 搜尋 + 雲端", rules: [-20, -35, -50, -65], amounts: [5, 10, 15, 20] },
  { symbol: "AMD", binanceSymbol: "AMDONUSDT", name: "Advanced Micro Devices", grade: "B", description: "AI GPU挑戰者", rules: [-20, -35, -50, -65], amounts: [5, 10, 15, 20] },
  { symbol: "MRVL", binanceSymbol: "MRVLONUSDT", name: "Marvell", grade: "B", description: "AI網通與ASIC供應鏈", rules: [-20, -35, -50, -65], amounts: [5, 10, 15, 20] },
  { symbol: "RKLB", binanceSymbol: "RKLONUSDT", name: "Rocket Lab", grade: "C", description: "高風險太空成長股", rules: [-25, -40, -60], amounts: [5, 10, 15] }
];

function getSignal(discount, rules, amounts) {
  for (let i = rules.length - 1; i >= 0; i--) {
    if (discount <= rules[i]) {
      return {
        text: `第${i + 1}買點`,
        amount: `${amounts[i]}U`,
        level: i + 1
      };
    }
  }

  return {
    text: "尚未到買點",
    amount: "0U",
    level: 0
  };
}

async function fetchBinancePrice(binanceSymbol) {
  if (!binanceSymbol) return null;

  const url = `${BINANCE_PRICE_ENDPOINT}?symbol=${binanceSymbol}`;
  const response = await fetch(url);

  if (!response.ok) return null;

  const data = await response.json();
  const price = Number(data?.price || 0);

  if (!Number.isFinite(price) || price <= 0) return null;

  return price;
}

async function fetchFinnhubPrice(symbol, key) {
  if (!key) return null;

  const quoteUrl = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${key}`;
  const quoteRes = await fetch(quoteUrl);

  if (!quoteRes.ok) return null;

  const quoteData = await quoteRes.json();
  const price = Number(quoteData.c || 0);

  if (!Number.isFinite(price) || price <= 0) return null;

  return price;
}

async function fetchFinnhubHigh(symbol, key) {
  if (!key) return 0;

  const metricUrl = `https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${key}`;
  const metricRes = await fetch(metricUrl);

  if (!metricRes.ok) return 0;

  const metricData = await metricRes.json();
  const high = Number(metricData?.metric?.["52WeekHigh"] || 0);

  return Number.isFinite(high) ? high : 0;
}

export default async function handler(req, res) {
  const key = process.env.FINNHUB_API_KEY;

  try {
    const results = [];

    for (const asset of assets) {
      const binancePrice = await fetchBinancePrice(asset.binanceSymbol);
      const finnhubPrice = binancePrice ? null : await fetchFinnhubPrice(asset.symbol, key);
      const price = binancePrice || finnhubPrice || 0;
      const priceSource = binancePrice ? "Binance" : finnhubPrice ? "Finnhub fallback" : "Unavailable";

      let high = asset.manualHigh;
      let highType = asset.highType || "52週高點";

      if (!high) {
        high = await fetchFinnhubHigh(asset.symbol, key);
      }

      const discount =
        high > 0 && price > 0
          ? Number((((price - high) / high) * 100).toFixed(1))
          : 0;

      const signal = getSignal(discount, asset.rules, asset.amounts);

      results.push({
        ...asset,
        price,
        priceSource,
        high,
        highType,
        discount,
        signal
      });
    }

    res.status(200).json({
      updatedAt: new Date().toISOString(),
      source: "Binance realtime price + Finnhub high/fallback",
      count: results.length,
      data: results
    });
  } catch (error) {
    res.status(500).json({
      error: "price_fetch_failed",
      message: error.message
    });
  }
}
