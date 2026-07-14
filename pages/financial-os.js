import { useEffect, useMemo, useState } from 'react';

const TX_KEY = 'josh-financial-os-v36-db';
const OLD_TX_KEY = 'josh-financial-os-v32-tx';
const BUDGET_KEY = 'josh-financial-os-v38-budgets';
const ASSET_KEY = 'josh-ledger-v42-assets';
const RATE = 32.5;
const INVEST_DAY = 12;
const MONTHLY_INVEST_TWD = 2000 + 60 * RATE;

const food = ['早餐', '午餐', '晚餐', '飲料', '咖啡', '菸', '點心/宵夜'];
const fixed = ['手機月租費', 'ChatGPT', 'Google One'];
const accountOptions = ['家用', '自用', '薪轉', '投資'];
const cats = ['飲食', '家用', '居家修繕', '教育', '服飾', '交通', '娛樂', '醫療', '金融', '固定支出', '生活用品', '生活費', '薪水', '薪轉', '退稅', '早餐', '午餐', '晚餐', '飲料', '咖啡', '菸', '點心/宵夜', '機車', '醫療健康', '其他', '富邦DCA'];
const assetTypes = ['現金', '銀行', '薪轉', '投資', '家用', '教育', '其他'];
const defaultBudgets = [
  { id: 'b-living', name: '生活費', category: '生活費', amount: 8000, mode: 'living_cycle' },
  { id: 'b-invest', name: '富邦DCA', category: '富邦DCA', amount: MONTHLY_INVEST_TWD, mode: 'investment' },
];
const defaultAssets = [
  { id: 'a1', name: '合作金庫（自用）', amount: 76, type: '銀行', note: '自用' },
  { id: 'a2', name: '富邦銀行（投資）', amount: 3299, type: '投資', note: '約當台幣' },
  { id: 'a3', name: '郵局存款（家用）', amount: 17152, type: '家用', note: '手動輸入' },
  { id: 'a4', name: '現金', amount: 0, type: '現金', note: '手動輸入' },
];

const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => fmt(new Date());
const monthStart = () => today().slice(0, 7) + '-01';
const parseDate = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
const nt = (n) => '$' + Number(n || 0).toLocaleString('zh-TW', { maximumFractionDigits: 0 });
const usd = (n) => 'USD ' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sortTx = (rows) => [...rows].sort((a, b) => (b.date || '').localeCompare(a.date || '') || String(b.id || '').localeCompare(String(a.id || '')));
const cleanDb = (rows) => Array.isArray(rows) ? rows.filter((t) => t && t.id && !(t.id === 'income-tax-202606' || (t.date === '2026-06-30' && t.type === '收入' && t.category === '退稅' && Number(t.amount) === 1300))).map((t) => ({ ...t, amount: Number(t.amount || 0), account: t.account || '自用', budgetId: t.budgetId || '' })) : [];
const cleanAssets = (rows) => Array.isArray(rows) ? rows.filter((a) => a && a.id && a.name).map((a) => ({ ...a, amount: Number(a.amount || 0), type: a.type || '其他' })) : defaultAssets;
const cleanBudgets = (rows) => Array.isArray(rows) ? rows.filter((b) => b && b.id && b.name).map((b) => ({ ...b, amount: Number(b.amount || 0), mode: b.id === 'b-living' ? 'living_cycle' : b.id === 'b-invest' ? 'investment' : (b.mode || 'project') })) : defaultBudgets;
const isHouse = (t) => /家用/.test(t.note || '') || t.account === '家用';
const isLiving = (c) => food.includes(c) || ['生活用品', '機車', '生活費'].includes(c);

function readLocal() {
  let transactions = [];
  let budgets = defaultBudgets;
  let assets = defaultAssets;
  try { const raw = localStorage.getItem(TX_KEY) || localStorage.getItem(OLD_TX_KEY); transactions = raw ? cleanDb(JSON.parse(raw)) : []; } catch {}
  try { const raw = JSON.parse(localStorage.getItem(BUDGET_KEY) || 'null'); if (Array.isArray(raw)) budgets = cleanBudgets(raw); } catch {}
  try { const raw = JSON.parse(localStorage.getItem(ASSET_KEY) || 'null'); if (Array.isArray(raw)) assets = cleanAssets(raw); } catch {}
  return { transactions, budgets, assets };
}

