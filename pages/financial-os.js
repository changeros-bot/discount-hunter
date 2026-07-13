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
const cats = ['飲食', '家用', '教育', '服飾', '交通', '娛樂', '醫療', '金融', '固定支出', '生活用品', '生活費', '薪水', '薪轉', '退稅', '早餐', '午餐', '晚餐', '飲料', '咖啡', '菸', '點心/宵夜', '機車', '醫療健康', '其他', '富邦DCA'];
const assetTypes = ['現金', '銀行', '薪轉', '投資', '家用', '教育', '其他'];
const defaultBudgets = [
  { id: 'b-living', name: '生活費', category: '生活費', amount: 8000 },
  { id: 'b-invest', name: '富邦DCA', category: '富邦DCA', amount: MONTHLY_INVEST_TWD },
];
const defaultAssets = [
  { id: 'a1', name: '合作金庫（自用）', amount: 76, type: '銀行', note: '自用' },
  { id: 'a2', name: '富邦銀行（投資）', amount: 3299, type: '投資', note: '約當台幣' },
  { id: 'a3', name: '郵局存款（家用）', amount: 17152, type: '家用', note: '手動輸入' },
  { id: 'a4', name: '現金', amount: 0, type: '現金', note: '手動輸入' },
];
const sample = [{ id: 'income-salary-202606', date: '2026-06-30', type: '收入', amount: 50350, account: '薪轉', category: '薪水', note: '薪水' }];

const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => fmt(new Date());
const monthStart = () => today().slice(0, 7) + '-01';
const parseDate = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
const nt = (n) => '$' + Number(n || 0).toLocaleString('zh-TW', { maximumFractionDigits: 0 });
const usd = (n) => 'USD ' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sortTx = (rows) => [...rows].sort((a, b) => (b.date || '').localeCompare(a.date || '') || String(b.id || '').localeCompare(String(a.id || '')));
const cleanDb = (rows) => Array.isArray(rows) ? rows.filter((t) => t && t.id && !(t.id === 'income-tax-202606' || (t.date === '2026-06-30' && t.type === '收入' && t.category === '退稅' && Number(t.amount) === 1300))).map((t) => ({ ...t, account: t.account || '自用' })) : [];
const cleanAssets = (rows) => Array.isArray(rows) ? rows.filter((a) => a && a.id && a.name).map((a) => ({ ...a, amount: Number(a.amount || 0), type: a.type || '其他' })) : defaultAssets;
const isHouse = (t) => /家用/.test(t.note || '') || t.account === '家用';
const isLiving = (c) => food.includes(c) || ['生活用品', '機車', '生活費'].includes(c);

function autoCat(note) {
  if (/薪水|薪轉|薪資|salary/i.test(note)) return '薪水';
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
  if (isHouse(t)) return '家用';
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
  const income = sum(inc), expense = sum(ex), invest = sum(invRows);
  const lifeRows = ex.filter((t) => isLiving(t.category) && !isHouse(t));
  const fixedRows = ex.filter((t) => fixed.includes(t.category));
  const groups = ['飲食', '家用', '教育', '服飾', '交通', '娛樂', '醫療', '金融', '固定支出', '生活用品', '其他'].map((name) => ({ name, amount: sum(ex.filter((t) => groupTx(t) === name)), rows: ex.filter((t) => groupTx(t) === name) })).filter((x) => x.amount > 0);
  const salaryTransfer = sum(inc.filter((t) => t.account === '薪轉' || t.category === '薪轉' || t.category === '薪水'));
  return { tx, ex, inc, invRows, income, expense, invest, balance: income - expense - invest, life: sum(lifeRows), fix: sum(fixedRows), lifeRows, fixedRows, groups, salaryTransfer };
}

