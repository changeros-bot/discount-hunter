const ASSETS = [
  {
    symbol: "0050",
    yahooSymbol: "0050.TW",
    name: "元大台灣50",
    currency: "TWD",
    monthlyAmount: 2000,
    rules: [-10, -20, -30, -40],
    amounts: [2000, 4000, 6000, 8000],
  },
  {
    symbol: "VOO",
    yahooSymbol: "VOO",
    name: "Vanguard S&P 500 ETF",
    currency: "USD",
    monthlyAmount: 30,
    rules: [-10, -20, -30, -40],
    amounts: [30, 60, 90, 120],
  },
  {
    symbol: "QQQM",
    yahooSymbol: "QQQM",
    name: "Invesco NASDAQ 100 ETF",
    currency: "USD",
    monthlyAmount: 30,
    rules: [-15, -25, -35, -45],
    amounts: [30, 60, 90, 120],
  },
];

function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function maxPositive(values = []) {
  return values.reduce((max, value) => {
    const n = number(value);
    return n > max ? n : max;
  }, 0);
}

function minPositive(values = []) {
  const list = values.map(number).filter((value) => value > 0);
  return list.length ? Math.min(...list) : 0;
}

function lastPositive(values = []) {
  for (let i = values.length - 1; i >= 0; i -= 1) {
    const n = number(values[i]);
    if (n > 0) return n;
  }
  return 0;
}

function getLevel(discount, rules, amounts, currency) {
  let active = 0;
  for (let i = 0; i < rules.length; i += 1) {
    if (discount <= rules[i]) active = i + 1;
  }
  const nextIndex = active;
  return {
    active,
    label: active ? `第 ${active} 層買點` : "尚未到買點",
    buyAmount: active ? amounts[active - 1] : 0,
    buyCurrency: currency,
    nextRule: rules[nextIndex] ?? null,
    nextAmount: amounts[nextIndex] ?? null,
  };
}

async function fetchQuote(asset) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(asset.yahooSymbol)}?range=1y&interval=1d&includePrePost=false`;
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      accept: "application/json,text/plain,*/*",
      "user-agent": "Mozilla/5.0 (Josh Fubon DCA Price Engine)",
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Yahoo ${response.status}: ${text.slice(0, 100)}`);
  const result = JSON.parse(text)?.chart?.result?.[0];
  if (!result) throw new Error("Yahoo quote missing");

  const meta = result.meta || {};
  const quote = result.indicators?.quote?.[0] || {};
  const closes = quote.close || [];
  const highs = quote.high || [];
  const lows = quote.low || [];
  const price = number(meta.regularMarketPrice) || lastPositive(closes) || number(meta.previousClose);
  const high52w = number(meta.fiftyTwoWeekHigh) || maxPositive(highs);
  const low52w = number(meta.fiftyTwoWeekLow) || minPositive(lows);
  const discountRaw = price > 0 && high52w > 0 ? ((price - high52w) / high52w) * 100 : null;
  const discount = discountRaw === null ? null : Number(discountRaw.toFixed(2));

  return {
    ...asset,
    price,
    high52w,
    low52w,
    discount,
    level: discount === null ? null : getLevel(discount, asset.rules, asset.amounts, asset.currency),
    marketTime: meta.regularMarketTime || null,
    exchange: meta.fullExchangeName || meta.exchangeName || null,
    source: "Yahoo Finance 1Y daily chart",
    status: price > 0 && high52w > 0 ? "LIVE" : "MISSING",
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  const checkedAt = new Date().toISOString();
  const quotes = await Promise.all(
    ASSETS.map(async (asset) => {
      try {
        return await fetchQuote(asset);
      } catch (error) {
        return { ...asset, price: 0, high52w: 0, low52w: 0, discount: null, level: null, status: "ERROR", error: error.message };
      }
    })
  );
  res.status(200).json({ ok: quotes.some((item) => item.status === "LIVE"), checkedAt, quotes });
}