function livingCycle(date = new Date()) {
  const current = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const start = current.getDate() >= 10 ? new Date(current.getFullYear(), current.getMonth(), 10) : new Date(current.getFullYear(), current.getMonth() - 1, 10);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 9);
  return { start: fmt(start), end: fmt(end) };
}

function autoCat(note) {
  if (/薪水|薪轉|薪資|salary/i.test(note)) return '薪水';
  if (/地磚|燈具|油漆|地板|窗戶|修繕/.test(note)) return '居家修繕';
  if (/家用/.test(note)) return '生活費';
  if (/學費|空大|學校|教育|書|筆電|筆記本|課程|補習/.test(note)) return '教育';
  if (/Chat/i.test(note)) return 'ChatGPT';
  if (/Google/i.test(note)) return 'Google One';
  if (/電信|手機/.test(note)) return '手機月租費';
  if (/加油|停車|機車|罰單/.test(note)) return '機車';
  if (/耳|鼻|醫|看耳朵|洗鼻器/.test(note)) return '醫療健康';
  if (/富邦/.test(note)) return '金融';
  if (/Badoo|足球/.test(note)) return '娛樂';
  if (/雨衣/.test(note)) return '服飾';
  if (/早餐/.test(note)) return '早餐';
  if (/午餐|中餐/.test(note)) return '午餐';
  if (/晚餐/.test(note)) return '晚餐';
  if (/咖啡|冰美式|冰拿|熟拿|黑咖啡/.test(note)) return '咖啡';
  if (/菸|芬/.test(note)) return '菸';
  if (/飲料/.test(note)) return '飲料';
  if (/豆|酥|麵包|挫冰|雞排|冰/.test(note)) return '點心/宵夜';
  return '其他';
}

function groupTx(t) {
  const c = t.category;
  if (c === '居家修繕') return '居家修繕';
  if (c === '家用' || isHouse(t)) return '家用';
  if (c === '教育') return '教育';
  if (food.includes(c)) return '飲食';
  if (c === '機車') return '交通';
  if (c === '醫療健康') return '醫療';
  if (fixed.includes(c)) return '固定支出';
  if (['服飾', '娛樂', '金融', '生活用品', '交通', '醫療'].includes(c)) return c;
  return '其他';
}

function investmentRows(r) {
  const rows = [];
  let d = new Date(parseDate(r.start).getFullYear(), parseDate(r.start).getMonth(), 1);
  const end = parseDate(r.end);
  while (d <= end) {
    const due = new Date(d.getFullYear(), d.getMonth(), INVEST_DAY);
    const ds = fmt(due);
    if (ds >= r.start && ds <= r.end) rows.push({ id: 'invest-' + ds, date: ds, type: '投資扣款', amount: MONTHLY_INVEST_TWD, account: '投資', category: '富邦DCA', note: '富邦DCA：0050 2000 + VOO 30USD + QQQM 30USD' });
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  }
  return rows;
}

function stat(txs, r) {
  const tx = txs.filter((t) => t.date >= r.start && t.date <= r.end);
  const ex = tx.filter((t) => t.type === '支出');
  const inc = tx.filter((t) => t.type === '收入');
  const invRows = investmentRows(r);
  const sum = (a) => a.reduce((s, x) => s + Number(x.amount || 0), 0);
  const income = sum(inc), expense = sum(ex), invest = sum(invRows), totalOutflow = expense + invest;
  const lifeRows = ex.filter((t) => isLiving(t.category) && !isHouse(t));
  const groups = ['飲食', '家用', '居家修繕', '教育', '服飾', '交通', '娛樂', '醫療', '金融', '固定支出', '生活用品', '其他'].map((name) => ({ name, amount: sum(ex.filter((t) => groupTx(t) === name)), rows: ex.filter((t) => groupTx(t) === name) })).filter((x) => x.amount > 0);
  const outflowGroups = invest > 0 ? [...groups, { name: '投資', amount: invest, rows: invRows }] : groups;
  const salaryTransfer = sum(inc.filter((t) => t.account === '薪轉' || t.category === '薪轉' || t.category === '薪水'));
  return { tx, ex, inc, invRows, income, expense, invest, totalOutflow, balance: income - totalOutflow, life: sum(lifeRows), lifeRows, groups, outflowGroups, salaryTransfer };
}

