import {useEffect,useState} from 'react';
const TX_KEY='josh-financial-os-v32-tx';
const RATE=32.5;
const food=['早餐','午餐','晚餐','飲料','咖啡','菸','點心/宵夜'];
const fixed=['手機月租費','ChatGPT','Google One'];
const cats=['飲食','服飾','交通','娛樂','醫療','金融','固定支出','生活用品','生活費','薪水','退稅','早餐','午餐','晚餐','飲料','咖啡','菸','點心/宵夜','機車','醫療健康','其他'];
const expenseCsv=`2026-06-30,芬+蠶豆酥,130
2026-06-30,眼鏡鏈條,107
2026-06-29,電信費,1773
2026-06-29,芬+飲料,115
2026-06-29,蠶豆酥,45
2026-06-28,芬+麵包,113
2026-06-28,黑咖啡,30
2026-06-28,早餐,70
2026-06-28,加油,188
2026-06-27,晚餐,205
2026-06-27,兩人雨衣,487
2026-06-27,芬+飲料,115
2026-06-27,早餐,80
2026-06-26,芬+飲料,106
2026-06-26,冰美式,30
2026-06-26,Google one,65
2026-06-24,芬+黑咖啡,115
2026-06-24,早餐,45
2026-06-24,Chatgpt 月費,660
2026-06-23,芬+飲料,115
2026-06-23,Chatgpt 月費,660
2026-06-23,早餐,85
2026-06-23,芬,85
2026-06-22,Badoo,375
2026-06-22,加油,100
2026-06-22,芬,85
2026-06-22,早餐,45
2026-06-21,咖啡,30
2026-06-21,芬,85
2026-06-21,洗鼻器,610
2026-06-21,北港蠶豆酥,140
2026-06-21,早餐,45
2026-06-20,午餐,168
2026-06-20,芬+中冰拿,130
2026-06-18,芬+飲料,100
2026-06-17,芬,85
2026-06-17,蠶豆酥,45
2026-06-17,早餐,45
2026-06-17,芬+打火機,110
2026-06-16,中餐,53
2026-06-16,中餐,53
2026-06-16,芬,85
2026-06-16,早餐,80
2026-06-15,午餐,53
2026-06-15,洗鼻器,610
2026-06-15,芬,80
2026-06-15,早餐,80
2026-06-14,蠶豆酥,37
2026-06-14,中餐,144
2026-06-14,芬,85
2026-06-14,早餐,80
2026-06-13,足球,1000
2026-06-13,蠶豆酥,45
2026-06-13,早餐,80
2026-06-13,芬,85
2026-06-12,蠶豆,45
2026-06-12,芬+黑咖啡,115
2026-06-12,早餐,50
2026-06-11,諾音飲料,160
2026-06-11,中餐,125
2026-06-11,芬+黑咖啡,130
2026-06-10,加油,186
2026-06-10,晚餐,130
2026-06-10,飲料,20
2026-06-10,停車費,20
2026-06-10,耳朵醫藥費,3450
2026-06-10,看耳朵,400
2026-06-10,早餐,60
2026-06-10,芬+飲料,160
2026-06-09,中熟拿,40
2026-06-08,菸,85
2026-06-08,中餐,120
2026-06-08,晚餐,199
2026-06-07,中餐,164
2026-06-07,早餐,45
2026-06-07,菸+黑咖啡,115
2026-06-06,晚餐,184
2026-06-06,看耳朵,220
2026-06-05,中餐,70
2026-06-05,菸+飲料,115
2026-06-04,菸+飲料,105
2026-06-04,中冰拿,45
2026-06-04,機車排氣檢驗過期罰單,1515
2026-06-03,感訓費用,1300
2026-06-03,菸,85
2026-06-03,晚餐,190
2026-06-03,富邦開戶,200
2026-06-03,咖啡,30
2026-06-02,飲料+菸,124
2026-06-02,午餐,184
2026-06-02,早餐,50
2026-06-02,菸,85
2026-06-01,早餐,50
2026-06-01,菸,85
2026-07-06,加油,155
2026-07-06,早餐,60
2026-07-05,蠶豆酥,45
2026-07-05,早餐,80
2026-07-04,晚餐,100
2026-07-04,咖啡,30
2026-07-04,早餐,45
2026-07-04,菸,85
2026-07-03,挫冰,65
2026-07-03,雞排,80
2026-07-03,咖啡+太陽餅,100
2026-07-03,菸,85
2026-07-03,中冰拿,45
2026-07-03,早餐,70
2026-07-02,菸,85
2026-07-02,中冰拿,40
2026-07-01,菸+黑咖啡,115
2026-07-01,早餐,80`;
function today(){return new Date().toISOString().slice(0,10)}
function monthStart(){return today().slice(0,7)+'-01'}
function payrollStart(){const d=new Date(today()+'T00:00:00');const s=new Date(d.getFullYear(),d.getDate()>=10?d.getMonth():d.getMonth()-1,10);return s.toISOString().slice(0,10)}
function nt(n){return '$'+Number(n||0).toLocaleString('zh-TW',{maximumFractionDigits:0})}
function usd(n){return 'USD '+Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}
function cat(note){if(/Chat/i.test(note))return'ChatGPT';if(/Google/i.test(note))return'Google One';if(/電信|手機/.test(note))return'手機月租費';if(/加油|停車|機車|罰單/.test(note))return'機車';if(/耳|鼻|醫|看耳朵|洗鼻器/.test(note))return'醫療健康';if(/富邦/.test(note))return'金融';if(/Badoo|足球/.test(note))return'娛樂';if(/雨衣/.test(note))return'服飾';if(/眼鏡|打火機/.test(note))return'生活用品';if(/感訓/.test(note))return'其他';if(/早餐/.test(note))return'早餐';if(/午餐|中餐/.test(note))return'午餐';if(/晚餐/.test(note))return'晚餐';if(/咖啡|冰美式|冰拿|熟拿|黑咖啡/.test(note))return'咖啡';if(/菸|芬/.test(note))return'菸';if(/飲料/.test(note))return'飲料';if(/豆|酥|麵包|挫冰|雞排|冰/.test(note))return'點心/宵夜';return'其他'}
function group(c){if(food.includes(c))return'飲食';if(c==='機車')return'交通';if(c==='醫療健康')return'醫療';if(fixed.includes(c))return'固定支出';if(['服飾','娛樂','金融','生活用品','交通','醫療'].includes(c))return c;return'其他'}
function living(c){return food.includes(c)||['生活用品','機車','生活費'].includes(c)}
const seed=[...expenseCsv.split('\n').map((l,i)=>{const [date,note,amount]=l.split(',');const c=cat(note);return{id:'e'+i+date+note,date,type:'支出',amount:+amount,account:'自用',category:c,note}}),{id:'income-salary-202606',date:'2026-06-30',type:'收入',amount:50350,account:'自用',category:'薪水',note:'薪水'},{id:'income-tax-202606',date:'2026-06-30',type:'收入',amount:1300,account:'自用',category:'退稅',note:'退稅'}];
function stat(txs,r){const tx=txs.filter(t=>t.date>=r.start&&t.date<=r.end);const ex=tx.filter(t=>t.type==='支出'),inc=tx.filter(t=>t.type==='收入');const sum=a=>a.reduce((s,x)=>s+Number(x.amount||0),0);const expense=sum(ex),income=sum(inc),lifeRows=ex.filter(t=>living(t.category)&&t.account!=='家用'),fixedRows=ex.filter(t=>fixed.includes(t.category));const life=sum(lifeRows),fix=sum(fixedRows);const groups=['飲食','服飾','交通','娛樂','醫療','金融','固定支出','生活用品','其他'].map(name=>({name,amount:sum(ex.filter(t=>group(t.category)===name))})).filter(x=>x.amount>0);const foods=food.map(name=>({name,amount:sum(ex.filter(t=>t.category===name))})).filter(x=>x.amount>0);return{tx,ex,inc,expense,income,balance:income-expense,life,fix,lifeRows,fixedRows,groups,foods}}
function Card(p){return <section onClick={p.onClick} style={{background:'linear-gradient(160deg,rgba(17,24,39,.96),rgba(15,23,42,.96))',border:'1px solid rgba(34,197,94,.36)',borderRadius:22,padding:16,marginBottom:12,boxShadow:'0 18px 46px rgba(34,197,94,.13),0 12px 34px rgba(0,0,0,.28)',cursor:p.onClick?'pointer':'default',...p.style}}>{p.children}</section>}
function Title({t,r}){return <div style={{display:'flex',justifyContent:'space-between',gap:10,marginBottom:12}}><h2 style={{margin:0,fontSize:18,fontWeight:950}}>{t}</h2>{r&&<b style={{color:'#86efac',fontSize:12}}>{r}</b>}</div>}
function Metric({label,value,sub,good,bad,onClick}){return <Card onClick={onClick} style={{marginBottom:0,padding:14,borderColor:bad?'rgba(255,82,82,.55)':good?'rgba(34,197,94,.6)':undefined}}><div style={{color:'#94a3b8',fontSize:12,fontWeight:800}}>{label}</div><div style={{fontSize:24,fontWeight:1000,color:bad?'#ff5252':good?'#86efac':'#fff'}}>{value}</div>{sub&&<div style={{color:bad?'#ff5252':'#94a3b8',fontSize:12,marginTop:6}}>{sub}</div>}</Card>}
function input(){return{width:'100%',background:'rgba(15,23,42,.88)',border:'1px solid rgba(34,197,94,.28)',color:'#f8fafc',borderRadius:14,padding:12,fontSize:15,outline:'none'}}
function Btn(p){return <button onClick={p.onClick} style={{border:'1px solid rgba(34,197,94,.42)',borderRadius:12,padding:'9px 8px',background:'rgba(34,197,94,.12)',color:'#bbf7d0',fontWeight:900}}>{p.children}</button>}
function Bar({amount,total,danger}){const w=total>0?Math.min(100,Math.max(1,amount/total*100)):0;return <div style={{height:12,borderRadius:99,background:'#243044',overflow:'hidden'}}><div style={{height:'100%',width:w+'%',borderRadius:99,background:danger?'linear-gradient(90deg,#f59e0b,#ef4444)':'linear-gradient(90deg,#38bdf8,#22c55e)'}}/></div>}
function Chart({rows,total}){const base=Math.max(1,total||rows.reduce((s,x)=>s+x.amount,0));return <div style={{display:'grid',gap:12}}>{rows.map(x=><div key={x.name} style={{display:'grid',gridTemplateColumns:'70px 1fr 76px',gap:10,alignItems:'center'}}><b>{x.name}</b><Bar amount={x.amount} total={base} danger={x.name==='菸'}/><b style={{textAlign:'right'}}>{nt(x.amount)}</b><span style={{gridColumn:'2 / 3',color:'#94a3b8',fontSize:10,marginTop:-8}}>{(x.amount/base*100).toFixed(1)}%</span></div>)}</div>}
function DetailSheet({detail,onClose}){if(!detail)return null;const rows=[...detail.rows].sort((a,b)=>b.date.localeCompare(a.date));return <div onClick={onClose} style={{position:'fixed',inset:0,zIndex:50,background:'rgba(0,0,0,.55)',display:'grid',alignItems:'end'}}><section onClick={e=>e.stopPropagation()} style={{maxWidth:430,width:'100%',margin:'0 auto',maxHeight:'76vh',overflow:'auto',background:'linear-gradient(160deg,#0f172a,#020617)',border:'1px solid rgba(34,197,94,.42)',borderRadius:'24px 24px 0 0',padding:18,boxShadow:'0 -20px 60px rgba(34,197,94,.18)'}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,marginBottom:10}}><div><h2 style={{margin:'0 0 6px',fontSize:22}}>{detail.title}</h2><div style={{fontSize:34,fontWeight:1000,color:detail.bad?'#ff5252':'#86efac'}}>{nt(detail.total)}</div><p style={{color:'#94a3b8',fontSize:12,lineHeight:1.6,margin:'8px 0 0'}}>{detail.sub}</p></div><button onClick={onClose} style={{border:'1px solid rgba(148,163,184,.25)',background:'rgba(15,23,42,.8)',color:'#e2e8f0',borderRadius:999,padding:'8px 12px',fontWeight:900}}>關閉</button></div><div style={{color:'#94a3b8',fontSize:12,fontWeight:900,margin:'12px 0'}}>共 {rows.length} 筆</div>{rows.map(t=><div key={t.id} style={{display:'grid',gridTemplateColumns:'1fr auto',gap:10,padding:'11px 0',borderBottom:'1px solid rgba(148,163,184,.12)'}}><div><b>{t.note}</b><div style={{color:'#94a3b8',fontSize:12,marginTop:4}}>{t.date}｜{t.category}｜{t.account}｜{t.type}</div></div><b style={{color:t.type==='收入'?'#86efac':'#fca5a5'}}>{nt(t.amount)}</b></div>)}</section></div>}
function Dashboard({txs}){const [r,setR]=useState({start:monthStart(),end:today()});const [detail,setDetail]=useState(null);const s=stat(txs,r);const remain=8000-s.life;const rows=[...s.tx].sort((a,b)=>b.date.localeCompare(a.date));const foodTotal=s.foods.reduce((a,b)=>a+b.amount,0);const period=`${r.start.replaceAll('-','/')} - ${r.end.replaceAll('-','/')}`;return <><Card><Title t='日期篩選' r='Date Range'/><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><input type='date' value={r.start} onChange={e=>setR({...r,start:e.target.value})} style={input()}/><input type='date' value={r.end} onChange={e=>setR({...r,end:e.target.value})} style={input()}/></div><div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8,marginTop:10}}><Btn onClick={()=>setR({start:monthStart(),end:today()})}>本月</Btn><Btn onClick={()=>setR({start:'2026-06-01',end:'2026-06-30'})}>六月</Btn><Btn onClick={()=>setR({start:'2026-06-01',end:today()})}>6月起</Btn><Btn onClick={()=>setR({start:payrollStart(),end:today()})}>發薪後</Btn><Btn onClick={()=>setR({start:'2026-07-01',end:today()})}>七月</Btn></div><p style={{color:'#94a3b8',fontWeight:800}}>預設：每月1號至今｜發薪後：每月10號起算</p><p style={{color:'#94a3b8',fontWeight:800}}>統計區間：{period}</p></Card><Card onClick={()=>setDetail({title:'區間結餘',total:s.balance,bad:s.balance<0,sub:`${period}｜收入 ${nt(s.income)} - 支出 ${nt(s.expense)}`,rows:[...s.inc,...s.ex]})} style={{padding:20,borderColor:s.balance>=0?'rgba(34,197,94,.7)':'rgba(255,82,82,.6)'}}><Title t='區間結餘' r='點開明細'/><div style={{fontSize:42,fontWeight:1000,color:s.balance>=0?'#86efac':'#ff5252'}}>{nt(s.balance)}</div><p style={{color:'#94a3b8'}}>收入 {nt(s.income)} - 支出 {nt(s.expense)}｜收入 {s.inc.length} 筆，支出 {s.ex.length} 筆</p></Card><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}><Metric onClick={()=>setDetail({title:'區間收入',total:s.income,sub:`${period}｜收入 ${s.inc.length} 筆`,rows:s.inc})} label='區間收入' value={nt(s.income)} sub={`${s.inc.length} 筆收入`} good={s.income>0}/><Metric onClick={()=>setDetail({title:'區間支出',total:s.expense,bad:true,sub:`${period}｜支出 ${s.ex.length} 筆`,rows:s.ex})} label='區間支出' value={nt(s.expense)} sub={`${s.ex.length} 筆支出`}/><Metric onClick={()=>setDetail({title:'個人生活費',total:s.life,bad:remain<0,sub:`排除帳戶=家用｜預算 $8,000｜${remain<0?'超支 '+nt(Math.abs(remain)):'剩餘 '+nt(remain)}`,rows:s.lifeRows})} label='生活費' value={nt(s.life)} sub={remain<0?'超支 '+nt(Math.abs(remain)):'剩餘 '+nt(remain)} bad={remain<0}/><Metric onClick={()=>setDetail({title:'固定支出',total:s.fix,sub:`${period}｜固定支出 ${s.fixedRows.length} 筆`,rows:s.fixedRows})} label='固定支出' value={nt(s.fix)} sub='手機 / 訂閱 / 保險'/></div><Card><Title t='區間大類支出' r='占總支出'/><Chart rows={s.groups} total={s.expense}/></Card><Card><Title t='飲食細項' r={'占飲食 '+nt(foodTotal)}/><Chart rows={s.foods} total={foodTotal}/></Card><Card><details><summary style={{cursor:'pointer',fontWeight:900}}>區間交易紀錄：{rows.length} 筆</summary>{rows.map(t=><div key={t.id} style={{display:'grid',gridTemplateColumns:'1fr auto',padding:'10px 0',borderBottom:'1px solid rgba(148,163,184,.12)'}}><div><b>{t.note}</b><div style={{color:'#94a3b8',fontSize:12}}>{t.date}｜{t.category}｜{t.type}</div></div><b style={{color:t.type==='收入'?'#86efac':'#fca5a5'}}>{nt(t.amount)}</b></div>)}</details></Card><DetailSheet detail={detail} onClose={()=>setDetail(null)}/></>}
function Entry({txs,setTxs}){const [f,setF]=useState({date:today(),type:'支出',amount:'',account:'自用',category:'飲食',note:''});function save(){const amount=Number(f.amount||0);if(!amount)return;const c=f.type==='收入'?f.category:(f.category==='飲食'?cat(f.note):f.category);setTxs([{id:'m'+Date.now(),...f,amount,category:c,note:f.note||c},...txs]);setF({...f,amount:'',note:''})}return <><Card><Title t='快速記帳' r='金額 + 備註'/><div style={{display:'grid',gap:10}}><input value={f.amount} onChange={e=>setF({...f,amount:e.target.value})} style={{...input(),fontSize:22,fontWeight:900}} placeholder='金額' inputMode='numeric'/><input value={f.note} onChange={e=>setF({...f,note:e.target.value})} style={input()} placeholder='備註：早餐 / 薪水 / 加油'/><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><input type='date' value={f.date} onChange={e=>setF({...f,date:e.target.value})} style={input()}/><select value={f.type} onChange={e=>setF({...f,type:e.target.value})} style={input()}>{['支出','收入'].map(x=><option key={x}>{x}</option>)}</select></div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><select value={f.account} onChange={e=>setF({...f,account:e.target.value})} style={input()}>{['家用','自用','投資'].map(x=><option key={x}>{x}</option>)}</select><select value={f.category} onChange={e=>setF({...f,category:e.target.value})} style={input()}>{cats.map(x=><option key={x}>{x}</option>)}</select></div><Btn onClick={save}>儲存這筆</Btn></div></Card><Card><Title t='交易清單' r={`${txs.length} 筆`}/>{txs.map(t=><div key={t.id} style={{display:'grid',gridTemplateColumns:'1fr auto auto',gap:10,padding:'10px 0',borderBottom:'1px solid rgba(148,163,184,.12)'}}><div><b>{t.note}</b><div style={{color:'#94a3b8',fontSize:12}}>{t.date}｜{t.category}｜{t.type}</div></div><b>{nt(t.amount)}</b><button onClick={()=>setTxs(txs.filter(x=>x.id!==t.id))} style={{background:'transparent',color:'#fca5a5',border:'1px solid rgba(248,113,113,.3)',borderRadius:10}}>刪</button></div>)}</Card></>}
function Budget({txs}){const s=stat(txs,{start:monthStart(),end:today()});return <><Card><Title t='個人生活費預算' r='本月'/><Metric label='生活費' value={nt(s.life)} sub={s.life>8000?'超支 '+nt(s.life-8000):'剩餘 '+nt(8000-s.life)} bad={s.life>8000}/></Card><Card><Title t='固定支出' r='本月'/><Metric label='固定支出' value={nt(s.fix)} sub='手機 / 訂閱 / 保險'/></Card></>}
function Assets(){const assets=[{id:'a1',name:'合作金庫（自用）',amount:76,note:'自用'},{id:'a2',name:'富邦銀行（投資）',amount:3299,note:'約當台幣'},{id:'a3',name:'郵局存款（家用）',amount:17152,note:'手動輸入'},{id:'a4',name:'現金',amount:0,note:'手動輸入'}];const hunter={total:94.37,holdings:10};const total=assets.reduce((s,a)=>s+Number(a.amount||0),0),grand=total+hunter.total*RATE;return <><Card><Title t='綜合總資產' r='TWD 估算'/><div style={{fontSize:42,fontWeight:1000}}>{nt(grand)}</div><p style={{color:'#94a3b8'}}>手動資產 {nt(total)} + 獵人投資 {usd(hunter.total)} × 匯率 {RATE}</p></Card><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}><Metric label='手動資產' value={nt(total)} sub='銀行約當台幣'/><Metric label='獵人投資市值' value={usd(hunter.total)} sub='BTC + xStocks'/></div><Card><Title t='手動資產清單' r={`${assets.length} 筆`}/>{assets.map(a=><div key={a.id} style={{display:'grid',gridTemplateColumns:'1fr auto',padding:'10px 0',borderBottom:'1px solid rgba(148,163,184,.12)'}}><div><b>{a.name}</b><div style={{color:'#94a3b8',fontSize:12}}>{a.note}</div></div><b style={{color:'#86efac'}}>{nt(a.amount)}</b></div>)}</Card></>}
export default function FinancialOSPage(){const [tab,setTab]=useState('dashboard');const [txs,setTxs]=useState(seed);useEffect(()=>{try{const s=JSON.parse(localStorage.getItem(TX_KEY)||'null');if(Array.isArray(s)){const ids=new Set(s.map(x=>x.id));setTxs([...seed.filter(x=>!ids.has(x.id)),...s])}}catch{}},[]);useEffect(()=>{try{localStorage.setItem(TX_KEY,JSON.stringify(txs))}catch{}},[txs]);const tabs=[['dashboard','總覽'],['entry','記帳'],['budget','預算'],['assets','資產']];return <main style={{minHeight:'100vh',color:'#f8fafc',background:'radial-gradient(circle at 50% -10%,rgba(34,197,94,.16),transparent 28%),linear-gradient(180deg,#020617,#0f172a 55%,#111827)',fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif"}}><div style={{maxWidth:430,margin:'0 auto',padding:'18px 14px 130px'}}><section style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,marginBottom:14}}><div><div style={{fontSize:22,fontWeight:1000}}>Josh Financial OS</div><div style={{color:'#94a3b8',fontSize:12,fontWeight:800,marginTop:5}}>多元記帳本 V3.2｜點擊明細｜個人生活費</div></div><a href='/josh-os' style={{color:'#bbf7d0',textDecoration:'none',border:'1px solid rgba(34,197,94,.42)',borderRadius:999,padding:'7px 10px',fontSize:12,fontWeight:950}}>四合一</a></section>{tab==='dashboard'&&<Dashboard txs={txs}/>} {tab==='entry'&&<Entry txs={txs} setTxs={setTxs}/>} {tab==='budget'&&<Budget txs={txs}/>} {tab==='assets'&&<Assets/>}</div><nav style={{position:'fixed',left:0,right:0,bottom:0,background:'rgba(2,6,23,.92)',backdropFilter:'blur(16px)',borderTop:'1px solid rgba(34,197,94,.24)',padding:'8px 10px 10px'}}><div style={{maxWidth:430,margin:'0 auto',display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6}}>{tabs.map(([k,l])=><button key={k} onClick={()=>setTab(k)} style={{border:'none',borderRadius:12,padding:'9px 4px',background:tab===k?'rgba(34,197,94,.16)':'transparent',color:tab===k?'#f8fafc':'#94a3b8',fontSize:11,fontWeight:900}}>{l}</button>)}</div></nav></main>}
