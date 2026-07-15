const S=new Date('2016-07-14T00:00:00Z'),E=new Date('2026-07-15T00:00:00Z');
const ASSETS=[
 {s:'QQQ',y:'QQQ',levels:[15,25,35,45]},
 {s:'NVDA',y:'NVDA',levels:[25,35,45,60]},
 {s:'TSM',y:'TSM',levels:[25,35,45,60]},
 {s:'AVGO',y:'AVGO',levels:[25,35,45,60]},
 {s:'GOOGL',y:'GOOGL',levels:[20,30,40,50]},
 {s:'BTC',y:'BTC-USD',levels:[25,40,55,70],cycle:true}
];
const BASE_UNIT=5,MULT=[1,2,4,8],REFILLS=[10,20,30,40],CAPS=[75,100,150,200,Infinity];
const n=v=>Number.isFinite(Number(v))?Number(v):0,ds=t=>new Date(t).toISOString().slice(0,10),mo=t=>ds(t).slice(0,7);
async function yf(s){const p1=S.getTime()/1000|0,p2=E.getTime()/1000|0,u=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?period1=${p1}&period2=${p2}&interval=1d&events=div%2Csplits&includeAdjustedClose=true`;const r=await fetch(u,{cache:'no-store',headers:{'User-Agent':'Mozilla/5.0'}});if(!r.ok)throw Error(`${s}:${r.status}`);const z=(await r.json())?.chart?.result?.[0];if(!z)throw Error(`${s}:empty`);const ts=z.timestamp||[],q=z.indicators?.quote?.[0]||{},a=z.indicators?.adjclose?.[0]?.adjclose||[],o=[];for(let i=0;i<ts.length;i++){const rc=n(q.close?.[i]),ac=n(a[i]??rc);if(!(rc>0&&ac>0))continue;const f=ac/rc;o.push({ts:ts[i]*1000,c:ac,h:(n(q.high?.[i])*f)||ac})}return o.filter(x=>x.ts>=S&&x.ts<E)}
function prep(rows,a){let ref=0;return rows.map(x=>{let reset=false;if(!ref||x.h>ref){ref=x.h;reset=true}return {...x,reset,dd:ref?100*(x.c/ref-1):0}})}
function monthDates(rows){const m=new Map();for(const x of rows){if(new Date(x.ts).getUTCDate()<14)continue;const k=mo(x.ts);if(!m.has(k))m.set(k,x.ts)}return m}
function run(series,rf,refill,cap){const pm=new Map(),mm=new Map(),state=new Map(),last=new Map();for(const a of ASSETS){const p=prep(series.get(a.s)||[],a);pm.set(a.s,new Map(p.map(x=>[x.ts,x])));mm.set(a.s,monthDates(p));state.set(a.s,{done:new Set(),queue:new Map(),sh:0,baseInv:0,dipInv:0,triggered:0,filledNow:0,filledDelayed:0,expired:0,delays:[]})}
 const cal=[...new Set([...series.values()].flat().map(x=>x.ts))].sort((a,b)=>a-b);let pool=0,interest=0,overflow=0,rate=0,minPool=Infinity,zeroDays=0,zeroRuns=0,inZero=false,contrib=0;const qMonths=mm.get('QQQ');
 for(const ts of cal){const date=ds(ts);if(rf.has(date))rate=rf.get(date);const it=pool*(rate/100)/365;pool+=it;interest+=it;
   if(qMonths.get(mo(ts))===ts){contrib+=refill;if(pool+refill>cap){const room=Math.max(0,cap-pool);pool+=room;overflow+=refill-room}else pool+=refill}
   const candidates=[];
   for(const a of ASSETS){const s=state.get(a.s),row=pm.get(a.s).get(ts);if(row)last.set(a.s,row.c);if(row?.reset){s.done=new Set();for(const [k,q] of s.queue){s.expired++;s.queue.delete(k)}}
     if(a&&mm.get(a.s).get(mo(ts))===ts&&row){s.sh+=10/row.c;s.baseInv+=10}
     if(!row)continue;
     for(let i=0;i<a.levels.length;i++){const key=String(i),active=Math.abs(row.dd)>=a.levels[i];if(active&&!s.done.has(i)&&!s.queue.has(key)){s.triggered++;s.queue.set(key,{i,firstTs:ts,firstDd:Math.abs(row.dd)})}else if(!active&&s.queue.has(key)){s.expired++;s.queue.delete(key)}}
     for(const q of s.queue.values()){const excess=Math.abs(row.dd)-a.levels[q.i];candidates.push({a,s,row,q,level:q.i+1,excess,delayed:q.firstTs<ts})}
   }
   candidates.sort((x,y)=>Number(y.delayed)-Number(x.delayed)||y.level-x.level||y.excess-x.excess||x.q.firstTs-y.q.firstTs||x.a.s.localeCompare(y.a.s));
   let fills=0;for(const c of candidates){if(fills>=2)break;const amt=BASE_UNIT*MULT[c.q.i];if(pool+1e-9<amt)continue;pool-=amt;c.s.sh+=amt/c.row.c;c.s.dipInv+=amt;c.s.done.add(c.q.i);c.s.queue.delete(String(c.q.i));const delay=(ts-c.q.firstTs)/86400000;c.s.delays.push(delay);if(delay>0)c.s.filledDelayed++;else c.s.filledNow++;fills++}
   minPool=Math.min(minPool,pool);if(pool<1){zeroDays++;if(!inZero){zeroRuns++;inZero=true}}else inZero=false;
 }
 const assets=ASSETS.map(a=>{const s=state.get(a.s),pending=s.queue.size,totalValue=s.sh*n(last.get(a.s));return {symbol:a.s,triggers:s.triggered,filledImmediate:s.filledNow,filledDelayed:s.filledDelayed,pending,expired:s.expired,fillRate:s.triggered?(s.filledNow+s.filledDelayed)/s.triggered:0,avgDelayDays:s.delays.length?s.delays.reduce((x,y)=>x+y,0)/s.delays.length:0,maxDelayDays:s.delays.length?Math.max(...s.delays):0,baseInvested:s.baseInv,dipInvested:s.dipInv,totalValue}});
 const sum=k=>assets.reduce((z,x)=>z+n(x[k]),0),tr=sum('triggers'),filled=sum('filledImmediate')+sum('filledDelayed'),dip=sum('dipInvested'),finalValue=sum('totalValue')+pool;return {refill,cap:Number.isFinite(cap)?cap:'unlimited',extraContributed:contrib,dipInvested:dip,poolCash:pool,poolInterest:interest,overflowToDca:overflow,utilization:contrib?dip/contrib:0,triggers:tr,filledImmediate:sum('filledImmediate'),filledDelayed:sum('filledDelayed'),pending:sum('pending'),expired:sum('expired'),fillRate:tr?filled/tr:0,avgDelayDays:assets.reduce((z,x)=>z+x.avgDelayDays*(x.filledImmediate+x.filledDelayed),0)/(filled||1),maxDelayDays:Math.max(0,...assets.map(x=>x.maxDelayDays)),minPool:Number.isFinite(minPool)?minPool:0,zeroBalanceDays:zeroDays,zeroBalanceRuns:zeroRuns,finalValue,assets}}
module.exports=async(req,res)=>{res.setHeader('Cache-Control','no-store');try{const [pairs,irx]=await Promise.all([Promise.all(ASSETS.map(async a=>[a.s,await yf(a.y)])),yf('^IRX')]),series=new Map(pairs),rf=new Map(irx.map(x=>[ds(x.ts),Math.max(0,x.c)])),grid=[];for(const refill of REFILLS)for(const cap of CAPS)grid.push(run(series,rf,refill,cap));const ranked=[...grid].sort((a,b)=>b.fillRate-a.fillRate||a.extraContributed-b.extraContributed||a.avgDelayDays-b.avgDelayDays);res.status(200).json({ok:true,version:'v8-shared-dip-pool-grid',methodology:{assets:ASSETS.map(x=>x.s),baseDca:'10U/month per asset, unchanged',dipPool:'one shared pool',refills:REFILLS,caps:CAPS.map(x=>Number.isFinite(x)?x:'unlimited'),ladder:'5/10/20/40U (1/2/4/8)',priority:['delayed signals first','deeper D level','larger excess drawdown','older trigger','symbol tie-break'],executionLimit:'max 2 fills per trading day',qualityTieBreak:'not used because historical point-in-time Market45/91 scores are not yet loaded; using them now would create look-ahead bias',cashYield:'^IRX',btcReference:'running ATH proxy, not formal cycle-high dates'},bestByFillRate:ranked.slice(0,8),grid,generatedAt:new Date().toISOString()})}catch(e){res.status(500).json({ok:false,error:e.message})}}
