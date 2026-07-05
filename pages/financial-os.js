import { useEffect, useState } from "react";

const STORAGE_KEY = "josh-financial-os-transactions-20260705-v6";
const MONTH = "2026-07";
const LIVING_BUDGET = 8000;

const seedTransactions = [
  { id: "food-0705-breakfast", date: "2026-07-05", type: "支出", amount: 80, account: "自用", category: "早餐", isLivingExpense: "Y", isFixedExpense: "N", affectsBudget: "Y", note: "早餐" },
  { id: "food-0704-dinner", date: "2026-07-04", type: "支出", amount: 100, account: "自用", category: "晚餐", isLivingExpense: "Y", isFixedExpense: "N", affectsBudget: "Y", note: "晚餐" },
  { id: "food-0704-coffee", date: "2026-07-04", type: "支出", amount: 30, account: "自用", category: "咖啡", isLivingExpense: "Y", isFixedExpense: "N", affectsBudget: "Y", note: "咖啡" },
  { id: "food-0704-breakfast", date: "2026-07-04", type: "支出", amount: 45, account: "自用", category: "早餐", isLivingExpense: "Y", isFixedExpense: "N", affectsBudget: "Y", note: "早餐" },
  { id: "food-0704-cigarette", date: "2026-07-04", type: "支出", amount: 85, account: "自用", category: "菸", isLivingExpense: "Y", isFixedExpense: "N", affectsBudget: "Y", note: "菸" },
  { id: "food-0703-ice", date: "2026-07-03", type: "支出", amount: 65, account: "自用", category: "點心/宵夜", isLivingExpense: "Y", isFixedExpense: "N", affectsBudget: "Y", note: "挫冰" },
  { id: "food-0703-chicken", date: "2026-07-03", type: "支出", amount: 80, account: "自用", category: "點心/宵夜", isLivingExpense: "Y", isFixedExpense: "N", affectsBudget: "Y", note: "雞排" },
  { id: "food-0703-coffee-cake", date: "2026-07-03", type: "支出", amount: 100, account: "自用", category: "咖啡", isLivingExpense: "Y", isFixedExpense: "N", affectsBudget: "Y", note: "咖啡+太陽餅" },
  { id: "food-0703-cigarette", date: "2026-07-03", type: "支出", amount: 85, account: "自用", category: "菸", isLivingExpense: "Y", isFixedExpense: "N", affectsBudget: "Y", note: "菸" },
  { id: "food-0703-latte", date: "2026-07-03", type: "支出", amount: 45, account: "自用", category: "咖啡", isLivingExpense: "Y", isFixedExpense: "N", affectsBudget: "Y", note: "中冰拿" },
  { id: "food-0703-breakfast", date: "2026-07-03", type: "支出", amount: 70, account: "自用", category: "早餐", isLivingExpense: "Y", isFixedExpense: "N", affectsBudget: "Y", note: "早餐" },
  { id: "food-0702-cigarette", date: "2026-07-02", type: "支出", amount: 85, account: "自用", category: "菸", isLivingExpense: "Y", isFixedExpense: "N", affectsBudget: "Y", note: "菸" },
  { id: "food-0702-latte", date: "2026-07-02", type: "支出", amount: 40, account: "自用", category: "咖啡", isLivingExpense: "Y", isFixedExpense: "N", affectsBudget: "Y", note: "中冰拿" },
  { id: "food-0701-cigarette-coffee", date: "2026-07-01", type: "支出", amount: 115, account: "自用", category: "菸", isLivingExpense: "Y", isFixedExpense: "N", affectsBudget: "Y", note: "菸+黑咖啡" },
  { id: "food-0701-breakfast", date: "2026-07-01", type: "支出", amount: 80, account: "自用", category: "早餐", isLivingExpense: "Y", isFixedExpense: "N", affectsBudget: "Y", note: "早餐" },
];

