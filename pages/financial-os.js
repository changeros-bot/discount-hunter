import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "josh-financial-os-transactions-20260705-v6";
const BUDGET_STORAGE_KEY = "josh-financial-os-budgets-20260705-v1";
const ASSET_STORAGE_KEY = "josh-financial-os-assets-20260705-v1";
const MONTH = "2026-07";

const seedTransactions = [
  ["food-0705-breakfast", "2026-07-05", 80, "早餐", "早餐"],
  ["food-0704-dinner", "2026-07-04", 100, "晚餐", "晚餐"],
  ["food-0704-coffee", "2026-07-04", 30, "咖啡", "咖啡"],
  ["food-0704-breakfast", "2026-07-04", 45, "早餐", "早餐"],
  ["food-0704-cigarette", "2026-07-04", 85, "菸", "菸"],
  ["food-0703-ice", "2026-07-03", 65, "點心/宵夜", "挫冰"],
  ["food-0703-chicken", "2026-07-03", 80, "點心/宵夜", "雞排"],
  ["food-0703-coffee-cake", "2026-07-03", 100, "咖啡", "咖啡+太陽餅"],
  ["food-0703-cigarette", "2026-07-03", 85, "菸", "菸"],
  ["food-0703-latte", "2026-07-03", 45, "咖啡", "中冰拿"],
  ["food-0703-breakfast", "2026-07-03", 70, "早餐", "早餐"],
  ["food-0702-cigarette", "2026-07-02", 85, "菸", "菸"],
  ["food-0702-latte", "2026-07-02", 40, "咖啡", "中冰拿"],
  ["food-0701-cigarette-coffee", "2026-07-01", 115, "菸", "菸+黑咖啡"],
  ["food-0701-breakfast", "2026-07-01", 80, "早餐", "早餐"],
].map(([id, date, amount, category, note]) => ({ id, date, type: "支出", amount, account: "自用", category, note, isLivingExpense: "Y", isFixedExpense: "N", affectsBudget: "Y" }));

const seedBudgets = [{ id: "budget-living", name: "生活費", category: "生活費", amount: 8000 }];
const seedAssets = [
  { id: "asset-cash", name: "現金", type: "現金", amount: 0, note: "手動輸入" },
  { id: "asset-bank", name: "銀行", type: "銀行", amount: 0, note: "手動輸入" },
];

