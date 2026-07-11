const YAHOO_QUOTE_URL = "https://query1.finance.yahoo.com/v7/finance/quote";

export const PAPER_STOCK_SYMBOLS = [
  // Market45 / sector module
  "NOW", "QCOM", "DELL", "REGN",
  // Market91 audit paper
  "MA", "V", "PWR", "CEG", "COST", "GEV", "LLY", "SPOT", "TMUS", "ACN",
  // Market10 discount candidates
  "MSFT", "NFLX", "ADBE", "SOFI",
];

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function uniqueSymbols(symbols = []) {
  return [...new Set(symbols.map((s) => String(s || "").trim().toUpperCase().replace(/ON$/, "")).filter(Boolean))];
}

function getSignal(discount, rules = [], amounts = []) {
  for (let i = rules.length - 1; i >= 0; i -= 1) {
    if (discount <= Number(rules[i])) return { text: `第${i + 1}買點`, amount: `${amounts[i] || 0}U`, level: i + 1 };
  }
  return { text: "尚未到買點", amount: "0U", level: 0 };
}

function normalizeYahooRow(row, asset = {}) {
  const price = num(row?.regularMarketPrice || row?.postMarketPrice || row?.preMarketPrice || row?.bid || row?.ask);
  const high = num(row?.fiftyTwoWeekHigh);
  const low = num(row?.fiftyTwoWeekLow);
  const discountRaw = high > 0 && price > 0 ? ((price - high) / high) * 100 : null;
  const discount = discountRaw === null ? null : Number(discountRaw.toFixed(1));
  const rules = Array.isArray(asset.rules) ? asset.rules : [];
  const amounts = Array.isArray(asset.amounts) ? asset.amounts : [];
  return {
    symbol: row?.symbol || asset.symbol,
    name: row?.shortName || row?.longName || asset.name || row?.symbol,
    ...asset,
    price,
    stockPrice: price,
    tokenPrice: price,
    rawTokenPrice: price,
    high,
    low,
    high52w: high,
    low52w: low,
    marketCap: num(row?.marketCap),
    volume: num(row?.regularMarketVolume),
    highType: "Yahoo 52週高點",
    lowType: "Yahoo 52週低點",
    priceSource: "Yahoo Finance quote",
    discount,
    discountRaw,
    signal: discount === null ? { text: "資料未就緒", amount: "0U", level: 0 } : getSignal(discount, rules, amounts),
    quoteAudit: {
      status: price > 0 ? "PASS" : "MISSING_PRICE",
      provider: "Yahoo Finance quote",
      checkedAt: new Date().toISOString(),
      regularMarketTime: row?.regularMarketTime || null,
      exchange: row?.fullExchangeName || row?.exchange || null,
    },
  };
}

export async function fetchYahooStockQuotes(symbols = [], assetMap = {}) {
  const list = uniqueSymbols(symbols);
  if (!list.length) return [];
  try {
    const url = `${YAHOO_QUOTE_URL}?symbols=${encodeURIComponent(list.join(","))}`;
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        accept: "application/json,text/plain,*/*",
        "user-agent": "Mozilla/5.0 (V17 Paper Quote Provider)",
      },
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Yahoo quote ${response.status}: ${text.slice(0, 120)}`);
    const json = JSON.parse(text);
    const rows = Array.isArray(json?.quoteResponse?.result) ? json.quoteResponse.result : [];
    const bySymbol = new Map(rows.map((row) => [String(row.symbol || "").toUpperCase(), row]));
    return list.map((symbol) => {
      const asset = assetMap[symbol] || { symbol };
      const row = bySymbol.get(symbol);
      if (!row) {
        return {
          ...asset,
          symbol,
          price: 0,
          stockPrice: 0,
          tokenPrice: 0,
          rawTokenPrice: 0,
          high: 0,
          low: 0,
          high52w: 0,
          low52w: 0,
          priceSource: "Yahoo Finance quote",
          discount: null,
          discountRaw: null,
          signal: { text: "Yahoo 無資料", amount: "0U", level: 0 },
          quoteAudit: { status: "MISSING_SYMBOL", provider: "Yahoo Finance quote", checkedAt: new Date().toISOString() },
        };
      }
      return normalizeYahooRow(row, asset);
    });
  } catch (error) {
    return list.map((symbol) => ({
      ...(assetMap[symbol] || { symbol }),
      symbol,
      price: 0,
      stockPrice: 0,
      tokenPrice: 0,
      rawTokenPrice: 0,
      high: 0,
      low: 0,
      high52w: 0,
      low52w: 0,
      priceSource: "Yahoo Finance quote",
      discount: null,
      discountRaw: null,
      signal: { text: "Yahoo 報價失敗", amount: "0U", level: 0 },
      quoteAudit: { status: "PROVIDER_ERROR", provider: "Yahoo Finance quote", error: error.message, checkedAt: new Date().toISOString() },
    }));
  }
}