const MAIN_CATEGORIES = ["飲食", "服飾", "居住", "交通", "教育", "娛樂", "醫療", "金融"];
const FOOD_CATEGORIES = ["早餐", "午餐", "晚餐", "飲料", "咖啡", "菸", "點心/宵夜"];
const FIXED_CATEGORIES = ["手機月租費", "手機月攤", "ChatGPT", "Google One", "保險", "房租", "水電瓦斯", "網路費"];
const OTHER_CATEGORIES = ["機車", "生活用品", "醫療健康", "家庭", "投資", "其他"];
const ALL_CATEGORIES = [...MAIN_CATEGORIES, "────────", ...FOOD_CATEGORIES, ...FIXED_CATEGORIES, ...OTHER_CATEGORIES];
const ACCOUNTS = ["家用", "自用", "投資"];
const TYPES = ["收入", "支出", "一般轉帳", "借款", "還款"];

function money(n) {
  return `$${Number(n || 0).toLocaleString("zh-TW", { maximumFractionDigits: 0 })}`;
}
function isMonth(tx) {
  return String(tx.date || "").slice(0, 7) === MONTH;
}
function sum(rows) {
  return rows.reduce((s, t) => s + Number(t.amount || 0), 0);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
function isFixedCategory(category) {
  return FIXED_CATEGORIES.includes(category);
}
function groupOf(category) {
  if (category === "飲食" || FOOD_CATEGORIES.includes(category)) return "飲食";
  if (category === "服飾") return "服飾";
  if (category === "居住" || ["房租", "水電瓦斯", "網路費"].includes(category)) return "居住";
  if (category === "交通" || ["機車"].includes(category)) return "交通";
  if (category === "教育") return "教育";
  if (category === "娛樂") return "娛樂";
  if (category === "醫療" || category === "醫療健康") return "醫療";
  if (category === "金融" || ["保險", "投資"].includes(category)) return "金融";
  if (["手機月租費", "手機月攤", "ChatGPT", "Google One"].includes(category)) return "固定支出";
  if (category === "生活用品") return "生活用品";
  return "其他";
}
function calcStats(transactions) {
  const monthTx = transactions.filter(isMonth);
  const income = sum(monthTx.filter((t) => t.type === "收入"));
  const expenseRows = monthTx.filter((t) => t.type === "支出");
  const expense = sum(expenseRows);
  const living = sum(expenseRows.filter((t) => t.isLivingExpense === "Y"));
  const fixed = sum(expenseRows.filter((t) => t.isFixedExpense === "Y" || isFixedCategory(t.category)));
  const foodRows = FOOD_CATEGORIES.map((name) => ({ name, amount: sum(expenseRows.filter((t) => t.category === name || (name === "早餐" && t.category === "飲食"))) }));
  const groupNames = ["飲食", "服飾", "居住", "交通", "教育", "娛樂", "醫療", "金融", "固定支出", "生活用品", "其他"];
  const groupRows = groupNames.map((name) => ({ name, amount: sum(expenseRows.filter((t) => groupOf(t.category) === name)) })).filter((r) => r.amount > 0);
  const accounts = Object.fromEntries(ACCOUNTS.map((a) => [a, 0]));
  for (const t of monthTx) {
    const amt = Number(t.amount || 0);
    if (t.type === "收入") accounts[t.account] = (accounts[t.account] || 0) + amt;
    if (t.type === "支出") accounts[t.account] = (accounts[t.account] || 0) - amt;
  }
  return { monthTx, expenseRows, income, expense, living, fixed, cashflow: income - expense, foodRows, groupRows, accounts };
}

function Card({ children, style }) {
  return <section style={{ background: "rgba(17,24,39,.92)", border: "1px solid rgba(148,163,184,.18)", borderRadius: 22, padding: 16, marginBottom: 12, boxShadow: "0 12px 34px rgba(0,0,0,.26)", ...style }}>{children}</section>;
}
function Title({ title, right }) {
  return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12 }}><h2 style={{ margin: 0, fontSize: 18, fontWeight: 950 }}>{title}</h2>{right ? <span style={{ color: "#94a3b8", fontSize: 12, fontWeight: 800 }}>{right}</span> : null}</div>;
}
function Metric({ label, value, sub }) {
  return <Card style={{ marginBottom: 0, padding: 14 }}><div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 800, marginBottom: 8 }}>{label}</div><div style={{ fontSize: 24, fontWeight: 1000 }}>{value}</div>{sub ? <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 6, lineHeight: 1.35 }}>{sub}</div> : null}</Card>;
}
function Row({ title, sub, value, tone, action }) {
  const color = tone === "good" ? "#86efac" : tone === "bad" ? "#fca5a5" : "#f8fafc";
  return <div style={{ display: "grid", gridTemplateColumns: action ? "1fr auto auto" : "1fr auto", gap: 10, alignItems: "center", padding: "11px 0", borderBottom: "1px solid rgba(148,163,184,.12)" }}><div><div style={{ fontSize: 14, fontWeight: 950 }}>{title}</div>{sub ? <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4, lineHeight: 1.35 }}>{sub}</div> : null}</div><div style={{ color, fontSize: 14, fontWeight: 1000, whiteSpace: "nowrap" }}>{value}</div>{action || null}</div>;
}
function Bar({ amount, max, danger }) {
  const pct = max > 0 ? Math.max(3, Math.round((amount / max) * 100)) : 0;
  return <div style={{ height: 12, borderRadius: 999, background: "#243044", overflow: "hidden" }}><div style={{ height: "100%", width: `${pct}%`, borderRadius: 999, background: danger ? "linear-gradient(90deg,#f59e0b,#ef4444)" : "linear-gradient(90deg,#38bdf8,#22c55e)" }} /></div>;
}
function SmallButton({ children, onClick, tone = "blue" }) {
  const color = tone === "bad" ? "#fca5a5" : tone === "good" ? "#bbf7d0" : "#bae6fd";
  const border = tone === "bad" ? "rgba(239,68,68,.35)" : tone === "good" ? "rgba(34,197,94,.36)" : "rgba(56,189,248,.35)";
  const background = tone === "bad" ? "rgba(239,68,68,.12)" : tone === "good" ? "rgba(34,197,94,.16)" : "rgba(56,189,248,.12)";
  return <button onClick={onClick} style={{ border: `1px solid ${border}`, borderRadius: 12, padding: "8px 10px", background, color, fontWeight: 950, fontSize: 12 }}>{children}</button>;
}

