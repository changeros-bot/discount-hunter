const ASSETS = [
  {
    symbol: "0050",
    yahooSymbol: "0050.TW",
    name: "元大台灣50",
    currency: "TWD",
    monthlyAmount: 2000,
    rules: [-10, -20, -30, -40],
    amounts: [2000, 4000, 6000, 8000],
    ladderEnabled: true,
    holding: {
      shares: 37,
      cost: 3867,
      brokerMarketValue: 3899,
      averageCost: 104.51,
      brokerPnl: 32,
      brokerPnlPct: 0.83,
      snapshotAt: "2026-07-14T07:28:00+08:00",
    },
  },
  {
    symbol: "VOO",
    yahooSymbol: "VOO",
    name: "Vanguard S&P 500 ETF",
    currency: "USD",
    monthlyAmount: 30,
    rules: [],
    amounts: [],
    ladderEnabled: false,
    holding: {
      shares: 0.04411,
      cost: 30.09,
      brokerMarketValue: 30.61,
      averageCost: 682.15824,
      brokerPnl: 0.52,
      brokerPnlPct: 1.73,
      fxRate: 32.2775,
      marketValueTwd: 988,
      pnlTwd: 17,
      snapshotAt: "2026-07-14T07:29:00+08:00",
    },
  },
  {
    symbol: "QQQM",
    yahooSymbol: "QQQM",
    name: "Invesco NASDAQ 100 ETF",
    currency: "USD",
    monthlyAmount: 30,
    rules: [],
    amounts: [],
    ladderEnabled: false,
    holding: {
      shares: 0,
      cost: 0,
      brokerMarketValue: 0,
      averageCost: 0,
      brokerPnl: 0,
      brokerPnlPct: 0,
      snapshotAt: "2026-07-14T07:29:00+08:00",
    },
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
  if (!rules.length) return null;
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
  const liveMarketValue = asset.holding.shares > 0 ? Number((price * asset.holding.shares).toFixed(2)) : 0;
  const livePnl = asset.holding.shares > 0 ? Number((liveMarketValue - asset.holding.cost).toFixed(2)) : 0;
  const livePnlPct = asset.holding.cost > 0 ? Number(((livePnl / asset.holding.cost) * 100).toFixed(2)) : 0;

  return {
    ...asset,
    price,
    high52w,
    low52w,
    discount,
    level: asset.ladderEnabled && discount !== null ? getLevel(discount, asset.rules, asset.amounts, asset.currency) : null,
    liveHolding: {
      marketValue: liveMarketValue,
      pnl: livePnl,
      pnlPct: livePnlPct,
    },
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
        return { ...asset, price: 0, high52w: 0, low52w: 0, discount: null, level: null, liveHolding: null, status: "ERROR", error: error.message };
      }
    })
  );
  res.status(200).json({ ok: quotes.some((item) => item.status === "LIVE"), checkedAt, quotes });
}
