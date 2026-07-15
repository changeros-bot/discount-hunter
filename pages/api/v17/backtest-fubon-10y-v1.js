const START=new Date('2016-07-15T00:00:00Z');
const END=new Date('2026-07-15T00:00:00Z');
const CFG={
  '0050':{ticker:'0050.TW',currency:'TWD',monthly:2000},
  'VOO':{ticker:'VOO',currency:'USD',monthly:30},
  'QQQM':{ticker:'QQQM',proxy:'QQQ',currency:'USD',monthly:30}
};
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const dateKey=t=>new Date(t).toISOString().slice(0,10);
const monthKey=t=>dateKey(t).slice(0,7);
async function yf(symbol){
  const p1=Math.floor(START.getTime()/1000),p2=Math.floor(END.getTime()/1000);
  const u=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${p1}&period2=${p2}&interval=1d&events=div%2Csplits&includeAdjustedClose=true`;
  const r=await fetch(u,{cache:'no-store',headers:{'User-Agent':'Mozilla/5.0'}});
  if(!r.ok)throw new Error(`${symbol}:${r.status}`);
  const z=(await r.json())?.chart?.result?.[0];
  if(!z)throw new Error(`${symbol}:empty`);
  const ts=z.timestamp||[],q=z.indicators?.quote?.[0]||{},a=z.indicators?.adjclose?.[0]?.adjclose||[],rows=[];
  for(let i=0;i<ts.length;i++){
    const raw=num(q.close?.[i]),adj=num(a[i]??raw);
    if(!(raw>0&&adj>0))continue;
    rows.push({ts:ts[i]*1000,price:adj});
  }
  return rows.filter(x=>x.ts>=START&&x.ts<END);
}
function monthlyDates(rows){
  const m=new Map();
  for(const x of rows){
    if(new Date(x.ts).getUTCDate()<12)continue;
    const k=monthKey(x.ts);
    if(!m.has(k))m.set(k,x.ts);
  }
  return m;
}
function stats(cashflows,finalValue,startTs,endTs){
  const invested=cashflows.reduce((s,x)=>s+x.amount,0);
  const profit=finalValue-invested;
  const years=(endTs-startTs)/(365.25*86400000);
  const cagr=invested>0&&years>0?Math.pow(finalValue/invested,1/years)-1:null;
  return {invested,finalValue,profit,totalReturn:invested?profit/invested:null,capitalMultiple:invested?finalValue/invested:null,simpleCagrOnTotalContributions:cagr};
}
function simulate(name,rows,fxRows,{proxyMode=false}={}){
  const cfg=CFG[name],dates=monthlyDates(rows),fxMap=new Map((fxRows||[]).map(x=>[dateKey(x.ts),x.price]));
  let shares=0,last=0;const cashflows=[];let firstTs=null,lastTs=null,purchases=0;
  for(const x of rows){
    last=x.price;
    const mk=monthKey(x.ts);
    if(dates.get(mk)!==x.ts)continue;
    let amountLocal=cfg.monthly,amountUsd=cfg.monthly;
    if(cfg.currency==='TWD'){
      const fx=fxMap.get(dateKey(x.ts));
      if(!(fx>0))continue;
      amountUsd=amountLocal/fx;
    }
    shares+=amountLocal/x.price;
    cashflows.push({ts:x.ts,amount:amountUsd});
    firstTs??=x.ts;lastTs=x.ts;purchases++;
  }
  let finalValueLocal=shares*last,finalValueUsd=finalValueLocal;
  if(cfg.currency==='TWD'){
    const lastFx=[...(fxRows||[])].reverse().find(x=>x.ts<=END.getTime())?.price;
    finalValueUsd=lastFx?finalValueLocal/lastFx:null;
  }
  return {symbol:name,sourceTicker:proxyMode?cfg.proxy:cfg.ticker,mode:proxyMode?'proxy-history':'actual-listing-history',monthlyAmount:cfg.monthly,currency:cfg.currency,purchases,firstPurchase:firstTs?dateKey(firstTs):null,lastPurchase:lastTs?dateKey(lastTs):null,shares,finalPrice:last,finalValueLocal,finalValueUsd,stats:stats(cashflows,finalValueUsd,firstTs||START.getTime(),END.getTime())};
}
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  try{
    const [[,r0050],[,rVOO],[,rQQQM],[,rQQQ],[,rFX]]=await Promise.all([
      yf('0050.TW').then(x=>['0050',x]),
      yf('VOO').then(x=>['VOO',x]),
      yf('QQQM').then(x=>['QQQM',x]),
      yf('QQQ').then(x=>['QQQ',x]),
      yf('TWD=X').then(x=>['FX',x])
    ]);
    const actual=[simulate('0050',r0050,rFX),simulate('VOO',rVOO),simulate('QQQM',rQQQM)];
    const proxy=[simulate('0050',r0050,rFX),simulate('VOO',rVOO),simulate('QQQM',rQQQ,null,{proxyMode:true})];
    const summarize=rows=>({
      totalInvestedUsd:rows.reduce((s,x)=>s+num(x.stats.invested),0),
      finalValueUsd:rows.reduce((s,x)=>s+num(x.finalValueUsd),0),
      profitUsd:rows.reduce((s,x)=>s+num(x.stats.profit),0),
      capitalMultiple:rows.reduce((s,x)=>s+num(x.finalValueUsd),0)/rows.reduce((s,x)=>s+num(x.stats.invested),0)
    });
    res.status(200).json({
      ok:true,
      version:'fubon-10y-v1',
      period:{start:dateKey(START),endExclusive:dateKey(END)},
      assumptions:{
        monthlyPlan:{'0050':'TWD 2,000','VOO':'USD 30','QQQM':'USD 30'},
        purchaseDate:'first trading day on or after calendar day 12 each month',
        dividends:'adjusted-close approximation, treated as reinvested',
        feesTaxesFxCosts:'excluded',
        fxFor0050:'Yahoo TWD=X, interpreted as TWD per USD',
        qqqmCaveat:'QQQM did not exist for the full 10-year period. Both actual-listing and QQQ-proxy views are shown.',
        cagrCaveat:'simpleCagrOnTotalContributions is not XIRR and should not be treated as money-weighted annual return'
      },
      actualListing:{assets:actual,portfolio:summarize(actual)},
      tenYearProxy:{assets:proxy,portfolio:summarize(proxy)},
      generatedAt:new Date().toISOString()
    });
  }catch(e){res.status(500).json({ok:false,error:e.message});}
};