const MAIN_CATEGORIES = ["飲食", "服飾", "居住", "交通", "教育", "娛樂", "醫療", "金融"];
const FOOD_CATEGORIES = ["早餐", "午餐", "晚餐", "飲料", "咖啡", "菸", "點心/宵夜"];
const FIXED_CATEGORIES = ["手機月租費", "手機月攤", "ChatGPT", "Google One", "保險", "房租", "水電瓦斯", "網路費"];
const OTHER_CATEGORIES = ["機車", "生活用品", "醫療健康", "家庭", "投資", "其他"];
const ALL_CATEGORIES = [...MAIN_CATEGORIES, "生活費", "固定支出", "生活用品", "────────", ...FOOD_CATEGORIES, ...FIXED_CATEGORIES, ...OTHER_CATEGORIES];
const ACCOUNTS = ["家用", "自用", "投資"];
const TYPES = ["收入", "支出", "一般轉帳", "借款", "還款"];
const ASSET_TYPES = ["現金", "銀行", "ETF", "加密貨幣", "xStocks", "其他資產", "負債"];

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = (date = today()) => `${date.slice(0, 7)}-01`;
const addDays = (date, days) => { const d = new Date(`${date}T00:00:00`); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
const lastMonthRange = () => { const d = new Date(`${today()}T00:00:00`); d.setDate(1); d.setMonth(d.getMonth() - 1); const start = d.toISOString().slice(0, 10); d.setMonth(d.getMonth() + 1); d.setDate(0); return { start, end: d.toISOString().slice(0, 10) }; };
const defaultRange = () => ({ start: monthStart(), end: today() });
const rangeLabel = (range) => `${range.start.replaceAll("-", "/")} - ${range.end.replaceAll("-", "/")}`;
const num = (v) => { const n = Number(v || 0); return Number.isFinite(n) ? n : 0; };
const nt = (n) => `$${num(n).toLocaleString("zh-TW", { maximumFractionDigits: 0 })}`;
const usd = (n) => `$${num(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n) => Number.isFinite(Number(n)) ? `${(Number(n) * 100).toFixed(2)}%` : "—";
const sum = (rows) => rows.reduce((s, t) => s + num(t.amount), 0);
const isMonth = (t) => String(t.date || "").slice(0, 7) === MONTH;
const inRange = (t, range) => { const d = String(t.date || ""); return d >= range.start && d <= range.end; };
const isFixed = (c) => FIXED_CATEGORIES.includes(c) || c === "固定支出";
const valueOfHolding = (h) => num(h.currentValue ?? h.marketValue ?? h.positionValue ?? h.rawCurrentValue);
const costOfHolding = (h) => num(h.totalCost ?? h.portfolioTotalCost);

function groupOf(category) {
  if (category === "生活費") return "生活費";
  if (category === "飲食" || FOOD_CATEGORIES.includes(category)) return "飲食";
  if (category === "居住" || ["房租", "水電瓦斯", "網路費"].includes(category)) return "居住";
  if (category === "交通" || category === "機車") return "交通";
  if (category === "醫療" || category === "醫療健康") return "醫療";
  if (category === "金融" || ["保險", "投資"].includes(category)) return "金融";
  if (isFixed(category)) return "固定支出";
  if (MAIN_CATEGORIES.includes(category)) return category;
  if (category === "生活用品") return "生活用品";
  return "其他";
}

function stats(transactions, range = { start: `${MONTH}-01`, end: today() }) {
  const rangeTx = transactions.filter((t) => range ? inRange(t, range) : isMonth(t));
  const expenses = rangeTx.filter((t) => t.type === "支出");
  const income = sum(rangeTx.filter((t) => t.type === "收入"));
  const expense = sum(expenses);
  const living = sum(expenses.filter((t) => t.isLivingExpense === "Y"));
  const fixed = sum(expenses.filter((t) => t.isFixedExpense === "Y" || isFixed(t.category)));
  const groups = ["飲食", "服飾", "居住", "交通", "教育", "娛樂", "醫療", "金融", "固定支出", "生活用品", "其他"].map((name) => ({ name, amount: sum(expenses.filter((t) => groupOf(t.category) === name)) })).filter((x) => x.amount > 0);
  const foods = FOOD_CATEGORIES.map((name) => ({ name, amount: sum(expenses.filter((t) => t.category === name || (name === "早餐" && t.category === "飲食"))) }));
  return { rangeTx, monthTx: rangeTx, expenses, income, expense, living, fixed, groups, foods };
}
function spentForBudget(budget, s) {
  if (budget.category === "生活費") return s.living;
  if (budget.category === "固定支出") return s.fixed;
  return sum(s.expenses.filter((t) => groupOf(t.category) === budget.category || t.category === budget.category));
}

function Card({ children, style }) { return <section style={{ background: "rgba(17,24,39,.92)", border: "1px solid rgba(148,163,184,.18)", borderRadius: 22, padding: 16, marginBottom: 12, boxShadow: "0 12px 34px rgba(0,0,0,.26)", ...style }}>{children}</section>; }
function Title({ title, right }) { return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12 }}><h2 style={{ margin: 0, fontSize: 18, fontWeight: 950 }}>{title}</h2>{right ? <span style={{ color: "#94a3b8", fontSize: 12, fontWeight: 800 }}>{right}</span> : null}</div>; }
function Metric({ label, value, sub }) { return <Card style={{ marginBottom: 0, padding: 14 }}><div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 800, marginBottom: 8 }}>{label}</div><div style={{ fontSize: 24, fontWeight: 1000 }}>{value}</div>{sub ? <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 6 }}>{sub}</div> : null}</Card>; }
function Row({ title, sub, value, action, tone = "bad" }) { const color = tone === "good" ? "#86efac" : tone === "bad" ? "#fca5a5" : "#f8fafc"; return <div style={{ display: "grid", gridTemplateColumns: action ? "1fr auto auto" : "1fr auto", gap: 10, alignItems: "center", padding: "11px 0", borderBottom: "1px solid rgba(148,163,184,.12)" }}><div><div style={{ fontSize: 14, fontWeight: 950 }}>{title}</div>{sub ? <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>{sub}</div> : null}</div><div style={{ color, fontWeight: 1000, whiteSpace: "nowrap" }}>{value}</div>{action}</div>; }
function Bar({ amount, max, danger }) { const width = max > 0 ? Math.min(100, Math.max(3, Math.round((amount / max) * 100))) : 0; return <div style={{ height: 12, borderRadius: 999, background: "#243044", overflow: "hidden" }}><div style={{ height: "100%", width: `${width}%`, borderRadius: 999, background: danger ? "linear-gradient(90deg,#f59e0b,#ef4444)" : "linear-gradient(90deg,#38bdf8,#22c55e)" }} /></div>; }
function SmallButton({ children, onClick, tone = "blue" }) { const bad = tone === "bad"; return <button onClick={onClick} style={{ border: `1px solid ${bad ? "rgba(239,68,68,.35)" : "rgba(56,189,248,.35)"}`, borderRadius: 12, padding: "8px 10px", background: bad ? "rgba(239,68,68,.12)" : "rgba(56,189,248,.12)", color: bad ? "#fca5a5" : "#bae6fd", fontWeight: 950, fontSize: 12 }}>{children}</button>; }
function inputStyle() { return { width: "100%", background: "rgba(15,23,42,.88)", border: "1px solid rgba(148,163,184,.24)", color: "#f8fafc", borderRadius: 14, padding: 12, fontSize: 15, outline: "none" }; }

function DateRangeFilter({ range, setRange }) {
  const presets = [
    ["本月", () => defaultRange()],
    ["上月", () => lastMonthRange()],
    ["近7天", () => ({ start: addDays(today(), -6), end: today() })],
    ["近30天", () => ({ start: addDays(today(), -29), end: today() })],
  ];
  return <Card>
    <Title title="日期篩選" right="Date Range" />
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
      <input type="date" value={range.start} onChange={(e) => setRange((r) => ({ ...r, start: e.target.value || r.start }))} style={inputStyle()} />
      <input type="date" value={range.end} onChange={(e) => setRange((r) => ({ ...r, end: e.target.value || r.end }))} style={inputStyle()} />
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
      {presets.map(([label, getRange]) => <button key={label} onClick={() => setRange(getRange())} style={{ border: "1px solid rgba(56,189,248,.28)", borderRadius: 12, padding: "9px 4px", background: "rgba(56,189,248,.10)", color: "#bae6fd", fontSize: 12, fontWeight: 950 }}>{label}</button>)}
    </div>
    <div style={{ marginTop: 12, color: "#cbd5e1", fontSize: 12, fontWeight: 850 }}>統計區間：{rangeLabel(range)}</div>
  </Card>;
}

function VerticalBarChart({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.amount));
  return <div style={{ display: "flex", alignItems: "end", gap: 10, minHeight: 210, padding: "12px 2px 0", borderTop: "1px solid rgba(148,163,184,.12)" }}>
    {rows.length ? rows.map((r) => {
      const height = Math.max(8, Math.round((r.amount / max) * 150));
      return <div key={r.name} style={{ flex: 1, minWidth: 0, display: "grid", alignContent: "end", gap: 7, textAlign: "center" }}>
        <div style={{ color: "#e2e8f0", fontSize: 11, fontWeight: 950 }}>{nt(r.amount)}</div>
        <div style={{ height, borderRadius: "12px 12px 5px 5px", background: "linear-gradient(180deg,#38bdf8,#22c55e)", boxShadow: "0 10px 24px rgba(34,197,94,.18)" }} />
        <div style={{ color: "#cbd5e1", fontSize: 11, fontWeight: 900, writingMode: r.name.length > 2 ? "vertical-rl" : "horizontal-tb", margin: "0 auto", minHeight: 30 }}>{r.name}</div>
      </div>;
    }) : <div style={{ color: "#94a3b8", fontSize: 13, fontWeight: 850 }}>這個區間沒有支出資料。</div>}
  </div>;
}

function HorizontalBarChart({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.amount));
  return <div style={{ display: "grid", gap: 12 }}>
    {rows.map((r) => <div key={r.name} style={{ display: "grid", gridTemplateColumns: "72px 1fr 64px", alignItems: "center", gap: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 900 }}>{r.name}</div>
      <Bar amount={r.amount} max={max} danger={r.name === "菸"} />
      <div style={{ textAlign: "right", fontWeight: 950 }}>{nt(r.amount)}</div>
    </div>)}
  </div>;
}

function Dashboard({ transactions, budgets }) {
  const [range, setRange] = useState(defaultRange);
  const safeRange = range.start > range.end ? { start: range.end, end: range.start } : range;
  const s = stats(transactions, safeRange);
  const livingBudget = budgets.find((b) => b.category === "生活費")?.amount || 8000;
  const rows = [...s.expenses].sort((a, b) => b.date.localeCompare(a.date));
  const activeFoods = s.foods.filter((r) => r.amount > 0);
  return <>
    <DateRangeFilter range={safeRange} setRange={setRange} />
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
      <Metric label="區間收入" value={nt(s.income)} sub="薪水 / 兼職 / 其他" />
      <Metric label="區間支出" value={nt(s.expense)} sub={`${s.rangeTx.length} 筆交易納入統計`} />
      <Metric label="區間生活費" value={nt(s.living)} sub={`剩餘 ${nt(livingBudget - s.living)}`} />
      <Metric label="區間固定支出" value={nt(s.fixed)} sub="手機 / 訂閱 / 保險" />
    </div>
    <Card><Title title="區間大類支出｜長條圖" right={rangeLabel(safeRange)} /><VerticalBarChart rows={s.groups} /></Card>
    <Card><Title title="區間細項支出｜長條圖" right={`合計 ${nt(sum(activeFoods))}`} /><HorizontalBarChart rows={activeFoods.length ? activeFoods : s.foods} /></Card>
    <Card style={{ padding: 0, overflow: "hidden" }}><details><summary style={{ listStyle: "none", cursor: "pointer", padding: 16 }}><Title title="區間交易紀錄" right={`${rows.length} 筆｜點開查看`} /><div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 850 }}>目前區間：{rangeLabel(safeRange)}。最近一筆：{rows[0]?.note || "—"} {nt(rows[0]?.amount || 0)}</div></summary><div style={{ padding: "0 16px 10px" }}>{rows.map((t) => <Row key={t.id} title={t.note || t.category} sub={`${t.date}｜${t.category}｜${t.account}`} value={nt(t.amount)} />)}</div></details></Card>
  </>;
}

function Entry({ transactions, setTransactions, onDelete }) {
  const [form, setForm] = useState({ date: today(), type: "支出", amount: "", account: "自用", category: "飲食", note: "" });
  function save() { const amount = num(form.amount); if (!amount) return; const fixed = isFixed(form.category); const note = form.note.trim() || form.category; setTransactions([{ id: `manual-${Date.now()}`, ...form, amount, note, isLivingExpense: "Y", isFixedExpense: fixed ? "Y" : "N", affectsBudget: "Y" }, ...transactions]); setForm({ ...form, amount: "", note: "" }); }
  return <>
    <Card><Title title="新增交易" right="手動" /><div style={{ display: "grid", gap: 10 }}>
      <input value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} style={inputStyle()} type="date" />
      <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={inputStyle()}>{TYPES.map((x) => <option key={x}>{x}</option>)}</select>
      <input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} style={inputStyle()} placeholder="金額" inputMode="numeric" />
      <select value={form.account} onChange={(e) => setForm({ ...form, account: e.target.value })} style={inputStyle()}>{ACCOUNTS.map((x) => <option key={x}>{x}</option>)}</select>
      <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={inputStyle()}>{ALL_CATEGORIES.map((x) => x === "────────" ? <option key={x} disabled>{x}</option> : <option key={x}>{x}</option>)}</select>
      <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} style={inputStyle()} placeholder="備註；空白時自動用分類名稱" />
      {isFixed(form.category) ? <div style={{ color: "#fde68a", fontSize: 12, fontWeight: 850 }}>此類別會自動列入固定支出。</div> : null}
      <button onClick={save} style={{ border: "none", borderRadius: 16, padding: 14, background: "linear-gradient(90deg,#38bdf8,#22c55e)", color: "#020617", fontWeight: 1000 }}>儲存這筆</button>
    </div></Card>
    <Card><Title title="交易清單" right={`${transactions.length} 筆`} />{transactions.map((t) => <Row key={t.id} title={t.note || t.category} sub={`${t.date}｜${t.category}｜${t.account}${isFixed(t.category) ? "｜固定" : ""}`} value={nt(t.amount)} action={<SmallButton tone="bad" onClick={() => onDelete(t.id)}>移除</SmallButton>} />)}</Card>
  </>;
}

function Budget({ transactions, budgets, setBudgets }) {
  const s = stats(transactions);
  const [form, setForm] = useState({ name: "", category: "飲食", amount: "" });
  function saveBudget() { const amount = num(form.amount); if (!amount) return; const name = form.name.trim() || form.category; setBudgets((prev) => [{ id: `budget-${Date.now()}`, name, category: form.category, amount }, ...prev]); setForm({ name: "", category: "飲食", amount: "" }); }
  return <>
    <Card><Title title="新增預算" right={MONTH} /><div style={{ display: "grid", gap: 10 }}><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle()} placeholder="預算名稱；例如 手機費 / 飲食 / 交通" /><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={inputStyle()}>{ALL_CATEGORIES.filter((x) => x !== "────────").map((x) => <option key={x}>{x}</option>)}</select><input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} style={inputStyle()} placeholder="預算金額" inputMode="numeric" /><button onClick={saveBudget} style={{ border: "none", borderRadius: 16, padding: 14, background: "linear-gradient(90deg,#38bdf8,#22c55e)", color: "#020617", fontWeight: 1000 }}>新增這個預算</button></div></Card>
    <Card><Title title="預算控管" right={`${budgets.length} 組`} />{budgets.map((b) => { const spent = spentForBudget(b, s); const rate = b.amount ? Math.round((spent / b.amount) * 100) : 0; return <div key={b.id} style={{ marginBottom: 16 }}><Row title={b.name} sub={`${b.category}｜已用 ${nt(spent)} / 預算 ${nt(b.amount)}`} value={`${rate}%`} tone={rate > 100 ? "bad" : "good"} action={<SmallButton tone="bad" onClick={() => setBudgets((p) => p.filter((x) => x.id !== b.id))}>刪除</SmallButton>} /><Bar amount={spent} max={b.amount || 1} danger={rate > 100} /><input value={b.amount} onChange={(e) => setBudgets((p) => p.map((x) => x.id === b.id ? { ...x, amount: num(e.target.value) } : x))} style={{ ...inputStyle(), marginTop: 8 }} inputMode="numeric" /></div>; })}</Card>
  </>;
}

function InvestmentMirror() {
  const [state, setState] = useState({ loading: false, error: "", holdings: [], total: 0, cost: 0, pnl: 0, returnPct: null, updatedAt: "" });
  async function refresh() {
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const [wallet, btc] = await Promise.all([
        fetch(`/api/sync-wallet?t=${Date.now()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).then((r) => r.json()).catch(() => null),
        fetch(`/api/binance-exchange-position?t=${Date.now()}`).then((r) => r.json()).catch(() => null),
      ]);
      const holdings = [...(Array.isArray(wallet?.holdings) ? wallet.holdings : []), ...(Array.isArray(btc?.holdings) ? btc.holdings : [])].filter((h) => valueOfHolding(h) > 0);
      const total = holdings.reduce((s, h) => s + valueOfHolding(h), 0);
      const cost = holdings.reduce((s, h) => s + costOfHolding(h), 0);
      const pnl = cost > 0 ? total - cost : 0;
      setState({ loading: false, error: "", holdings, total, cost, pnl, returnPct: cost > 0 ? pnl / cost : null, updatedAt: wallet?.lastSyncTime || btc?.checkedAt || new Date().toISOString() });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e.message || "V17 投資資產讀取失敗" }));
    }
  }
  useEffect(() => { refresh(); }, []);
  return <Card><Title title="折價獵人投資資產" right={state.loading ? "讀取中" : "V17 read-only"} />
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}><Metric label="投資市值" value={usd(state.total)} sub="BTC + xStocks" /><Metric label="已知成本損益" value={state.cost > 0 ? usd(state.pnl) : "—"} sub={state.cost > 0 ? pct(state.returnPct) : "成本未完整"} /></div>
    {state.error ? <div style={{ color: "#fca5a5", fontSize: 13 }}>{state.error}</div> : null}
    <div style={{ color: "#94a3b8", fontSize: 12, lineHeight: 1.6, marginBottom: 8 }}>這裡只鏡像顯示 V17 結果，不重算成本與 PnL。</div>
    {state.holdings.map((h) => <Row key={h.symbol} title={h.symbol} sub={`數量 ${num(h.quantity).toLocaleString("en-US", { maximumFractionDigits: 6 })}｜成本 ${costOfHolding(h) > 0 ? usd(costOfHolding(h)) : "—"}`} value={usd(valueOfHolding(h))} tone={num(h.unrealizedPnL) >= 0 ? "good" : "bad"} />)}
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}><SmallButton onClick={refresh}>{state.loading ? "同步中" : "刷新投資資產"}</SmallButton><a href="/v17" style={{ textAlign: "center", textDecoration: "none", borderRadius: 12, padding: "8px 10px", background: "rgba(56,189,248,.12)", border: "1px solid rgba(56,189,248,.35)", color: "#bae6fd", fontWeight: 950, fontSize: 12 }}>打開 V17</a></div>
  </Card>;
}

