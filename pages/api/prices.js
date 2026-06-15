const ONDO_BASE_URL = "https://api.gm.ondo.finance/v1/assets";

const assets = [
  { symbol: "QQQon", name: "Invesco QQQ", grade: "A+", description: "核心ETF｜Nasdaq 100", rules: [-15, -25, -35, -50], amounts: [5, 10, 15, 20] },
  { symbol: "NVDAon", name: "NVIDIA", grade: "A", description: "AI GPU核心龍頭", rules: [-15, -25, -35, -50], amounts: [5, 10, 15, 20] },
  { symbol: "TSMon", name: "Taiwan Semiconductor", grade: "A", description: "全球先進製程龍頭", rules: [-15, -25, -35, -50], amounts: [5, 10, 15, 20] },
  { symbol: "AVGOon", name: "Broadcom", grade: "A", description: "AI網路 + ASIC龍頭", rules: [-15, -25, -35, -50], amounts: [5, 10, 15, 20] },
  { symbol: "SPCXon", name: "SpaceX", grade: "A-", description: "高成長太空龍頭", rules: [-20, -35, -50, -65], amounts: [5, 10, 15, 20] },
  { symbol: "GOOGLon", name: "Alphabet", grade: "B", description: "AI + 搜尋 + 雲端", rules: [-20, -35, -50, -65], amounts: [5, 10, 15, 20] },
  { symbol: "AMDon", name: "Advanced Micro Devices", grade: "B", description: "AI GPU挑戰者", rules: [-20, -35, -50, -65], amounts: [5, 10, 15, 20] },
  { symbol: "MRVLon", name: "Marvell", grade: "B", description: "AI網通與ASIC供應鏈", rules: [-20, -35, -50, -65], amounts: [5, 10, 15, 20] },
  { symbol: "RKLBon", name: "Rocket Lab", grade: "C", description: "高風險太空成長股", rules: [-25, -40, -60], amounts: [5, 10, 15] }
];

function getSignal(discount, rules, amounts) {
  for (let i = rules.length - 1; i >= 0; i--) {
    if (discount <= rules[i]) {
      return { text: `第${i + 1}買點`, amount: `${amounts[i]}U`, level: i + 1 };
    }
  }
  return { text: "尚未到買點", amount: "0U", level: 0 };
}

function num(value) {
  const n = Number(String(value ?? "0").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function firstNumber(...values) {
  for (const value of values) {
    const n = num(value);
    if (n > 0) return n;
  }
  return 0;
}

async function getOndoMarket(symbol, key) {
  const response = await fetch(`${ONDO_BASE_URL}/${symbol}/market`, {
    headers: { "x-api-key": key, accept: "application/json" }
  });
  if (!response.ok) throw new Error(`${symbol} ${response.status}`);
  return response.json();
}

function normalize(asset, raw) {
  const root = raw?.data || raw || {};
  const primary = root.primaryMarket || {};
  const underlying = root.underlyingMarket || {};

  const price = firstNumber(primary.price, primary.currentPrice, primary.lastPrice, underlying.price, root.price);
  const high = firstNumber(underlying.priceHigh52w, underlying.week52High, underlying.fiftyTwoWeekHigh, root.priceHigh52w, root.week52High);
  const low = firstNumber(underlying.priceLow52w, underlying.week52Low, underlying.fiftyTwoWeekLow, root.priceLow52w, root.week52Low);
  const marketCap = firstNumber(underlying.marketCap, root.marketCap);
  const volume = firstNumber(underlying.volume, root.volume);

  const discount = high > 0 && price > 0 ? Number((((price - high) / high) * 100).toFixed(1)) : null;
  const signal = discount === null ? { text: "資料未就緒", amount: "0U", level: 0 } : getSignal(discount, asset.rules, asset.amounts);

  return {
    ...asset,
    price,
    high,
    low,
    marketCap,
    volume,
    highType: "Ondo 52週高點",
    lowType: "Ondo 52週低點",
    priceSource: "Ondo GM API",
    discount,
    signal
  };
}

export default async function handler(req, res) {
  const key = process.env.ONDO_API_KEY;

  if (!key) {
    return res.status(200).json({
      updatedAt: new Date().toISOString(),
      source: "Ondo GM API",
      count: 0,
      data: [],
      warning: "missing_ondo_api_key"
    });
  }

  try {
    const data = await Promise.all(
      assets.map(async (asset) => normalize(asset, await getOndoMarket(asset.symbol, key)))
    );

    res.status(200).json({
      updatedAt: new Date().toISOString(),
      source: "Ondo GM API market endpoint",
      count: data.length,
      data
    });
  } catch (error) {
    res.status(500).json({ error: "ondo_market_fetch_failed", message: error.message });
  }
}