function Dashboard({ transactions }) {
  const s = calcStats(transactions);
  const maxFood = Math.max(1, ...s.foodRows.map((r) => r.amount));
  const maxGroup = Math.max(1, ...s.groupRows.map((r) => r.amount));
  const foodTotal = sum(s.foodRows);
  const expenseRows = [...s.expenseRows].sort((a, b) => b.date.localeCompare(a.date));
  const pass = expenseRows.length >= 15 && s.expense >= 1105;
  return <>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
      <Metric label="本月收入" value={money(s.income)} sub="薪水 / 兼職 / 其他" />
      <Metric label="本月支出" value={money(s.expense)} sub={`七月支出 ${pass ? "已更新" : "CHECK"}`} />
      <Metric label="生活費已用" value={money(s.living)} sub={`剩餘 ${money(LIVING_BUDGET - s.living)}`} />
      <Metric label="固定支出" value={money(s.fixed)} sub="手機 / 訂閱 / 保險" />
    </div>
    <Card><Title title="本月大類支出" right="月報初判" />{s.groupRows.map((r) => <div key={r.name} style={{ display: "grid", gridTemplateColumns: "86px 1fr 70px", alignItems: "center", gap: 10, margin: "12px 0" }}><div style={{ fontSize: 13, fontWeight: 900 }}>{r.name}</div><Bar amount={r.amount} max={maxGroup} /><div style={{ textAlign: "right", fontWeight: 950 }}>{money(r.amount)}</div></div>)}<div style={{ marginTop: 14, color: "#cbd5e1", fontSize: 13, lineHeight: 1.6 }}>大分類已加入：飲食、服飾、居住、交通、教育、娛樂、醫療、金融。手機月租費仍會自動進固定支出。</div></Card>
    <Card><Title title="飲食大類｜細項支出" right={`合計 ${money(foodTotal)}`} />{s.foodRows.map((r) => <div key={r.name} style={{ display: "grid", gridTemplateColumns: "64px 1fr 64px", alignItems: "center", gap: 10, margin: "12px 0" }}><div style={{ fontSize: 13, fontWeight: 900 }}>{r.name}</div><Bar amount={r.amount} max={maxFood} danger={r.name === "菸"} /><div style={{ textAlign: "right", fontWeight: 950 }}>{money(r.amount)}</div></div>)}</Card>
    <Card style={{ padding: 0, overflow: "hidden" }}><details><summary style={{ listStyle: "none", cursor: "pointer", padding: 16 }}><Title title="最近交易" right={`${expenseRows.length} 筆｜點開查看`} /><div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 850 }}>預設縮合，避免主頁拉太長。最近一筆：{expenseRows[0]?.note || "—"} {money(expenseRows[0]?.amount || 0)}</div></summary><div style={{ padding: "0 16px 10px" }}>{expenseRows.map((t) => <Row key={t.id} title={t.note || t.category} sub={`${t.date}｜${t.category}｜${t.account}`} value={money(t.amount)} tone="bad" />)}</div></details></Card>
  </>;
}