function Card(p) { return <section onClick={p.onClick} style={{ background: 'linear-gradient(160deg,rgba(17,24,39,.96),rgba(15,23,42,.96))', border: '1px solid rgba(34,197,94,.36)', borderRadius: 22, padding: 16, marginBottom: 12, boxShadow: '0 18px 46px rgba(34,197,94,.13),0 12px 34px rgba(0,0,0,.28)', cursor: p.onClick ? 'pointer' : 'default', ...p.style }}>{p.children}</section>; }
const Title = ({ t, r }) => <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}><h2 style={{ margin: 0, fontSize: 18, fontWeight: 950 }}>{t}</h2>{r && <b style={{ color: '#86efac', fontSize: 12 }}>{r}</b>}</div>;
const input = () => ({ width: '100%', background: 'rgba(15,23,42,.88)', border: '1px solid rgba(34,197,94,.28)', color: '#f8fafc', borderRadius: 14, padding: 12, fontSize: 15, outline: 'none' });
function Btn(p) { return <button onClick={p.onClick} style={{ border: '1px solid rgba(212,175,55,.78)', borderRadius: 14, padding: '10px 8px', background: 'linear-gradient(180deg,rgba(250,204,21,.28),rgba(92,64,16,.75))', color: '#fff7bd', fontWeight: 1000, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.35)', ...p.style }}>{p.children}</button>; }
function Metric({ label, value, sub, good, bad, onClick }) { return <Card onClick={onClick} style={{ marginBottom: 0, padding: 14, borderColor: bad ? 'rgba(255,82,82,.55)' : good ? 'rgba(34,197,94,.6)' : undefined }}><div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 800 }}>{label}</div><div style={{ fontSize: 24, fontWeight: 1000, color: bad ? '#ff5252' : good ? '#86efac' : '#fff' }}>{value}</div>{sub && <div style={{ color: bad ? '#ff5252' : '#94a3b8', fontSize: 12, marginTop: 6 }}>{sub}</div>}</Card>; }
function TxList({ rows }) { return <div style={{ marginTop: 8, borderTop: '1px solid rgba(148,163,184,.12)' }}>{sortTx(rows).map((t) => <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, padding: '10px 0', borderBottom: '1px solid rgba(148,163,184,.12)' }}><div><b>{t.note}</b><div style={{ color: '#94a3b8', fontSize: 12, marginTop: 3 }}>{t.date}｜{t.category}｜{t.account}｜{t.type}</div></div><b style={{ color: t.type === '收入' ? '#86efac' : t.type === '投資扣款' ? '#facc15' : '#fca5a5' }}>{nt(t.amount)}</b></div>)}</div>; }

function Dashboard({ txs }) {
  const [r, setR] = useState({ start: monthStart(), end: today() });
  const s = stat(txs, r);
  const remain = 8000 - s.life;
  return <>
    <Card><Title t="日期篩選" r="Date Range" /><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><input type="date" value={r.start} onChange={(e) => setR({ ...r, start: e.target.value })} style={input()} /><input type="date" value={r.end} onChange={(e) => setR({ ...r, end: e.target.value })} style={input()} /></div></Card>
    <Card><Title t="可用結餘" r="Local DB" /><div style={{ fontSize: 42, fontWeight: 1000, color: s.balance >= 0 ? '#86efac' : '#ff5252' }}>{nt(s.balance)}</div><p style={{ color: '#94a3b8' }}>收入 {nt(s.income)} - 支出 {nt(s.expense)} - 投資 {nt(s.invest)}</p></Card>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}><Metric label="區間收入" value={nt(s.income)} good={s.income > 0} /><Metric label="薪轉收入" value={nt(s.salaryTransfer)} good={s.salaryTransfer > 0} /><Metric label="區間支出" value={nt(s.expense)} /><Metric label="投資扣款" value={nt(s.invest)} /><Metric label="生活費" value={nt(s.life)} sub={remain < 0 ? `超支 ${nt(Math.abs(remain))}` : `剩餘 ${nt(remain)}`} bad={remain < 0} /></div>
    <Card><Title t="區間大類支出" r={`${s.groups.length} 類`} />{s.groups.map((g) => <div key={g.name} style={{ display: 'grid', gridTemplateColumns: '70px 1fr auto', gap: 10, padding: '7px 0' }}><b>{g.name}</b><div style={{ height: 12, borderRadius: 99, background: '#243044', overflow: 'hidden', marginTop: 4 }}><div style={{ height: '100%', width: Math.min(100, Math.max(1, g.amount / Math.max(1, s.expense) * 100)) + '%', background: 'linear-gradient(90deg,#38bdf8,#22c55e)' }} /></div><b>{nt(g.amount)}</b></div>)}</Card>
    <Card><Title t="最近交易" r={`${s.tx.length} 筆`} /><TxList rows={s.tx.slice(0, 40)} /></Card>
  </>;
}