function Assets({ assets, setAssets, transactions, setTransactions }) {
  const [form, setForm] = useState({ name: "", type: "現金", amount: "", note: "" });
  const total = sum(assets.filter((a) => a.type !== "負債")) - sum(assets.filter((a) => a.type === "負債"));
  function addAsset() { const amount = num(form.amount); if (!form.name.trim() && !amount) return; setAssets((prev) => [{ id: `asset-${Date.now()}`, name: form.name.trim() || form.type, type: form.type, amount, note: form.note.trim() || "手動輸入" }, ...prev]); setForm({ name: "", type: "現金", amount: "", note: "" }); }
  function resetSeed() { setTransactions(seedTransactions); }
  function exportJson() { const blob = new Blob([JSON.stringify({ version: "financial-os-v2", exportedAt: new Date().toISOString(), transactions, assets }, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `josh-financial-os-${today()}.json`; a.click(); URL.revokeObjectURL(url); }
  return <>
    <InvestmentMirror />
    <Card><Title title="手動資產總覽" right="現金 / 銀行" /><Metric label="手動資產淨值" value={nt(total)} sub="現金 / 銀行 / 其他資產；投資資產看上方 V17 鏡像" /></Card>
    <Card><Title title="新增手動資產" right="LocalStorage" /><div style={{ display: "grid", gap: 10 }}><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle()} placeholder="資產名稱；例如 合庫帳戶 / 現金 / 機車" /><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={inputStyle()}>{ASSET_TYPES.map((x) => <option key={x}>{x}</option>)}</select><input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} style={inputStyle()} placeholder="金額" inputMode="numeric" /><input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} style={inputStyle()} placeholder="備註" /><button onClick={addAsset} style={{ border: "none", borderRadius: 16, padding: 14, background: "linear-gradient(90deg,#38bdf8,#22c55e)", color: "#020617", fontWeight: 1000 }}>新增資產</button></div></Card>
    <Card><Title title="資產清單" right={`${assets.length} 筆`} />{assets.map((a) => <Row key={a.id} title={a.name} sub={`${a.type}｜${a.note || "手動輸入"}`} value={nt(a.amount)} tone={a.type === "負債" ? "bad" : "good"} action={<SmallButton tone="bad" onClick={() => setAssets((p) => p.filter((x) => x.id !== a.id))}>移除</SmallButton>} />)}</Card>
    <Card><Title title="備份 / 還原" right="LocalStorage" /><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><SmallButton onClick={exportJson}>匯出 JSON</SmallButton><SmallButton tone="bad" onClick={resetSeed}>重置七月支出</SmallButton></div></Card>
  </>;
}

