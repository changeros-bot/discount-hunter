const DAY = 24 * 60 * 60 * 1000;
const START = new Date("2016-07-14T00:00:00Z");
const END = new Date("2026-07-15T00:00:00Z");
const MONTHLY_BUDGET = 100;

const ASSETS = [
  { symbol: "QQQ", yahoo: "QQQ", rules: [-15,-25,-35], amounts: [5,10,15], dca: 10, dip: 0, mode: "stock" },
  { symbol: "NVDA", yahoo: "NVDA", rules: [-25,-35,-45,-60], amounts: [5,10,15,20], dca: 5, dip: 5, mode: "stock" },
  { symbol: "TSM", yahoo: "TSM", rules: [-25,-35,-45,-60], amounts: [5,10,15,20], dca: 5, dip: 5, mode: "stock" },
  { symbol: "AVGO", yahoo: "AVGO", rules: [-25,-35,-45,-60], amounts: [5,10,15,20], dca: 5, dip: 5, mode: "stock" },
  { symbol: "GOOGL", yahoo: "GOOGL", rules: [-20,-30,-40], amounts: [5,10,15], dca: 5, dip: 5, mode: "stock" },
  { symbol: "AMD", yahoo: "AMD", rules: [-25,-35,-45,-60], amounts: [5,5,10,15], dca: 0, dip: 10, mode: "stock" },
  { symbol: "MRVL", yahoo: "MRVL", rules: [-25,-35,-45,-60], amounts: [5,10,10,15], dca: 0, dip: 10, mode: "stock" },
  { symbol: "RKLB", yahoo: "RKLB", rules: [-50,-65,-80], amounts: [5,10,15], dca: 0, dip: 10, mode: "stock" },
  { symbol: "BTC", yahoo: "BTC-USD", rules: [-25,-40,-55,-70,-85], amounts: [5,15,30,25,25], dca: 5, dip: 5, mode: "cycle" },
  { symbol: "SPCX", yahoo: null, rules: [-20,-35,-50,-65], amounts: [5,10,15,20], dca: 0, dip: 10, mode: "unavailable" }
];

function safeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function monthKey(ts) {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}`;
}

function yearsBetween(a,b){ return (b-a)/(365.25*DAY); }

async function fetchYahoo(symbol) {
  const p1 = Math.floor(START.getTime()/1000);
  const p2 = Math.floor(END.getTime()/1000);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${p1}&period2=${p2}&interval=1d&events=div%2Csplits&includeAdjustedClose=true`;
  const res = await fetch(url, { cache: "no-store", headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`${symbol}: yahoo_http_${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(`${symbol}: yahoo_empty`);
  const ts = result.timestamp || [];
  const q = result.indicators?.quote?.[0] || {};
  const adj = result.indicators?.adjclose?.[0]?.adjclose || [];
  const rows = [];
  for (let i=0;i<ts.length;i++) {
    const close = safeNumber(adj[i] ?? q.close?.[i]);
    const high = safeNumber(q.high?.[i] ?? close);
    if (close > 0) rows.push({ ts: ts[i]*1000, close, high });
  }
  return rows.filter(r => r.ts >= START.getTime() && r.ts < END.getTime());
}

function firstTradeOnOrAfter14(rows) {
  const map = new Map();
  for (const row of rows) {
    const d = new Date(row.ts);
    if (d.getUTCDate() < 14) continue;
    const key = monthKey(row.ts);
    if (!map.has(key)) map.set(key,row.ts);
  }
  return map;
}

function computeReference(rows, mode) {
  let allTimeHigh = 0;
  const highWindow = [];
  return rows.map((row) => {
    let reference = 0;
    let reset = false;
    if (mode === "cycle") {
      if (row.high > allTimeHigh) {
        allTimeHigh = row.high;
        reset = true;
      }
      reference = allTimeHigh;
    } else {
      highWindow.push({ ts: row.ts, high: row.high });
      while (highWindow.length && highWindow[0].ts < row.ts - 365*DAY) highWindow.shift();
      const previous = reference;
      reference = highWindow.reduce((m,x)=>Math.max(m,x.high),0);
      if (previous > 0 && reference > previous + 1e-9) reset = true;
      if (highWindow.length === 1) reset = true;
    }
    const dd = reference > 0 ? (row.close/reference - 1)*100 : 0;
    return { ...row, reference, dd, reset };
  });
}

function buy(state, amount, price, kind) {
  if (!(amount > 0) || !(price > 0) || state.cash + 1e-9 < amount) return false;
  state.cash -= amount;
  state.shares += amount / price;
  state.invested += amount;
  state[kind] += amount;
  return true;
}

function simulateAsset(asset, rows, strategy) {
  const state = { cash:0, shares:0, contributed:0, invested:0, dcaInvested:0, dipInvested:0, dipBuys:0, dcaBuys:0 };
  const monthlyDates = firstTradeOnOrAfter14(rows);
  const monthlySeen = new Set();
  let completed = new Set();
  let listed = false;
  const prepared = computeReference(rows, asset.mode);

  for (const row of prepared) {
    const key = monthKey(row.ts);
    if (!listed) listed = true;

    if (monthlyDates.get(key) === row.ts && !monthlySeen.has(key)) {
      monthlySeen.add(key);
      if (strategy === "pure_dca") {
        state.cash += 10;
        state.contributed += 10;
        if (buy(state,10,row.close,"dcaInvested")) state.dcaBuys += 1;
      } else {
        state.cash += asset.dca + asset.dip;
        state.contributed += asset.dca + asset.dip;
        if (asset.dca > 0 && buy(state,asset.dca,row.close,"dcaInvested")) state.dcaBuys += 1;
      }
    }

    if (strategy === "hybrid" && asset.dip > 0) {
      if (row.reset) completed = new Set();
      for (let i=0;i<asset.rules.length;i++) {
        if (!completed.has(i) && row.dd <= asset.rules[i]) {
          const amount = asset.amounts[i];
          if (buy(state,amount,row.close,"dipInvested")) {
            completed.add(i);
            state.dipBuys += 1;
          }
        }
      }
    }
  }

  const last = prepared[prepared.length-1];
  const price = last?.close || 0;
  const marketValue = state.shares * price;
  const totalValue = marketValue + state.cash;
  const pnl = totalValue - state.contributed;
  return {
    symbol: asset.symbol,
    firstDate: prepared[0] ? new Date(prepared[0].ts).toISOString().slice(0,10) : null,
    lastDate: last ? new Date(last.ts).toISOString().slice(0,10) : null,
    contributed: state.contributed,
    invested: state.invested,
    cash: state.cash,
    shares: state.shares,
    lastPrice: price,
    marketValue,
    totalValue,
    pnl,
    returnPct: state.contributed > 0 ? pnl/state.contributed : 0,
    dcaInvested: state.dcaInvested,
    dipInvested: state.dipInvested,
    dcaBuys: state.dcaBuys,
    dipBuys: state.dipBuys
  };
}

function unavailableResult(asset) {
  const months = [];
  let d = new Date(Date.UTC(START.getUTCFullYear(),START.getUTCMonth(),1));
  const end = END.getTime();
  while (d.getTime() < end) { months.push(new Date(d)); d.setUTCMonth(d.getUTCMonth()+1); }
  const contributed = months.length * 10;
  return {
    symbol: asset.symbol,
    firstDate: null,
    lastDate: null,
    contributed,
    invested:0,
    cash:contributed,
    shares:0,
    lastPrice:0,
    marketValue:0,
    totalValue:contributed,
    pnl:0,
    returnPct:0,
    dcaInvested:0,
    dipInvested:0,
    dcaBuys:0,
    dipBuys:0,
    note:"缺乏可驗證十年公開歷史價格，整個袖套保留現金。"
  };
}

function summarize(rows) {
  const sum = (key) => rows.reduce((a,b)=>a+safeNumber(b[key]),0);
  const contributed = sum("contributed");
  const totalValue = sum("totalValue");
  const pnl = totalValue - contributed;
  const years = yearsBetween(START.getTime(),END.getTime());
  return {
    contributed,
    invested:sum("invested"),
    cash:sum("cash"),
    marketValue:sum("marketValue"),
    totalValue,
    pnl,
    returnPct: contributed > 0 ? pnl/contributed : 0,
    annualizedApprox: contributed > 0 && totalValue > 0 ? Math.pow(totalValue/contributed,1/years)-1 : 0,
    dcaInvested:sum("dcaInvested"),
    dipInvested:sum("dipInvested"),
    dcaBuys:sum("dcaBuys"),
    dipBuys:sum("dipBuys")
  };
}

module.exports = async function handler(req,res) {
  res.setHeader("Cache-Control","no-store");
  try {
    const fetched = await Promise.all(ASSETS.filter(a=>a.yahoo).map(async asset => [asset.symbol, await fetchYahoo(asset.yahoo)]));
    const map = new Map(fetched);
    const pure = [];
    const hybrid = [];
    for (const asset of ASSETS) {
      if (!asset.yahoo) {
        pure.push(unavailableResult(asset));
        hybrid.push(unavailableResult(asset));
      } else {
        const rows = map.get(asset.symbol) || [];
        pure.push(simulateAsset(asset,rows,"pure_dca"));
        hybrid.push(simulateAsset(asset,rows,"hybrid"));
      }
    }
    return res.status(200).json({
      ok:true,
      methodology:{
        period:[START.toISOString().slice(0,10), new Date(END.getTime()-DAY).toISOString().slice(0,10)],
        monthlyBudget:MONTHLY_BUDGET,
        monthlyBuyDay:"每月第一個落在14日或之後的交易日",
        pureDca:"十個袖套各10U；未上市或無資料袖套保留現金",
        hybrid:"QQQ 10U DCA；NVDA/TSM/AVGO/GOOGL/BTC 各5U DCA+5U逢低；AMD/MRVL/RKLB/SPCX各10U逢低",
        stockReference:"滾動365日高點；高點上移後重置該週期已完成D層",
        btcReference:"歷史新高；創新高後重置D層",
        dipExecution:"同一高點週期每層只買一次，按V17各資產層級金額，現金不足則不買",
        prices:"Yahoo Finance adjusted close；忽略稅、手續費與滑價",
        caveat:"近十年回測存在存活者偏差；SPCX無可驗證十年行情"
      },
      pureDca:{ summary:summarize(pure), assets:pure },
      hybrid:{ summary:summarize(hybrid), assets:hybrid },
      difference:{
        totalValue:summarize(hybrid).totalValue-summarize(pure).totalValue,
        pnl:summarize(hybrid).pnl-summarize(pure).pnl,
        returnPctPoints:(summarize(hybrid).returnPct-summarize(pure).returnPct)*100
      },
      generatedAt:new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({ ok:false, error:error.message || "backtest_failed" });
  }
};