function Card(p) { return <section onClick={p.onClick} style={{ background: 'linear-gradient(160deg,rgba(17,24,39,.96),rgba(15,23,42,.96))', border: '1px solid rgba(34,197,94,.36)', borderRadius: 22, padding: 16, marginBottom: 12, boxShadow: '0 18px 46px rgba(34,197,94,.13),0 12px 34px rgba(0,0,0,.28)', cursor: p.onClick ? 'pointer' : 'default', ...p.style }}>{p.children}</section>; }
const Title = ({ t, r }) => <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}><h2 style={{ margin: 0, fontSize: 18, fontWeight: 950 }}>{t}</h2>{r && <b style={{ color: '#86efac', fontSize: 12 }}>{r}</b>}</div>;
const input = () => ({ width: '100%', background: 'rgba(15,23,42,.88)', border: '1px solid rgba(34,197,94,.28)', color: '#f8fafc', borderRadius: 14, padding: 12, fontSize: 15, outline: 'none' });
function Btn(p) { return <button onClick={p.onClick} style={{ border: '1px solid rgba(212,175,55,.78)', borderRadius: 14, padding: '10px 8px', background: 'linear-gradient(180deg,rgba(250,204,21,.28),rgba(92,64,16,.75))', color: '#fff7bd', fontWeight: 1000, ...p.style }}>{p.children}</button>; }
function Metric({ label, value, sub, good, bad }) { return <Card style={{ marginBottom: 0, padding: 14, borderColor: bad ? 'rgba(255,82,82,.55)' : good ? 'rgba(34,197,94,.6)' : undefined }}><div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 800 }}>{label}</div><div style={{ fontSize: 24, fontWeight: 1000, color: bad ? '#ff5252' : good ? '#86efac' : '#fff' }}>{value}</div>{sub && <div style={{ color: bad ? '#ff5252' : '#94a3b8', fontSize: 12, marginTop: 6 }}>{sub}</div>}</Card>; }
function TxList({ rows, budgets = [] }) { const budgetName = (id) => budgets.find((b) => b.id === id)?.name; return <div style={{ marginTop: 8, borderTop: '1px solid rgba(148,163,184,.12)' }}>{sortTx(rows).map((t) => <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, padding: '10px 0', borderBottom: '1px solid rgba(148,163,184,.12)' }}><div><b>{t.note}</b><div style={{ color: '#94a3b8', fontSize: 12, marginTop: 3 }}>{t.date}｜{t.category}｜{t.account}｜{t.type}{t.budgetId ? `｜專案：${budgetName(t.budgetId) || t.budgetId}` : ''}</div></div><b style={{ color: t.type === '收入' ? '#86efac' : t.type === '投資扣款' ? '#facc15' : '#fca5a5' }}>{nt(t.amount)}</b></div>)}</div>; }