function InvoiceSync({ onConfirm }) {
  const [carrier, setCarrier] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [invoices, setInvoices] = useState([]);
  const [mode, setMode] = useState("未同步");
  const [message, setMessage] = useState("刷手機條碼後，這裡用後端查詢載具新增發票；確認後才入帳。");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState({});

  async function syncInvoices() {
    setLoading(true);
    setMessage("同步中...");
    try {
      const res = await fetch("/api/invoices/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carrier, verifyCode, since: `${MONTH}-01`, until: today() })
      });
      const json = await res.json();
      setMode(json.mode || "UNKNOWN");
      setInvoices(Array.isArray(json.invoices) ? json.invoices : []);
      setMessage(json.message || "同步完成，請確認是否入帳。");
    } catch (err) {
      setMessage(`同步失敗：${err.message || "請稍後再試"}`);
    } finally {
      setLoading(false);
    }
  }

  function confirmInvoice(item) {
    const category = item.suggestedCategory || "飲食";
    onConfirm({
      id: `invoice-${item.id}`,
      date: item.date || today(),
      type: "支出",
      amount: Number(item.amount || 0),
      account: "自用",
      category,
      isLivingExpense: "Y",
      isFixedExpense: isFixedCategory(category) ? "Y" : "N",
      affectsBudget: "Y",
      note: `${item.merchant || "發票"}${item.invoiceNo ? `｜${item.invoiceNo}` : ""}`,
      source: "invoice-carrier",
    });
    setDone((p) => ({ ...p, [item.id]: true }));
  }

  return <Card>
    <Title title="載具發票同步" right={mode} />
    <div style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.55, marginBottom: 10 }}>{message}</div>
    <div style={{ display: "grid", gap: 8 }}>
      <input value={carrier} onChange={(e) => setCarrier(e.target.value)} style={inputStyle()} placeholder="手機條碼；例如 /ABC1234" autoComplete="off" />
      <input value={verifyCode} onChange={(e) => setVerifyCode(e.target.value)} style={inputStyle()} placeholder="驗證碼；不會存進 LocalStorage" type="password" autoComplete="off" />
      <button onClick={syncInvoices} disabled={loading} style={{ border: "none", borderRadius: 16, padding: 14, background: loading ? "#334155" : "linear-gradient(90deg,#38bdf8,#22c55e)", color: loading ? "#cbd5e1" : "#020617", fontWeight: 1000 }}>{loading ? "同步中..." : "立即同步載具發票"}</button>
    </div>
    {invoices.length ? <div style={{ marginTop: 12 }}>
      {invoices.map((item) => <div key={item.id} style={{ background: "rgba(15,23,42,.78)", border: "1px solid rgba(148,163,184,.16)", borderRadius: 14, padding: 11, marginBottom: 8 }}>
        <Row title={`${item.merchant}｜${item.suggestedCategory || "待分類"}`} sub={`${item.date}｜${item.invoiceNo || "無發票號"}｜信心 ${Math.round(Number(item.confidence || 0) * 100)}%`} value={money(item.amount)} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          <span style={{ color: done[item.id] ? "#86efac" : "#fde68a", border: `1px solid ${done[item.id] ? "rgba(34,197,94,.35)" : "rgba(245,158,11,.35)"}`, borderRadius: 999, padding: "6px 9px", fontSize: 12, fontWeight: 850 }}>{done[item.id] ? "已入帳" : "待確認"}</span>
          {!done[item.id] ? <SmallButton tone="good" onClick={() => confirmInvoice(item)}>確認入帳</SmallButton> : null}
        </div>
      </div>)}
    </div> : null}
  </Card>;
}

