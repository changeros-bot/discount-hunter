const START=new Date('2016-07-16T00:00:00Z');
const END=new Date('2026-07-16T00:00:00Z');
const GROUPS={
  list1:['NOW','QCOM','DELL','MSFT','NFLX','ADBE','SOFI','REGN','MA','V','PWR','CEG','COST','GEV','LLY','SPOT','TMUS','ACN'],
  list2:['AAPL','AMZN','KO','BAC','AXP','CVX','XOM','LIN','NOC','UNH','MU','SNDK','WDC','STX','SKHY','DRAM','OXY','PBR']
};
const BENCHMARKS=['SPY','QQQ'];
const DAY=86400000;
const num=v=>{const x=v&&typeof v==='object'&&'raw'in v?v.raw:v;return Number.isFinite(Number(x))?Number(x):null;};
const dateKey=t=>new Date(t).toISOString().slice(0,10);
async function chart(symbol){
  const p1=Math.floor(START.getTime()/1000)-86400*10,p2=Math.floor(END.getTime()/1000)+86400*2;
  const u=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${p1}&period2=${p2}&interval=1d&events=div%2Csplits&includeAdjustedClose=true`;
  const r=await fetch(u,{cache:'no-store',headers:{'User-Agent':'Mozilla/5.0'}});if(!r.ok)throw new Error(`${symbol}:chart:${r.status}`);
  const z=(await r.json())?.chart?.result?.[0];if(!z)throw new Error(`${symbol}:chart_empty`);
  const ts=z.timestamp||[],a=z.indicators?.adjclose?.[0]?.adjclose||[],q=z.indicators?.quote?.[0]?.close||[],rows=[];
  for(let i=0;i<ts.length;i++){const p=num(a[i]??q[i]);if(p&&p>0)rows.push({ts:ts[i]*1000,p});}
  return rows.sort((x,y)=>x.ts-y.ts);
}
async function quoteSummary(symbol){
  const modules=['price','summaryProfile','summaryDetail','defaultKeyStatistics','financialData','incomeStatementHistory','cashflowStatementHistory','balanceSheetHistory'].join(',');
  const u=`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}`;
  const r=await fetch(u,{cache:'no-store',headers:{'User-Agent':'Mozilla/5.0','Accept':'application/json'}});if(!r.ok)throw new Error(`${symbol}:fundamentals:${r.status}`);
  const z=(await r.json())?.quoteSummary?.result?.[0];if(!z)throw new Error(`${symbol}:fundamentals_empty`);return z;
}
function pct(a,b){return a>0&&b>0?b/a-1:null;}
function cagr(a,b,y){return a>0&&b>0&&y>0?Math.pow(b/a,1/y)-1:null;}
function vol(rows){if(rows.length<3)return null;const rs=[];for(let i=1;i<rows.length;i++){const r=Math.log(rows[i].p/rows[i-1].p);if(Number.isFinite(r))rs.push(r);}if(rs.length<2)return null;const m=rs.reduce((s,x)=>s+x,0)/rs.length;return Math.sqrt(rs.reduce((s,x)=>s+(x-m)**2,0)/(rs.length-1)*252);}
function mdd(rows){let peak=-Infinity,peakTs=null,curPeakTs=null,min=0,troughTs=null;for(const x of rows){if(x.p>peak){peak=x.p;curPeakTs=x.ts;}const d=x.p/peak-1;if(d<min){min=d;peakTs=curPeakTs;troughTs=x.ts;}}return{value:min,peakDate:peakTs?dateKey(peakTs):null,troughDate:troughTs?dateKey(troughTs):null};}
function nearest(rows,ts){let lo=0,hi=rows.length-1,b=null;while(lo<=hi){const m=(lo+hi)>>1;if(rows[m].ts<=ts){b=rows[m];lo=m+1}else hi=m-1;}return b;}
function annualReturns(rows){const years={};for(const x of rows){const y=new Date(x.ts).getUTCFullYear();years[y]??={first:x,last:x};years[y].last=x;}const out={};for(const [y,v] of Object.entries(years))out[y]=pct(v.first.p,v.last.p);return out;}
function perf(symbol,rows){const first=rows[0],last=rows.at(-1);if(!first||!last)return{symbol,error:'no_data'};const years=(last.ts-first.ts)/(365.25*DAY),d=mdd(rows),peak=Math.max(...rows.map(x=>x.p));const one=nearest(rows,last.ts-365.25*DAY),three=nearest(rows,last.ts-3*365.25*DAY),five=nearest(rows,last.ts-5*365.25*DAY);return{symbol,historyStart:dateKey(first.ts),historyEnd:dateKey(last.ts),historyYears:years,fullTenYears:years>=9.8,startPrice:first.p,endPrice:last.p,totalReturn:pct(first.p,last.p),cagr:cagr(first.p,last.p,years),annualizedVolatility:vol(rows),maxDrawdown:d.value,drawdownPeakDate:d.peakDate,drawdownTroughDate:d.troughDate,currentDrawdown:last.p/peak-1,return1y:one?pct(one.p,last.p):null,cagr3y:three?cagr(three.p,last.p,(last.ts-three.ts)/(365.25*DAY)):null,cagr5y:five?cagr(five.p,last.p,(last.ts-five.ts)/(365.25*DAY)):null,annualReturns:annualReturns(rows)};}
function statements(z){
  const inc=z.incomeStatementHistory?.incomeStatementHistory||[],cf=z.cashflowStatementHistory?.cashflowStatements||[],bs=z.balanceSheetHistory?.balanceSheetStatements||[];
  const byYear={};
  for(const s of inc){const y=new Date((num(s.endDate)||0)*1000).getUTCFullYear();if(!y)continue;byYear[y]={...(byYear[y]||{}),revenue:num(s.totalRevenue),operatingIncome:num(s.operatingIncome),netIncome:num(s.netIncome)};}
  for(const s of cf){const y=new Date((num(s.endDate)||0)*1000).getUTCFullYear();if(!y)continue;const ocf=num(s.totalCashFromOperatingActivities),capex=num(s.capitalExpenditures);byYear[y]={...(byYear[y]||{}),operatingCashFlow:ocf,capitalExpenditure:capex,freeCashFlow:ocf!=null&&capex!=null?ocf+capex:null};}
  for(const s of bs){const y=new Date((num(s.endDate)||0)*1000).getUTCFullYear();if(!y)continue;byYear[y]={...(byYear[y]||{}),cash:num(s.cash),totalDebt:num(s.longTermDebt)!=null||num(s.shortLongTermDebt)!=null?(num(s.longTermDebt)||0)+(num(s.shortLongTermDebt)||0):null,totalAssets:num(s.totalAssets),stockholderEquity:num(s.totalStockholderEquity)};}
  return Object.entries(byYear).sort((a,b)=>Number(a[0])-Number(b[0])).map(([year,v])=>({year:Number(year),...v}));
}
function fundamentals(symbol,z){const p=z.price||{},sd=z.summaryDetail||{},ks=z.defaultKeyStatistics||{},fd=z.financialData||{},sp=z.summaryProfile||{};return{symbol,name:p.longName||p.shortName||null,sector:sp.sector||null,industry:sp.industry||null,marketCap:num(p.marketCap),enterpriseValue:num(ks.enterpriseValue),trailingPE:num(sd.trailingPE),forwardPE:num(sd.forwardPE),priceToBook:num(ks.priceToBook),pegRatio:num(ks.pegRatio),enterpriseToRevenue:num(ks.enterpriseToRevenue),enterpriseToEbitda:num(ks.enterpriseToEbitda),profitMargin:num(fd.profitMargins),operatingMargin:num(fd.operatingMargins),grossMargin:num(fd.grossMargins),returnOnEquity:num(fd.returnOnEquity),returnOnAssets:num(fd.returnOnAssets),revenueGrowth:num(fd.revenueGrowth),earningsGrowth:num(fd.earningsGrowth),debtToEquity:num(fd.debtToEquity),currentRatio:num(fd.currentRatio),quickRatio:num(fd.quickRatio),freeCashFlow:num(fd.freeCashflow),operatingCashFlow:num(fd.operatingCashflow),totalCash:num(fd.totalCash),totalDebt:num(fd.totalDebt),dividendYield:num(sd.dividendYield),payoutRatio:num(sd.payoutRatio),beta:num(ks.beta),sharesOutstanding:num(ks.sharesOutstanding),annualStatements:statements(z)};}
function compareAnnual(stock,bench){const out={};for(const y of Object.keys(stock||{})){const s=stock[y],b=bench?.[y];out[y]={stock:s,benchmark:b??null,alpha:b==null||s==null?null:s-b,beat:b==null||s==null?null:s>b};}return out;}
function benchmarkStats(stock,bench){const years=Object.values(compareAnnual(stock,bench)).filter(x=>x.alpha!=null);return{comparableYears:years.length,beatYears:years.filter(x=>x.beat).length,beatRate:years.length?years.filter(x=>x.beat).length/years.length:null,averageAnnualAlpha:years.length?years.reduce((s,x)=>s+x.alpha,0)/years.length:null};}
async function pool(items,limit,fn){const out={};let i=0;async function worker(){while(i<items.length){const idx=i++,key=items[idx];try{out[key]=await fn(key);}catch(e){out[key]={symbol:key,error:e.message};}}}await Promise.all(Array.from({length:limit},worker));return out;}
function rank(rows){return[...rows].sort((a,b)=>{const af=a.performance?.fullTenYears?1:0,bf=b.performance?.fullTenYears?1:0;if(af!==bf)return bf-af;const score=x=>(x.performance?.cagr??-9)-Math.abs(x.performance?.maxDrawdown??0)*.25-(x.performance?.annualizedVolatility??0)*.15+(x.comparison?.SPY?.averageAnnualAlpha??0)*.2;return score(b)-score(a);});}
module.exports=async(req,res)=>{res.setHeader('Cache-Control','s-maxage=3600, stale-while-revalidate=86400');try{const symbols=[...GROUPS.list1,...GROUPS.list2,...BENCHMARKS];const charts=await pool(symbols,5,chart);const benchPerf={};for(const b of BENCHMARKS)benchPerf[b]=charts[b]?.error?charts[b]:perf(b,charts[b]);const fundamentalsMap=await pool([...GROUPS.list1,...GROUPS.list2],3,async s=>fundamentals(s,await quoteSummary(s)));
  const build=s=>{const performance=charts[s]?.error?charts[s]:perf(s,charts[s]);const comparison={};for(const b of BENCHMARKS){comparison[b]={annual:compareAnnual(performance.annualReturns,benchPerf[b]?.annualReturns),...benchmarkStats(performance.annualReturns,benchPerf[b]?.annualReturns),cagrAlpha:performance.cagr!=null&&benchPerf[b]?.cagr!=null?performance.cagr-benchPerf[b].cagr:null};}return{symbol:s,performance,fundamentals:fundamentalsMap[s],comparison};};
  const list1=GROUPS.list1.map(build),list2=GROUPS.list2.map(build);res.status(200).json({ok:true,version:'watchlists-36-v2',period:{requestedStart:dateKey(START),requestedEnd:dateKey(END)},assumptions:{performance:'Yahoo adjusted close buy-and-hold; dividends/splits approximated',annualComparison:'calendar-year adjusted-close returns versus SPY and QQQ',fundamentals:'Yahoo quoteSummary current snapshot plus available annual statements, usually up to four fiscal years',feesTaxesFx:'excluded',shortHistory:'since inception; not treated as full ten-year history'},benchmarks:benchPerf,groups:{list1,list2},rankings:{list1:rank(list1),list2:rank(list2),combined:rank([...list1,...list2])},generatedAt:new Date().toISOString()});}catch(e){res.status(500).json({ok:false,error:e.message});}};