function Dashboard({ txs, sync }) {
  const cycle = livingCycle();
  const [r, setR] = useState({ start: cycle.start, end: today() });
  const [selectedGroup, setSelectedGroup] = useState(null);
  const s = stat(txs, r);
  const livingStats = stat(txs, { start: cycle.start, end: today() });
  const remain = 8000 - livingStats.life;
  const outflowRows = [...s.ex, ...s.invRows];
  return <>
    <Card><Title t="日期篩選" r="Date Range" /><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><input type="date" value={r.start} onChange={(e) => setR({ ...r, start: e.target.value })} style={input()} /><input type="date" value={r.end} onChange={(e) => setR({ ...r, end: e.target.value })} style={input()} /></div><div style={{ color: '#86efac', fontSize: 11, marginTop: 9, fontWeight: 900 }}>生活費週期固定：{cycle.start}～{cycle.end}</div></Card>
    <Card><Title t="可用結餘" r={sync.source === 'neon' ? 'Neon' : 'Local 備援'} /><div style={{ fontSize: 42, fontWeight: 1000, color: s.balance >= 0 ? '#86efac' : '#ff5252' }}>{nt(s.balance)}</div><p style={{ color: '#94a3b8' }}>收入 {nt(s.income)} - 總支出 {nt(s.totalOutflow)}（一般 {nt(s.expense)} + 投資 {nt(s.invest)}）</p></Card>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}><Metric label="區間收入" value={nt(s.income)} good={s.income > 0} /><Metric label="薪轉收入" value={nt(s.salaryTransfer)} good={s.salaryTransfer > 0} /><Metric label="區間總支出" value={nt(s.totalOutflow)} sub={`一般支出 ${nt(s.expense)}｜投資 ${nt(s.invest)}`} /><Metric label="生活費（10日週期）" value={nt(livingStats.life)} sub={`${cycle.start}～${cycle.end}｜${remain < 0 ? `超支 ${nt(Math.abs(remain))}` : `剩餘 ${nt(remain)}`}`} bad={remain < 0} /></div>
    <Card><Title t="區間大類支出" r={`${s.outflowGroups.length} 類｜點擊看明細`} />{s.outflowGroups.map((g) => <button key={g.name} onClick={() => setSelectedGroup(selectedGroup?.name === g.name ? null : g)} style={{ width: '100%', display: 'grid', gridTemplateColumns: '82px 1fr auto', gap: 10, padding: '10px 0', border: 0, borderBottom: '1px solid rgba(148,163,184,.08)', background: selectedGroup?.name === g.name ? 'rgba(34,197,94,.08)' : 'transparent', color: '#f8fafc', textAlign: 'left' }}><b>{g.name}</b><div style={{ height: 12, borderRadius: 99, background: '#243044', overflow: 'hidden', marginTop: 4 }}><div style={{ height: '100%', width: Math.min(100, Math.max(1, g.amount / Math.max(1, s.totalOutflow) * 100)) + '%', background: 'linear-gradient(90deg,#38bdf8,#22c55e)' }} /></div><b>{nt(g.amount)}　›</b></button>)}{selectedGroup && <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(34,197,94,.24)' }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><b style={{ color: '#86efac' }}>{selectedGroup.name}支出細項</b><button onClick={() => setSelectedGroup(null)} style={{ border: 0, background: 'transparent', color: '#94a3b8', fontWeight: 900 }}>收合</button></div><TxList rows={selectedGroup.rows || []} /></div>}</Card>
    <Card><Title t="區間支出明細" r={`${outflowRows.length} 筆｜含投資`} />{outflowRows.length ? <TxList rows={outflowRows} /> : <div style={{ color: '#94a3b8', fontSize: 12 }}>此區間沒有支出。</div>}</Card>
    <Card><Title t="最近交易" r={`${s.tx.length} 筆`} /><TxList rows={s.tx.slice(0, 40)} /></Card>
  </>;
}

function Entry({ txs, setTxs, budgets }) {
  const [form, setForm] = useState({ amount: '', note: '', date: today(), type: '支出', account: '自用', category: '飲食', budgetId: '' });
  const projectBudgets = budgets.filter((b) => !['b-living', 'b-invest'].includes(b.id));
  function save() { const amount = Number(form.amount || 0); if (!amount) return; const category = form.category === '飲食' ? autoCat(form.note) : form.category; const account = form.type === '收入' && /薪水|薪轉|薪資|salary/i.test(form.note || category) ? '薪轉' : form.account; setTxs([{ id: 'm' + Date.now(), ...form, account, amount, category, note: form.note || category, budgetId: form.type === '支出' ? form.budgetId : '' }, ...txs]); setForm({ ...form, amount: '', note: '', budgetId: '' }); }
  return <><Card><Title t="快速記帳" r="Local 寫入（過渡）" /><div style={{ display: 'grid', gap: 10 }}><input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} style={{ ...input(), fontSize: 22, fontWeight: 900 }} placeholder="金額" inputMode="numeric" /><input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} style={input()} placeholder="備註" /><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} style={input()} /><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, account: e.target.value === '收入' ? '薪轉' : form.account, category: e.target.value === '收入' ? '薪水' : form.category, budgetId: e.target.value === '收入' ? '' : form.budgetId })} style={input()}>{['支出', '收入'].map((x) => <option key={x}>{x}</option>)}</select></div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><select value={form.account} onChange={(e) => setForm({ ...form, account: e.target.value })} style={input()}>{accountOptions.map((x) => <option key={x}>{x}</option>)}</select><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={input()}>{cats.map((x) => <option key={x}>{x}</option>)}</select></div>{form.type === '支出' && <select value={form.budgetId} onChange={(e) => setForm({ ...form, budgetId: e.target.value })} style={input()}><option value="">不指定專案預算</option>{projectBudgets.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>}<Btn onClick={save}>儲存這筆</Btn></div></Card><Card><Title t="交易清單" r={`${txs.length} 筆`} /><TxList rows={txs} budgets={budgets} /></Card></>;
}

