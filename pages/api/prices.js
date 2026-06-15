const BINANCE_PRICE_ENDPOINT = "https://api.binance.com/api/v3/ticker/price";
const BINANCE_KLINES_ENDPOINT = "https://api.binance.com/api/v3/klines";

const assets = [
  { symbol: "QQQon", binanceSymbol: "QQQONUSDT", name: "Invesco QQQ", grade: "A+", description: "核心ETF｜Nasdaq 100", rules: [-15, -25, -35, -50], amounts: [5, 10, 15, 20] },
  { symbol: "NVDAon", binanceSymbol: "NVDAONUSDT", name: "NVIDIA", grade: "A", description: "AI GPU核心龍頭", rules: [-15, -25, -35, -50], amounts: [5, 10, 15, 20] },
  { symbol: "TSMon", binanceSymbol: "TSMONUSDT", name: "Taiwan Semiconductor", grade: "A", description: "全球先進製程龍頭", rules: [-15, -25, -35, -50], amounts: [5, 10, 15, 20] },
  { symbol: "AVGOon", binanceSymbol: "AVGOONUSDT", name: "Broadcom", grade: "A", description: "AI網路 + ASIC龍頭", rules: [-15, -25, -35, -50], amounts: [5, 10, 15, 20] },
  { symbol: "SPCXon", binanceSymbol: "SPCXONUSDT", name: "SpaceX", grade: "A-", description: "高成長太空龍頭", rules: [-20, -35, -50, -65], amounts: [5, 10, 15, 20] },
  { symbol: "GOOGLon", binanceSymbol: "GOOGLONUSDT", name: "Alphabet", grade: "B", description: "AI + 搜尋 + 雲端", rules: [-20, -35, -50, -65], amounts: [5, 10, 15, 20] },
  { symbol: "AMDon", binanceSymbol: "AMDONUSDT", name: "Advanced Micro Devices", grade: "B", description: "AI GPU挑戰者", rules: [-20, -35, -50, -65], amounts: [5, 10, 15, 20] },
  { symbol: "MRVLon", binanceSymbol: "MRVLONUSDT", name: "Marvell", grade: "B", description: "AI網通與ASIC供應鏈", rules: [-20, -35, -50, -65], amounts: [5, 10, 15, 20] },
  { symbol: "RKLBon", binanceSymbol: "RKLBOΝUSDT", fallbackBinanceSymbol: "RKLBONUSDT", name: "Rocket Lab", grade: "C", description: "高風險太空成長股", rules: [-25, -40, -60], amounts: [5, 10, 15] }
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

function isValidPrice(price) {
  return Number.isFinite(price) && price > 0;
}

async function fetchBinanceJson(url) {
  const response = await fetch(url);
  if (!response.ok) return null;
  return response.json();
}

async function fetchBinancePrice(asset) {
  const candidates = [asset.binanceSymbol, asset.fallbackBinanceSymbol].filter(Boolean);

  for (const symbol of candidates) {
    const url = `${BINANCE_PRICE_ENDPOINT}?symbol=${symbol}`;
    const data = await fetchBinanceJson(url);
    const price = Number(data?.price || 0);

    if (isValidPrice(price)) {
      return { price, resolvedSymbol: symbol };
    }
  }

  return { price: 0, resolvedSymbol: candidates[0] || asset.symbol };
}

async function fetchBinance52WeekHigh(binanceSymbol) {
  if (!binanceSymbol) return 0;

  const url = `${BINANCE_KLINES_ENDPOINT}?symbol=${binanceSymbol}&interval=1d&limit=365`;
  const data = await fetchBinanceJson(url);

  if (!Array.isArray(data)) return 0;

  const highs = data
    .map((candle) => Number(candle?.[2] || 0))
    .filter(isValidPrice);

  if (highs.length === 0) return 0;

  return Number(Math.max(...highs).toFixed(4));
}

export default async function handler(req, res) {
  try {
    const results = [];

    for (const asset of assets) {
      const { price, resolvedSymbol } = await fetchBinancePrice(asset);
      const high = await fetchBinance52WeekHigh(resolvedSymbol);
      const highType = "Binance 52週高點";

      const discount =
        high > 0 && price > 0
          ? Number((((price - high) / high) * 100).toFixed(1))
          : 0;

      const signal = getSignal(discount, asset.rules, asset.amounts);

      results.push({
        ...asset,
        binanceSymbol: resolvedSymbol,
        price,
        priceSource: "Binance",
        high,
        highType,
        discount,
        signal
      });
    }

    res.status(200).json({
      updatedAt: new Date().toISOString(),
      source: "Binance realtime price + Binance 52w high",
      count: results.length,
      data: results
    });
  } catch (error) {
    res.status(500).json({
      error: "binance_price_fetch_failed",
      message: error.message
    });
  }
}