function Entry({ txs, setTxs }) {
  const [form, setForm] = useState({ amount: '', note: '', date: today(), type: '支出', account: '自用', category: '飲食' });
  function save() {
    const amount = Number(form.amount || 0);
    if (!amount) return;
    const category = form.type === '收入' ? (form.category === '飲食' ? autoCat(form.note) : form.category) : form.category === '飲食' ? autoCat(form.note) : form.category;
    const account = form.type === '收入' && /薪水|薪轉|薪資|salary/i.test(form.note || category) ? '薪轉' : form.account;
    setTxs([{ id: 'm' + Date.now(), ...form, account, amount, category, note: form.note || category }, ...txs]);
    setForm({ ...form, amount: '', note: '' });
  }
  return <>
    <Card><Title t="快速記帳" r="Local DB" /><div style={{ display: 'grid', gap: 10 }}><input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} style={{ ...input(), fontSize: 22, fontWeight: 900 }} placeholder="金額" inputMode="numeric" /><input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} style={input()} placeholder="備註：早餐 / 薪水 / 加油 / 家用 / 教育" /><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} style={input()} /><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, account: e.target.value === '收入' ? '薪轉' : form.account, category: e.target.value === '收入' ? '薪水' : form.category })} style={input()}>{['支出', '收入'].map((x) => <option key={x}>{x}</option>)}</select></div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><select value={form.account} onChange={(e) => setForm({ ...form, account: e.target.value })} style={input()}>{accountOptions.map((x) => <option key={x}>{x}</option>)}</select><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={input()}>{cats.map((x) => <option key={x}>{x}</option>)}</select></div><Btn onClick={save}>儲存這筆</Btn></div></Card>
    <Card><Title t="交易清單" r={`${txs.length} 筆`} /><TxList rows={txs} /></Card>
  </>;
}

function Budget({ txs, budgets, setBudgets }) {
  const [form, setForm] = useState({ name: '', category: '生活費', amount: '' });
  const s = stat(txs, { start: monthStart(), end: today() });
  function spent(b) { if (b.category === '生活費') return s.life; if (b.category === '固定支出') return s.fix; if (b.category === '富邦DCA') return s.invest; return s.ex.filter((t) => groupTx(t) === b.category || t.category === b.category).reduce((a, b) => a + Number(b.amount || 0), 0); }
  return <>
    <Card><Title t="新增預算" r="Local DB" /><div style={{ display: 'grid', gap: 10 }}><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={input()} placeholder="預算名稱" /><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={input()}>{cats.filter((x) => !['薪水', '薪轉', '退稅'].includes(x)).map((x) => <option key={x}>{x}</option>)}</select><input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} style={input()} placeholder="預算金額" inputMode="numeric" /><Btn onClick={() => { const amount = Number(form.amount || 0); if (amount) { setBudgets([{ id: 'b' + Date.now(), name: form.name || form.category, category: form.category, amount }, ...budgets]); setForm({ name: '', category: '生活費', amount: '' }); } }}>新增預算</Btn></div></Card>
    {budgets.map((b) => { const used = spent(b); const remain = Number(b.amount || 0) - used; return <Card key={b.id}><Title t={b.name} r="本月" /><Metric label={b.category} value={nt(used)} sub={`${remain < 0 ? '超支 ' + nt(Math.abs(remain)) : '剩餘 ' + nt(remain)}｜預算 ${nt(b.amount)}`} bad={remain < 0} /><button onClick={() => setBudgets(budgets.filter((x) => x.id !== b.id))} style={{ marginTop: 10, border: '1px solid rgba(248,113,113,.45)', borderRadius: 12, padding: 9, background: 'rgba(127,29,29,.25)', color: '#fca5a5', fontWeight: 900 }}>刪除</button></Card>; })}
  </>;
}