function Entry({ transactions, setTransactions, onDelete }) {
  const [form, setForm] = useState({ date: today(), type: "支出", amount: "", account: "自用", category: "飲食", note: "" });
  function save() {
    const amount = Number(form.amount || 0);
    if (!amount) return;
    const fixed = isFixedCategory(form.category);
    const note = form.note?.trim() || form.category;
    setTransactions([{ id: `manual-${Date.now()}`, ...form, note, amount, isLivingExpense: "Y", isFixedExpense: fixed ? "Y" : "N", affectsBudget: "Y" }, ...transactions]);
    setForm({ ...form, amount: "", note: "" });
  }
  function confirmInvoice(tx) {
    setTransactions((prev) => prev.some((t) => t.id === tx.id) ? prev : [tx, ...prev]);
  }
  return <>
    <InvoiceSync onConfirm={confirmInvoice} />
    <Card><Title title="新增交易" right="手動" />
      <div style={{ display: "grid", gap: 10 }}>
        <input value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} style={inputStyle()} type="date" />
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={inputStyle()}>{TYPES.map((x) => <option key={x}>{x}</option>)}</select>
        <input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} style={inputStyle()} placeholder="金額" inputMode="numeric" />
        <select value={form.account} onChange={(e) => setForm({ ...form, account: e.target.value })} style={inputStyle()}>{ACCOUNTS.map((x) => <option key={x}>{x}</option>)}</select>
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={inputStyle()}>{ALL_CATEGORIES.map((x) => x === "────────" ? <option key={x} disabled>{x}</option> : <option key={x}>{x}</option>)}</select>
        <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} style={inputStyle()} placeholder="備註；空白時自動用分類名稱" />
        {isFixedCategory(form.category) ? <div style={{ color: "#fde68a", fontSize: 12, fontWeight: 850 }}>此類別會自動列入固定支出。</div> : null}
        <button onClick={save} style={{ border: "none", borderRadius: 16, padding: 14, background: "linear-gradient(90deg,#38bdf8,#22c55e)", color: "#020617", fontWeight: 1000 }}>儲存這筆</button>
      </div>
    </Card>
    <Card><Title title="交易清單" right={`${transactions.length} 筆`} />{transactions.map((t) => <Row key={t.id} title={t.note || t.category} sub={`${t.date}｜${t.category}｜${t.account}${isFixedCategory(t.category) ? "｜固定" : ""}`} value={money(t.amount)} action={<SmallButton tone="bad" onClick={() => onDelete(t.id)}>刪除</SmallButton>} />)}</Card>
  </>;
}