function Budget({ txs, budgets, setBudgets }) {
  const emptyBudget = { name: '', category: '生活費', amount: '' };
  const [form, setForm] = useState(emptyBudget);
  const [editingId, setEditingId] = useState('');
  const [editForm, setEditForm] = useState(emptyBudget);
  const cycle = livingCycle();
  const livingStats = stat(txs, { start: cycle.start, end: today() });
  const monthStats = stat(txs, { start: monthStart(), end: today() });
  const budgetRows = (b) => b.id === 'b-living' || b.mode === 'living_cycle' ? livingStats.lifeRows : b.id === 'b-invest' || b.mode === 'investment' ? monthStats.invRows : txs.filter((t) => t.type === '支出' && t.budgetId === b.id);
  const spent = (b) => budgetRows(b).reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const periodLabel = (b) => b.id === 'b-living' || b.mode === 'living_cycle' ? `${cycle.start.slice(5)}～${cycle.end.slice(5)}` : b.id === 'b-invest' || b.mode === 'investment' ? '本月' : '專案累計';
  function addBudget() { const amount = Number(form.amount || 0); if (!amount) return; setBudgets([{ id: 'b' + Date.now(), name: form.name.trim() || form.category, category: form.category, amount, mode: 'project' }, ...budgets]); setForm(emptyBudget); }
  function saveEdit(id) { const amount = Number(editForm.amount); if (!editForm.name.trim() || !Number.isFinite(amount) || amount < 0) return; setBudgets(budgets.map((b) => b.id === id ? { ...b, name: editForm.name.trim(), category: editForm.category, amount } : b)); setEditingId(''); }
  return <><Card><Title t="新增預算" r="Local 寫入（過渡）" /><div style={{ display: 'grid', gap: 10 }}><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={input()} placeholder="預算名稱" /><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={input()}>{cats.filter((x) => !['薪水', '薪轉', '退稅'].includes(x)).map((x) => <option key={x}>{x}</option>)}</select><input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} style={input()} placeholder="預算金額" /><Btn onClick={addBudget}>新增預算</Btn></div></Card>{budgets.map((b) => { const rows = budgetRows(b); const used = spent(b); const remain = Number(b.amount || 0) - used; if (editingId === b.id) return <Card key={b.id}><Title t="編輯預算" r={periodLabel(b)} /><div style={{ display: 'grid', gap: 8 }}><input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} style={input()} /><input value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} style={input()} /><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}><button onClick={() => saveEdit(b.id)}>儲存</button><button onClick={() => setEditingId('')}>取消</button><button onClick={() => setBudgets(budgets.filter((x) => x.id !== b.id))}>刪除</button></div></div></Card>; return <Card key={b.id}><Title t={b.name} r={periodLabel(b)} /><Metric label={b.category} value={nt(used)} sub={`${remain < 0 ? '超支 ' + nt(Math.abs(remain)) : '剩餘 ' + nt(remain)}｜預算 ${nt(b.amount)}`} bad={remain < 0} />{rows.length > 0 && <TxList rows={rows} budgets={budgets} />}<button onClick={() => { setEditingId(b.id); setEditForm({ name: b.name, category: b.category, amount: String(b.amount) }); }} style={{ marginTop: 10 }}>編輯</button></Card>; })}</>;
}

