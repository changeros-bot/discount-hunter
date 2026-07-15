const START=new Date('2016-08-01T00:00:00Z');
const END=new Date('2026-08-01T00:00:00Z');
const CFG={
  '0050':{ticker:'0050.TW',currency:'TWD',monthly:2000},
  'VOO':{ticker:'VOO',currency:'USD',monthly:30},
  'QQQM':{ticker:'QQQM',proxy:'QQQ',currency:'USD',monthly:30}
};
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const dateKey=t=>new Date(t).toISOString().slice(0,10);
const monthKey=t=>dateKey(t).slice(0,7);
async function yf(symbol){
  const p1=Math.floor(START.getTime()/1000)-86400*10,p2=Math.floor(END.getTime()/1000)+86400*2;
  const u=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${p1}&period2=${p2}&interval=1d&events=div%2Csplits&includeAdjustedClose=true`;
  const r=await fetch(u,{cache:'no-store',headers:{'User-Agent':'Mozilla/5.0'}});
  if(!r.ok)throw new Error(`${symbol}:${r.status}`);
  const z=(await r.json())?.chart?.result?.[0];if(!z)throw new Error(`${symbol}:empty`);
  const ts=z.timestamp||[],q=z.indicators?.quote?.[0]||{},a=z.indicators?.adjclose?.[0]?.adjclose||[],rows=[];
  for(let i=0;i<ts.length;i++){const raw=num(q.close?.[i]),adj=num(a[i]??raw);if(raw>0&&adj>0)rows.push({ts:ts[i]*1000,price:adj});}
  return rows.sort((x,y)=>x.ts-y.ts);
}
function monthlyDates(rows){const m=new Map();for(const x of rows){if(x.ts<START||x.ts>=END)continue;if(new Date(x.ts).getUTCDate()<12)continue;const k=monthKey(x.ts);if(!m.has(k))m.set(k,x.ts);}return m;}
function nearestPrior(rows,ts){let lo=0,hi=rows.length-1,best=null;while(lo<=hi){const mid=(lo+hi)>>1;if(rows[mid].ts<=ts){best=rows[mid];lo=mid+1}else hi=mid-1;}return best;}
function xnpv(rate,cfs){if(rate<=-0.999999)return Infinity;const t0=cfs[0].ts;return cfs.reduce((s,c)=>s+c.amount/Math.pow(1+rate,(c.ts-t0)/(365.25*86400000)),0);}
function xirr(cfs){if(!cfs.some(x=>x.amount<0)||!cfs.some(x=>x.amount>0))return null;let lo=-0.9999,hi=10,flo=xnpv(lo,cfs),fhi=xnpv(hi,cfs);for(let i=0;i<30&&flo*fhi>0;i++){hi*=2;fhi=xnpv(hi,cfs);}if(flo*fhi>0)return null;for(let i=0;i<200;i++){const mid=(lo+hi)/2,fm=xnpv(mid,cfs);if(Math.abs(fm)<1e-8)return mid;if(flo*fm<=0){hi=mid;fhi=fm}else{lo=mid;flo=fm}}return (lo+hi)/2;}
function simulate(name,rows,fxRows,{proxyMode=false}={}){
  const cfg=CFG[name],dates=monthlyDates(rows);let shares=0,last=0,purchases=0,firstTs=null,lastTs=null,investedLocal=0,investedUsd=0;const cfsLocal=[],cfsUsd=[];
  for(const x of rows){if(x.ts>=START&&x.ts<END)last=x.price;const mk=monthKey(x.ts);if(dates.get(mk)!==x.ts)continue;let usd=cfg.monthly;if(cfg.currency==='TWD'){const fx=nearestPrior(fxRows,x.ts);if(!(fx?.price>0))continue;usd=cfg.monthly/fx.price;}shares+=cfg.monthly/x.price;investedLocal+=cfg.monthly;investedUsd+=usd;cfsLocal.push({ts:x.ts,amount:-cfg.monthly});cfsUsd.push({ts:x.ts,amount:-usd});firstTs??=x.ts;lastTs=x.ts;purchases++;}
  const finalRow=[...rows].reverse().find(x=>x.ts<END),finalPrice=finalRow?.price||last,finalLocal=shares*finalPrice;let finalUsd=finalLocal;
  if(cfg.currency==='TWD'){const fx=nearestPrior(fxRows,END.getTime()-1);finalUsd=fx?.price?finalLocal/fx.price:null;}
  cfsLocal.push({ts:END.getTime()-1,amount:finalLocal});cfsUsd.push({ts:END.getTime()-1,amount:finalUsd});
  return {symbol:name,sourceTicker:proxyMode?cfg.proxy:cfg.ticker,mode:proxyMode?'proxy-history':'actual-listing-history',monthlyAmount:cfg.monthly,currency:cfg.currency,purchases,firstPurchase:firstTs?dateKey(firstTs):null,lastPurchase:lastTs?dateKey(lastTs):null,shares,finalPrice,investedLocal,investedUsd,finalValueLocal:finalLocal,finalValueUsd:finalUsd,profitLocal:finalLocal-investedLocal,profitUsd:finalUsd-investedUsd,capitalMultipleLocal:investedLocal?finalLocal/investedLocal:null,capitalMultipleUsd:investedUsd?finalUsd/investedUsd:null,xirrLocal:xirr(cfsLocal),xirrUsd:xirr(cfsUsd)};
}
function portfolio(rows){const cfs=[];for(const r of rows){const m=r.monthlyAmount;const start=new Date(r.firstPurchase+'T00:00:00Z');for(let i=0;i<r.purchases;i++){const d=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+i,12));let amt=m;if(r.currency==='TWD')amt=r.investedUsd/r.purchases;cfs.push({ts:d.getTime(),amount:-amt});}}const final=rows.reduce((s,r)=>s+r.finalValueUsd,0);cfs.push({ts:END.getTime()-1,amount:final});const invested=rows.reduce((s,r)=>s+r.investedUsd,0);return {totalInvestedUsd:invested,finalValueUsd:final,profitUsd:final-invested,capitalMultiple:invested?final/invested:null,xirrUsd:xirr(cfs)};}
module.exports=async(req,res)=>{res.setHeader('Cache-Control','no-store');try{const [r0050,rVOO,rQQQM,rQQQ,rFX]=await Promise.all([yf('0050.TW'),yf('VOO'),yf('QQQM'),yf('QQQ'),yf('TWD=X')]);const actual=[simulate('0050',r0050,rFX),simulate('VOO',rVOO,[]),simulate('QQQM',rQQQM,[])];const proxy=[simulate('0050',r0050,rFX),simulate('VOO',rVOO,[]),simulate('QQQM',rQQQ,[],{proxyMode:true})];res.status(200).json({ok:true,version:'fubon-10y-v2',period:{start:dateKey(START),endExclusive:dateKey(END),months:120},assumptions:{monthlyPlan:{'0050':'TWD 2,000','VOO':'USD 30','QQQM':'USD 30'},purchaseDate:'first trading day on or after calendar day 12',dividends:'adjusted-close approximation',feesTaxesFxCosts:'excluded',fxFor0050:'nearest prior available TWD=X observation',qqqmCaveat:'actual listing history and QQQ proxy shown separately',xirr:'true dated cash-flow XIRR approximation'},actualListing:{assets:actual,portfolio:portfolio(actual)},tenYearProxy:{assets:proxy,portfolio:portfolio(proxy)},generatedAt:new Date().toISOString()});}catch(e){res.status(500).json({ok:false,error:e.message});}};