export default function FinancialOSPage() {
  const [tab, setTab] = useState("dashboard");
  const [transactions, setTransactions] = useState(seedTransactions);
  const [budgets, setBudgets] = useState(seedBudgets);
  const [assets, setAssets] = useState(seedAssets);
  useEffect(() => { try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); if (Array.isArray(saved)) setTransactions(saved); } catch {} try { const savedBudgets = JSON.parse(localStorage.getItem(BUDGET_STORAGE_KEY) || "null"); if (Array.isArray(savedBudgets)) setBudgets(savedBudgets); } catch {} try { const savedAssets = JSON.parse(localStorage.getItem(ASSET_STORAGE_KEY) || "null"); if (Array.isArray(savedAssets)) setAssets(savedAssets); } catch {} }, []);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions)); } catch {} }, [transactions]);
  useEffect(() => { try { localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify(budgets)); } catch {} }, [budgets]);
  useEffect(() => { try { localStorage.setItem(ASSET_STORAGE_KEY, JSON.stringify(assets)); } catch {} }, [assets]);
  const tabs = useMemo(() => [["dashboard", "總覽"], ["entry", "記帳"], ["budget", "預算"], ["assets", "資產"]], []);
  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "linear-gradient(180deg,#020617 0%,#0f172a 55%,#111827 100%)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}><div style={{ maxWidth: 430, margin: "0 auto", padding: "18px 14px 94px" }}><section style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14 }}><div><div style={{ fontSize: 22, fontWeight: 1000 }}>Josh Financial OS</div><div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 800, marginTop: 5 }}>多元記帳本 V2.2｜日期區間統計｜V17 投資鏡像</div></div><a href="/josh-os" style={{ color: "#bae6fd", textDecoration: "none", border: "1px solid rgba(56,189,248,.35)", borderRadius: 999, padding: "7px 10px", fontSize: 12, fontWeight: 950 }}>四合一</a></section>{tab === "dashboard" && <Dashboard transactions={transactions} budgets={budgets} />}{tab === "entry" && <Entry transactions={transactions} setTransactions={setTransactions} onDelete={(id) => setTransactions((p) => p.filter((t) => t.id !== id))} />}{tab === "budget" && <Budget transactions={transactions} budgets={budgets} setBudgets={setBudgets} />}{tab === "assets" && <Assets assets={assets} setAssets={setAssets} transactions={transactions} setTransactions={setTransactions} />}</div><nav style={{ position: "fixed", left: 0, right: 0, bottom: 0, background: "rgba(2,6,23,.92)", backdropFilter: "blur(16px)", borderTop: "1px solid rgba(148,163,184,.18)", padding: "8px 10px 10px" }}><div style={{ maxWidth: 430, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>{tabs.map(([key, label]) => <button key={key} onClick={() => setTab(key)} style={{ border: "none", borderRadius: 12, padding: "9px 4px", background: tab === key ? "rgba(56,189,248,.13)" : "transparent", color: tab === key ? "#f8fafc" : "#94a3b8", fontSize: 11, fontWeight: 900 }}>{label}</button>)}</div></nav></main>;
}