function AssetPage({ assets, setAssets }) {
  const emptyAsset = { name: '', type: '現金', amount: '', note: '' };
  const [form, setForm] = useState(emptyAsset);
  const [editingId, setEditingId] = useState('');
  const [editForm, setEditForm] = useState(emptyAsset);
  const [ledger, setLedger] = useState({ loading: true, error: '', marketValue: 0, lastSyncTime: '', source: '' });
  const manualTwd = useMemo(() => assets.reduce((sum, item) => sum + Number(item.amount || 0), 0), [assets]);
  const hunterUsd = Number(ledger.marketValue || 0);
  const hunterTwd = hunterUsd * RATE;
  const totalTwd = manualTwd + hunterTwd;

  async function loadWalletLedger() {
    setLedger((x) => ({ ...x, loading: true, error: '' }));
    try {
      const res = await fetch('/api/wallet-ledger?t=' + Date.now(), { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.message || json.error || 'wallet-ledger failed');
      const marketValue = Number(json.portfolioMarketValue ?? json.currentValue ?? json.marketValue ?? 0);
      setLedger({ loading: false, error: '', marketValue, lastSyncTime: json.lastSyncTime || json.updatedAt || json.checkedAt || '', source: json.priceSource || json.source || '' });
    } catch (error) {
      setLedger({ loading: false, error: error.message || '同步失敗', marketValue: 0, lastSyncTime: '', source: '' });
    }
  }

  useEffect(() => { loadWalletLedger(); }, []);

  function addAsset() {
    const amount = Number(form.amount || 0);
    if (!form.name.trim() || !Number.isFinite(amount)) return;
    setAssets([{ id: 'asset-' + Date.now(), name: form.name.trim(), type: form.type, amount, note: form.note.trim() || '手動輸入' }, ...assets]);
    setForm(emptyAsset);
  }

  function startEdit(asset) {
    setEditingId(asset.id);
    setEditForm({ name: asset.name, type: asset.type, amount: String(asset.amount ?? 0), note: asset.note || '' });
  }

  function cancelEdit() {
    setEditingId('');
    setEditForm(emptyAsset);
  }

  function saveEdit(id) {
    const amount = Number(editForm.amount);
    if (!editForm.name.trim() || !Number.isFinite(amount)) return;
    setAssets(assets.map((asset) => asset.id === id ? { ...asset, name: editForm.name.trim(), type: editForm.type, amount, note: editForm.note.trim() || '手動輸入' } : asset));
    cancelEdit();
  }

  function deleteAsset(id) {
    setAssets(assets.filter((asset) => asset.id !== id));
    if (editingId === id) cancelEdit();
  }

  const smallButton = { borderRadius: 10, padding: '7px 10px', fontWeight: 900, background: 'transparent' };

  return <>
    <Card><Title t="綜合總資產" r="TWD 估算" /><div style={{ fontSize: 42, fontWeight: 1000 }}>{nt(totalTwd)}</div><p style={{ color: '#94a3b8', lineHeight: 1.55 }}>手動資產 {nt(manualTwd)} + 獵人投資 {usd(hunterUsd)} × 匯率 {RATE}</p><div style={{ color: ledger.error ? '#fca5a5' : '#86efac', fontSize: 12, fontWeight: 900 }}>資料源：/api/wallet-ledger｜{ledger.loading ? '同步中' : ledger.error ? ledger.error : '已同步'}</div>{ledger.lastSyncTime && <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 5 }}>Last Sync：{ledger.lastSyncTime}</div>}</Card>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}><Metric label="手動資產" value={nt(manualTwd)} sub="銀行約當台幣" /><Metric label="獵人投資市值" value={usd(hunterUsd)} sub="鏡像真實持倉" good={!ledger.error && hunterUsd > 0} /></div>
    <Card><Title t="新增手動資產" r="Local DB" /><div style={{ display: 'grid', gap: 10 }}><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={input()} placeholder="資產名稱，例如：薪轉戶 / 富邦銀行 / 教育基金" /><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={input()}>{assetTypes.map((x) => <option key={x}>{x}</option>)}</select><input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} style={input()} placeholder="金額" inputMode="decimal" /><input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} style={input()} placeholder="備註，例如：薪轉 / 手動輸入 / 約當台幣" /><Btn onClick={addAsset}>新增資產</Btn><button onClick={loadWalletLedger} style={{ border: '1px solid rgba(34,197,94,.5)', borderRadius: 14, padding: 10, background: 'rgba(34,197,94,.12)', color: '#bbf7d0', fontWeight: 1000 }}>重新同步獵人投資</button></div></Card>
    <Card><Title t="手動資產清單" r={`${assets.length} 筆`} />{assets.map((a) => editingId === a.id ? <div key={a.id} style={{ display: 'grid', gap: 9, padding: '12px 0', borderBottom: '1px solid rgba(148,163,184,.12)' }}><input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} style={input()} placeholder="資產名稱" /><select value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })} style={input()}>{assetTypes.map((x) => <option key={x}>{x}</option>)}</select><input value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} style={{ ...input(), fontSize: 20, fontWeight: 900 }} placeholder="金額" inputMode="decimal" /><input value={editForm.note} onChange={(e) => setEditForm({ ...editForm, note: e.target.value })} style={input()} placeholder="備註" /><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}><button onClick={() => saveEdit(a.id)} style={{ ...smallButton, color: '#bbf7d0', border: '1px solid rgba(34,197,94,.5)', background: 'rgba(34,197,94,.12)' }}>儲存</button><button onClick={cancelEdit} style={{ ...smallButton, color: '#cbd5e1', border: '1px solid rgba(148,163,184,.35)' }}>取消</button><button onClick={() => deleteAsset(a.id)} style={{ ...smallButton, color: '#fca5a5', border: '1px solid rgba(248,113,113,.35)', background: 'rgba(127,29,29,.18)' }}>刪除</button></div></div> : <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(148,163,184,.12)' }}><div><b>{a.name}</b><div style={{ color: '#94a3b8', fontSize: 12 }}>{a.type}｜{a.note}</div></div><b style={{ color: '#86efac' }}>{nt(a.amount)}</b><button onClick={() => startEdit(a)} style={{ ...smallButton, color: '#fff7bd', border: '1px solid rgba(212,175,55,.55)', background: 'rgba(92,64,16,.4)' }}>編輯</button></div>)}</Card>
  </>;
}