function AssetPage({ assets, setAssets }) {
  const emptyAsset = { name: '', type: '現金', amount: '', note: '' };
  const [form, setForm] = useState(emptyAsset);
  const [editingId, setEditingId] = useState('');
  const [editForm, setEditForm] = useState(emptyAsset);
  const [ledger, setLedger] = useState({ loading: true, error: '', marketValue: 0 });
  const manualTwd = useMemo(() => assets.reduce((sum, item) => sum + Number(item.amount || 0), 0), [assets]);
  const hunterUsd = Number(ledger.marketValue || 0);
  async function loadWalletLedger() { setLedger((x) => ({ ...x, loading: true, error: '' })); try { const res = await fetch('/api/wallet-ledger?t=' + Date.now(), { cache: 'no-store' }); const json = await res.json(); if (!res.ok || json.ok === false) throw new Error(json.message || json.error || 'wallet-ledger failed'); setLedger({ loading: false, error: '', marketValue: Number(json.portfolioMarketValue ?? json.currentValue ?? json.marketValue ?? 0) }); } catch (error) { setLedger({ loading: false, error: error.message || '同步失敗', marketValue: 0 }); } }
  useEffect(() => { loadWalletLedger(); }, []);
  function addAsset() { const amount = Number(form.amount || 0); if (!form.name.trim() || !Number.isFinite(amount)) return; setAssets([{ id: 'asset-' + Date.now(), name: form.name.trim(), type: form.type, amount, note: form.note.trim() || '手動輸入' }, ...assets]); setForm(emptyAsset); }
  function saveEdit(id) { const amount = Number(editForm.amount); if (!editForm.name.trim() || !Number.isFinite(amount)) return; setAssets(assets.map((a) => a.id === id ? { ...a, name: editForm.name.trim(), type: editForm.type, amount, note: editForm.note.trim() || '手動輸入' } : a)); setEditingId(''); }
  return <><Card><Title t="綜合總資產" r="TWD 估算" /><div style={{ fontSize: 42, fontWeight: 1000 }}>{nt(manualTwd + hunterUsd * RATE)}</div><p style={{ color: '#94a3b8' }}>手動資產 {nt(manualTwd)} + 獵人投資 {usd(hunterUsd)} × {RATE}</p></Card><Card><Title t="新增手動資產" r="Local 寫入（過渡）" /><div style={{ display: 'grid', gap: 10 }}><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={input()} placeholder="資產名稱" /><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={input()}>{assetTypes.map((x) => <option key={x}>{x}</option>)}</select><input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} style={input()} placeholder="金額" /><input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} style={input()} placeholder="備註" /><Btn onClick={addAsset}>新增資產</Btn></div></Card><Card><Title t="手動資產清單" r={`${assets.length} 筆`} />{assets.map((a) => editingId === a.id ? <div key={a.id} style={{ display: 'grid', gap: 8, padding: '10px 0' }}><input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} style={input()} /><input value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} style={input()} /><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}><button onClick={() => saveEdit(a.id)}>儲存</button><button onClick={() => setEditingId('')}>取消</button><button onClick={() => setAssets(assets.filter((x) => x.id !== a.id))}>刪除</button></div></div> : <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, padding: '12px 0', borderBottom: '1px solid rgba(148,163,184,.12)' }}><div><b>{a.name}</b><div style={{ color: '#94a3b8', fontSize: 12 }}>{a.type}｜{a.note}</div></div><b>{nt(a.amount)}</b><button onClick={() => { setEditingId(a.id); setEditForm({ name: a.name, type: a.type, amount: String(a.amount), note: a.note || '' }); }}>編輯</button></div>)}</Card></>;
}