function inputStyle() {
  return { width: "100%", background: "rgba(15,23,42,.88)", border: "1px solid rgba(148,163,184,.24)", color: "#f8fafc", borderRadius: 14, padding: 12, fontSize: 15, outline: "none" };
}

function Budget({ transactions }) {
  const s = calcStats(transactions);
  const pct = Math.round((s.living / LIVING_BUDGET) * 100);
  return <Card><Title title="預算控管" right={MONTH} /><Row title="生活費" sub={`已用 ${money(s.living)} / 預算 ${money(LIVING_BUDGET)}`} value={`${pct}%`} tone={pct > 100 ? "bad" : "good"} /><div style={{ height: 8, borderRadius: 999, background: "#243044", overflow: "hidden" }}><div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: pct > 100 ? "#ef4444" : "linear-gradient(90deg,#22c55e,#38bdf8)" }} /></div></Card>;
}

function Assets({ transactions, setTransactions }) {
  function resetSeed() { setTransactions(seedTransactions); }
  function exportJson() {
    const blob = new Blob([JSON.stringify({ version: "financial-os-v6", exportedAt: new Date().toISOString(), transactions }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `josh-financial-os-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return <>
    <Card><Title title="資產中心" right="手動版" />{["現金", "銀行", "ETF｜0050 / VOO / QQQM", "Crypto｜BTC / USDT", "xStocks｜NVDAon / TSMon"].map((x) => <Row key={x} title={x} sub="待接入正式資產資料" value="$—" />)}</Card>
    <Card><Title title="備份 / 還原" right="LocalStorage" /><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><SmallButton tone="good" onClick={exportJson}>匯出 JSON</SmallButton><SmallButton tone="bad" onClick={resetSeed}>重置七月支出</SmallButton></div></Card>
  </>;
}

export default function FinancialOSPage() {
  const [tab, setTab] = useState("dashboard");
  const [transactions, setTransactions] = useState(seedTransactions);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (Array.isArray(saved)) setTransactions(saved);
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions)); } catch {}
  }, [transactions]);

  function deleteTx(id) { setTransactions((prev) => prev.filter((t) => t.id !== id)); }
  const tabs = [["dashboard", "總覽"], ["entry", "記帳"], ["budget", "預算"], ["assets", "資產"]];

  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "linear-gradient(180deg,#020617 0%,#0f172a 55%,#111827 100%)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 430, margin: "0 auto", padding: "18px 14px 94px" }}>
      <section style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
        <div><div style={{ fontSize: 22, fontWeight: 1000 }}>Josh Financial OS</div><div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 800, marginTop: 5 }}>多元記帳本 V1.9｜載具同步骨架</div></div>
        <a href="/josh-os" style={{ color: "#bae6fd", textDecoration: "none", border: "1px solid rgba(56,189,248,.35)", borderRadius: 999, padding: "7px 10px", fontSize: 12, fontWeight: 950 }}>四合一</a>
      </section>
      {tab === "dashboard" ? <Dashboard transactions={transactions} /> : null}
      {tab === "entry" ? <Entry transactions={transactions} setTransactions={setTransactions} onDelete={deleteTx} /> : null}
      {tab === "budget" ? <Budget transactions={transactions} /> : null}
      {tab === "assets" ? <Assets transactions={transactions} setTransactions={setTransactions} /> : null}
    </div>
    <nav style={{ position: "fixed", left: 0, right: 0, bottom: 0, background: "rgba(2,6,23,.92)", backdropFilter: "blur(16px)", borderTop: "1px solid rgba(148,163,184,.18)", padding: "8px 10px 10px" }}>
      <div style={{ maxWidth: 430, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>{tabs.map(([key, label]) => <button key={key} onClick={() => setTab(key)} style={{ border: "none", borderRadius: 12, padding: "9px 4px", background: tab === key ? "rgba(56,189,248,.13)" : "transparent", color: tab === key ? "#f8fafc" : "#94a3b8", fontSize: 11, fontWeight: 900 }}>{label}</button>)}</div>
    </nav>
  </main>;
}