export default function FinancialOS() {
  const [tab, setTab] = useState('dashboard');
  const [txs, setTxs] = useState([]);
  const [budgets, setBudgets] = useState(defaultBudgets);
  const [assets, setAssets] = useState(defaultAssets);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try { const raw = localStorage.getItem(TX_KEY) || localStorage.getItem(OLD_TX_KEY); setTxs(raw ? cleanDb(JSON.parse(raw)) : sample); } catch { setTxs(sample); }
    try { const raw = JSON.parse(localStorage.getItem(BUDGET_KEY) || 'null'); if (Array.isArray(raw)) setBudgets(raw); } catch {}
    try { const raw = JSON.parse(localStorage.getItem(ASSET_KEY) || 'null'); if (Array.isArray(raw)) setAssets(cleanAssets(raw)); } catch {}
    setReady(true);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem(TX_KEY, JSON.stringify(cleanDb(txs))); }, [txs, ready]);
  useEffect(() => { if (ready) localStorage.setItem(BUDGET_KEY, JSON.stringify(budgets)); }, [budgets, ready]);
  useEffect(() => { if (ready) localStorage.setItem(ASSET_KEY, JSON.stringify(cleanAssets(assets))); }, [assets, ready]);

  return <main style={{ minHeight: '100vh', color: '#f8fafc', background: 'radial-gradient(circle at 50% -10%,rgba(34,197,94,.16),transparent 28%),linear-gradient(180deg,#020617,#0f172a 55%,#111827)', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 430, margin: '0 auto', padding: '18px 14px 130px' }}>
      <section style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}><div><div style={{ fontSize: 22, fontWeight: 1000 }}>Josh 多元記帳本</div><div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 800, marginTop: 5 }}>多元記帳本 V4.7｜薪轉帳戶｜資產同步｜資產編輯</div></div><a href="/josh-os" style={{ color: '#bbf7d0', textDecoration: 'none', border: '1px solid rgba(34,197,94,.42)', borderRadius: 999, padding: '7px 10px', fontSize: 12, fontWeight: 950 }}>四合一</a></section>
      {tab === 'dashboard' && <Dashboard txs={txs} />}
      {tab === 'entry' && <Entry txs={txs} setTxs={setTxs} />}
      {tab === 'budget' && <Budget txs={txs} budgets={budgets} setBudgets={setBudgets} />}
      {tab === 'assets' && <AssetPage assets={assets} setAssets={setAssets} />}
    </div>
    <nav style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: 'rgba(2,6,23,.92)', backdropFilter: 'blur(16px)', borderTop: '1px solid rgba(34,197,94,.24)', padding: '8px 10px 10px' }}><div style={{ maxWidth: 430, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>{[['dashboard', '總覽'], ['entry', '記帳'], ['budget', '預算'], ['assets', '資產']].map(([key, label]) => <button key={key} onClick={() => setTab(key)} style={{ border: '1px solid rgba(212,175,55,.65)', borderRadius: 13, padding: '9px 4px', background: tab === key ? 'linear-gradient(180deg,rgba(250,204,21,.32),rgba(92,64,16,.78))' : 'rgba(92,64,16,.45)', color: '#fff7bd', fontSize: 11, fontWeight: 1000 }}>{label}</button>)}</div></nav>
  </main>;
}