export default function FinancialOS() {
  const [tab, setTab] = useState('dashboard');
  const [txs, setTxs] = useState([]);
  const [budgets, setBudgets] = useState(defaultBudgets);
  const [assets, setAssets] = useState(defaultAssets);
  const [ready, setReady] = useState(false);
  const [sync, setSync] = useState({ loading: true, source: '', error: '', lastSync: '', counts: null });

  useEffect(() => {
    let active = true;
    async function load() {
      const local = readLocal();
      try {
        const res = await fetch('/api/financial/data?limit=1000&t=' + Date.now(), { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok || json.ok === false || !Array.isArray(json.transactions)) throw new Error(json.error || 'Neon 讀取失敗');
        if (!active) return;
        const cloudTx = cleanDb(json.transactions);
        const cloudBudgets = cleanBudgets(json.budgets);
        const cloudAssets = cleanAssets(json.assets);
        setTxs(cloudTx);
        setBudgets(cloudBudgets);
        setAssets(cloudAssets);
        localStorage.setItem(TX_KEY, JSON.stringify(cloudTx));
        localStorage.setItem(BUDGET_KEY, JSON.stringify(cloudBudgets));
        localStorage.setItem(ASSET_KEY, JSON.stringify(cloudAssets));
        setSync({ loading: false, source: 'neon', error: '', lastSync: new Date().toLocaleString('zh-TW'), counts: json.counts || { transactions: cloudTx.length, budgets: cloudBudgets.length, assets: cloudAssets.length } });
      } catch (error) {
        if (!active) return;
        setTxs(local.transactions);
        setBudgets(local.budgets);
        setAssets(local.assets);
        setSync({ loading: false, source: 'local', error: error.message || 'Neon 讀取失敗', lastSync: '', counts: { transactions: local.transactions.length, budgets: local.budgets.length, assets: local.assets.length } });
      } finally {
        if (active) setReady(true);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  useEffect(() => { if (ready) localStorage.setItem(TX_KEY, JSON.stringify(cleanDb(txs))); }, [txs, ready]);
  useEffect(() => { if (ready) localStorage.setItem(BUDGET_KEY, JSON.stringify(cleanBudgets(budgets))); }, [budgets, ready]);
  useEffect(() => { if (ready) localStorage.setItem(ASSET_KEY, JSON.stringify(cleanAssets(assets))); }, [assets, ready]);

  const statusText = sync.loading ? '正在讀取 Neon…' : sync.source === 'neon' ? `Neon 已同步｜交易 ${sync.counts?.transactions ?? txs.length}・預算 ${sync.counts?.budgets ?? budgets.length}・資產 ${sync.counts?.assets ?? assets.length}` : `目前使用 Local DB 備援｜${sync.error}`;
  const statusColor = sync.source === 'local' ? '#fca5a5' : '#86efac';

  return <main style={{ minHeight: '100vh', color: '#f8fafc', background: 'radial-gradient(circle at 50% -10%,rgba(34,197,94,.16),transparent 28%),linear-gradient(180deg,#020617,#0f172a 55%,#111827)', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}><div style={{ maxWidth: 430, margin: '0 auto', padding: '18px 14px 130px' }}><section style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}><div><div style={{ fontSize: 22, fontWeight: 1000 }}>Josh 多元記帳本</div><div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 800, marginTop: 5 }}>多元記帳本 V5.1｜Neon 優先讀取｜Local 備援</div></div><a href="/josh-os" style={{ color: '#bbf7d0', textDecoration: 'none', border: '1px solid rgba(34,197,94,.42)', borderRadius: 999, padding: '7px 10px', fontSize: 12, fontWeight: 950 }}>四合一</a></section><div style={{ color: statusColor, border: `1px solid ${sync.source === 'local' ? 'rgba(248,113,113,.35)' : 'rgba(34,197,94,.35)'}`, background: sync.source === 'local' ? 'rgba(127,29,29,.16)' : 'rgba(34,197,94,.08)', borderRadius: 12, padding: '9px 11px', fontSize: 11, fontWeight: 900, marginBottom: 12 }}>{statusText}{sync.lastSync ? `｜${sync.lastSync}` : ''}</div>{tab === 'dashboard' && <Dashboard txs={txs} sync={sync} />}{tab === 'entry' && <Entry txs={txs} setTxs={setTxs} budgets={budgets} />}{tab === 'budget' && <Budget txs={txs} budgets={budgets} setBudgets={setBudgets} />}{tab === 'assets' && <AssetPage assets={assets} setAssets={setAssets} />}</div><nav style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: 'rgba(2,6,23,.92)', backdropFilter: 'blur(16px)', borderTop: '1px solid rgba(34,197,94,.24)', padding: '8px 8px 10px' }}><div style={{ maxWidth: 430, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 5 }}>{[['dashboard', '總覽'], ['entry', '記帳'], ['audit', '查帳'], ['budget', '預算'], ['assets', '資產']].map(([key, label]) => key === 'audit' ? <a key={key} href="/financial-audit" style={{ border: '1px solid rgba(212,175,55,.65)', borderRadius: 13, padding: '9px 2px', background: 'rgba(92,64,16,.45)', color: '#fff7bd', fontSize: 11, fontWeight: 1000, textAlign: 'center', textDecoration: 'none' }}>{label}</a> : <button key={key} onClick={() => setTab(key)} style={{ border: '1px solid rgba(212,175,55,.65)', borderRadius: 13, padding: '9px 2px', background: tab === key ? 'linear-gradient(180deg,rgba(250,204,21,.32),rgba(92,64,16,.78))' : 'rgba(92,64,16,.45)', color: '#fff7bd', fontSize: 11, fontWeight: 1000 }}>{label}</button>)}</div></nav></main>;
}
