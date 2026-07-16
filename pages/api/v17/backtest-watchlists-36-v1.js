const START=new Date('2016-07-16T00:00:00Z');
const END=new Date('2026-07-16T00:00:00Z');
const GROUPS={
  list1:['NOW','QCOM','DELL','MSFT','NFLX','ADBE','SOFI','REGN','MA','V','PWR','CEG','COST','GEV','LLY','SPOT','TMUS','ACN'],
  list2:['AAPL','AMZN','KO','BAC','AXP','CVX','XOM','LIN','NOC','UNH','MU','SNDK','WDC','STX','SKHY','DRAM','OXY','PBR']
};
const BENCHMARKS=['SPY','QQQ'];
const num=v=>Number.isFinite(Number(v))?Number(v):null;
const dateKey=t=>new Date(t).toISOString().slice(0,10);
async function yf(symbol){
  const p1=Math.floor(START.getTime()/1000)-86400*10,p2=Math.floor(END.getTime()/1000)+86400*2;
  const u=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${p1}&period2=${p2}&interval=1d&events=div%2Csplits&includeAdjustedClose=true`;
  const r=await fetch(u,{cache:'no-store',headers:{'User-Agent':'Mozilla/5.0'}});
  if(!r.ok)throw new Error(`${symbol}:${r.status}`);
  const z=(await r.json())?.chart?.result?.[0]; if(!z)throw new Error(`${symbol}:empty`);
  const ts=z.timestamp||[],a=z.indicators?.adjclose?.[0]?.adjclose||[],q=z.indicators?.quote?.[0]?.close||[],rows=[];
  for(let i=0;i<ts.length;i++){const p=num(a[i]??q[i]);if(p&&p>0)rows.push({ts:ts[i]*1000,p});}
  return rows.sort((x,y)=>x.ts-y.ts);
}
function pct(a,b){return a>0&&b>0?b/a-1:null;}
function cagr(a,b,years){return a>0&&b>0&&years>0?Math.pow(b/a,1/years)-1:null;}
function annualizedVol(rows){if(rows.length<3)return null;const rs=[];for(let i=1;i<rows.length;i++){const r=Math.log(rows[i].p/rows[i-1].p);if(Number.isFinite(r))rs.push(r);}if(rs.length<2)return null;const m=rs.reduce((s,x)=>s+x,0)/rs.length;const v=rs.reduce((s,x)=>s+(x-m)**2,0)/(rs.length-1);return Math.sqrt(v*252);}
function maxDrawdown(rows){let peak=-Infinity,mdd=0,peakTs=null,troughTs=null,curPeakTs=null;for(const x of rows){if(x.p>peak){peak=x.p;curPeakTs=x.ts;}const d=x.p/peak-1;if(d<mdd){mdd=d;peakTs=curPeakTs;troughTs=x.ts;}}return {maxDrawdown:mdd,peakDate:peakTs?dateKey(peakTs):null,troughDate:troughTs?dateKey(troughTs):null};}
function nearestPrior(rows,ts){let lo=0,hi=rows.length-1,b=null;while(lo<=hi){const m=(lo+hi)>>1;if(rows[m].ts<=ts){b=rows[m];lo=m+1}else hi=m-1;}return b;}
function summarize(symbol,rows){
  const first=rows[0],last=rows[rows.length-1]; if(!first||!last)return {symbol,error:'no_data'};
  const years=(last.ts-first.ts)/(365.25*86400000),mdd=maxDrawdown(rows),peak=Math.max(...rows.map(x=>x.p));
  const one=nearestPrior(rows,last.ts-365.25*86400000),three=nearestPrior(rows,last.ts-3*365.25*86400000),five=nearestPrior(rows,last.ts-5*365.25*86400000);
  return {symbol,historyStart:dateKey(first.ts),historyEnd:dateKey(last.ts),historyYears:years,fullTenYears:years>=9.8,startPrice:first.p,endPrice:last.p,totalReturn:pct(first.p,last.p),cagr:cagr(first.p,last.p,years),annualizedVolatility:annualizedVol(rows),maxDrawdown:mdd.maxDrawdown,drawdownPeakDate:mdd.peakDate,drawdownTroughDate:mdd.troughDate,currentDrawdown:last.p/peak-1,return1y:one?pct(one.p,last.p):null,cagr3y:three?cagr(three.p,last.p,(last.ts-three.ts)/(365.25*86400000)):null,cagr5y:five?cagr(five.p,last.p,(last.ts-five.ts)/(365.25*86400000)):null};
}
function rank(rows){return [...rows].sort((a,b)=>{const af=a.fullTenYears?1:0,bf=b.fullTenYears?1:0;if(af!==bf)return bf-af;const as=(a.cagr??-9)-Math.abs(a.maxDrawdown??0)*0.25-(a.annualizedVolatility??0)*0.15;const bs=(b.cagr??-9)-Math.abs(b.maxDrawdown??0)*0.25-(b.annualizedVolatility??0)*0.15;return bs-as;});}
module.exports=async(req,res)=>{res.setHeader('Cache-Control','no-store');const symbols=[...GROUPS.list1,...GROUPS.list2,...BENCHMARKS];const out={};await Promise.all(symbols.map(async s=>{try{out[s]=summarize(s,await yf(s));}catch(e){out[s]={symbol:s,error:e.message};}}));const list1=GROUPS.list1.map(s=>out[s]),list2=GROUPS.list2.map(s=>out[s]);res.status(200).json({ok:true,version:'watchlists-36-v1',period:{requestedStart:dateKey(START),requestedEnd:dateKey(END)},assumptions:{returnBasis:'Yahoo adjusted close; dividends and splits approximated',strategy:'buy-and-hold from first available trading day in period',feesTaxesFx:'excluded',shortHistory:'reported since inception and excluded from full-10-year ranking'},groups:{list1,list2},rankings:{list1:rank(list1),list2:rank(list2),combined:rank([...list1,...list2])},benchmarks:BENCHMARKS.map(s=>out[s]),generatedAt:new Date().toISOString()});};