import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "josh-financial-os-transactions-20260705-v2";
const MONTH = "2026-07";
const RANGE_START = "2026-07-01";
const RANGE_END = "2026-07-05";
const LIVING_BUDGET = 8000;

const seedTransactions = [
  { id: "food-0705-breakfast", date: "2026-07-05", type: "支出", title: "早餐", amount: 80, category: "食", detailCategory: "早餐", account: "自用", payer: "你付", isLivingExpense: "Y", affectsBudget: "Y" },
  { id: "food-0704-dinner", date: "2026-07-04", type: "支出", title: "晚餐", amount: 100, category: "食", detailCategory: "晚餐", account: "自用", payer: "你付", isLivingExpense: "Y", affectsBudget: "Y" },
  { id: "food-0704-coffee", date: "2026-07-04", type: "支出", title: "咖啡", amount: 30, category: "食", detailCategory: "咖啡", account: "自用", payer: "你付", isLivingExpense: "Y", affectsBudget: "Y" },
  { id: "food-0704-breakfast", date: "2026-07-04", type: "支出", title: "早餐", amount: 45, category: "食", detailCategory: "早餐", account: "自用", payer: "你付", isLivingExpense: "Y", affectsBudget: "Y" },
  { id: "food-0704-cigarette", date: "2026-07-04", type: "支出", title: "菸", amount: 85, category: "食", detailCategory: "菸", account: "自用", payer: "你付", isLivingExpense: "Y", affectsBudget: "Y" },
  { id: "food-0703-shaved-ice", date: "2026-07-03", type: "支出", title: "挫冰", amount: 65, category: "食", detailCategory: "點心/宵夜", account: "自用", payer: "你付", isLivingExpense: "Y", affectsBudget: "Y" },
  { id: "food-0703-chicken", date: "2026-07-03", type: "支出", title: "雞排", amount: 80, category: "食", detailCategory: "點心/宵夜", account: "自用", payer: "你付", isLivingExpense: "Y", affectsBudget: "Y" },
  { id: "food-0703-coffee-suncake", date: "2026-07-03", type: "支出", title: "咖啡+太陽餅", amount: 100, category: "食", detailCategory: "咖啡", account: "自用", payer: "你付", isLivingExpense: "Y", affectsBudget: "Y" },
  { id: "food-0703-cigarette", date: "2026-07-03", type: "支出", title: "菸", amount: 85, category: "食", detailCategory: "菸", account: "自用", payer: "你付", isLivingExpense: "Y", affectsBudget: "Y" },
  { id: "food-0703-iced-latte", date: "2026-07-03", type: "支出", title: "中冰拿", amount: 45, category: "食", detailCategory: "咖啡", account: "自用", payer: "你付", isLivingExpense: "Y", affectsBudget: "Y" },
  { id: "food-0703-breakfast", date: "2026-07-03", type: "支出", title: "早餐", amount: 70, category: "食", detailCategory: "早餐", account: "自用", payer: "你付", isLivingExpense: "Y", affectsBudget: "Y" },
  { id: "food-0702-cigarette", date: "2026-07-02", type: "支出", title: "菸", amount: 85, category: "食", detailCategory: "菸", account: "自用", payer: "你付", isLivingExpense: "Y", affectsBudget: "Y" },
  { id: "food-0702-iced-latte", date: "2026-07-02", type: "支出", title: "中冰拿", amount: 40, category: "食", detailCategory: "咖啡", account: "自用", payer: "你付", isLivingExpense: "Y", affectsBudget: "Y" },
  { id: "food-0701-cigarette-black-coffee", date: "2026-07-01", type: "支出", title: "菸+黑咖啡", amount: 115, category: "食", detailCategory: "菸/咖啡", account: "自用", payer: "你付", isLivingExpense: "Y", affectsBudget: "Y" },
  { id: "food-0701-breakfast", date: "2026-07-01", type: "支出", title: "早餐", amount: 80, category: "食", detailCategory: "早餐", account: "自用", payer: "你付", isLivingExpense: "Y", affectsBudget: "Y" },
];

function nt(n) {
  return `NT$${Number(n || 0).toLocaleString("zh-TW", { maximumFractionDigits: 0 })}`;
}
function shortMoney(n) {
  return `$${Number(n || 0).toLocaleString("zh-TW", { maximumFractionDigits: 0 })}`;
}
function sum(rows) {
  return rows.reduce((s, t) => s + Number(t.amount || 0), 0);
}
function inRange(tx) {
  return tx.date >= RANGE_START && tx.date <= RANGE_END;
}
function inMonth(tx) {
  return String(tx.date || "").slice(0, 7) === MONTH;
}
function daysBetween(a, b) {
  const day = 24 * 60 * 60 * 1000;
  return Math.round((new Date(a) - new Date(b)) / day);
}
function relativeDate(date) {
  const d = daysBetween(RANGE_END, date);
  if (d === 0) return "今天";
  if (d === 1) return "昨天";
  if (d === 2) return "前天";
  return `${d} 天前`;
}
function byDateDesc(a, b) {
  if (a.date !== b.date) return b.date.localeCompare(a.date);
  return 0;
}

function calcStats(transactions) {
  const rangeRows = transactions.filter((t) => t.type === "支出" && inRange(t));
  const monthRows = transactions.filter((t) => t.type === "支出" && inMonth(t));
  const income = transactions.filter((t) => t.type === "收入" && inMonth(t)).reduce((s, t) => s + Number(t.amount || 0), 0);
  const expense = sum(monthRows);
  const food = sum(monthRows.filter((t) => t.category === "食"));
  const detailMap = {};
  for (const t of monthRows) {
    const key = t.detailCategory || t.title || "其他";
    detailMap[key] = (detailMap[key] || 0) + Number(t.amount || 0);
  }
  return { rangeRows, monthRows, income, expense, food, detailRows: Object.entries(detailMap).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount) };
}

function Chip({ children, active }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 16px", borderRadius: 999, background: active ? "#4a2d20" : "#dcecdf", color: active ? "#fff8ed" : "#375144", fontWeight: 1000, boxShadow: active ? "0 6px 12px rgba(74,45,32,.18)" : "none" }}>{children}</span>;
}
function FoodIcon() {
  return <div style={{ width: 38, height: 38, borderRadius: 12, display: "grid", placeItems: "center", background: "#f2dfcd", color: "#9a613b", fontWeight: 1000 }}>食</div>;
}
function RecordRow({ tx }) {
  return <div style={{ display: "grid", gridTemplateColumns: "42px 1fr auto", gap: 10, alignItems: "center", padding: "12px 0", borderBottom: "1px solid #efe4d8" }}>
    <FoodIcon />
    <div>
      <div style={{ color: "#352217", fontSize: 15, fontWeight: 950 }}>{tx.title}</div>
      <div style={{ marginTop: 4, color: "#9a8a7f", fontSize: 12, fontWeight: 850 }}>{relativeDate(tx.date)}・🌏 {tx.payer || "你付"}</div>
    </div>
    <div style={{ textAlign: "right" }}>
      <div style={{ color: "#2e211a", fontSize: 15, fontWeight: 1000 }}>{nt(tx.amount)}</div>
      <div style={{ color: "#c47f77", fontSize: 12, fontWeight: 850, marginTop: 4 }}>${Number(tx.amount || 0).toLocaleString("zh-TW")}</div>
    </div>
  </div>;
}

function MiniChart({ rows }) {
  const byDay = {};
  rows.forEach((t) => { byDay[t.date] = (byDay[t.date] || 0) + Number(t.amount || 0); });
  const days = ["2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04", "2026-07-05"];
  const max = Math.max(1, ...days.map((d) => byDay[d] || 0));
  return <div style={{ height: 112, margin: "10px 8px 4px", position: "relative" }}>
    <div style={{ position: "absolute", left: 10, right: 10, top: 20, height: 1, background: "#dbc3ad" }} />
    <div style={{ position: "absolute", left: 10, right: 10, bottom: 25, height: 1, background: "#ead9c9" }} />
    <div style={{ position: "absolute", left: 10, right: 10, bottom: 20, display: "flex", alignItems: "end", justifyContent: "space-between" }}>
      {days.map((d) => <div key={d} style={{ width: 18, height: 78, display: "flex", alignItems: "end", justifyContent: "center" }}><div style={{ width: 8, height: `${Math.max(8, Math.round(((byDay[d] || 0) / max) * 76))}px`, background: "#d7a86f", borderRadius: 5 }} /></div>)}
    </div>
    <div style={{ position: "absolute", left: 10, right: 10, bottom: 0, display: "flex", justifyContent: "space-between", color: "#9d8a78", fontSize: 11, fontWeight: 850 }}><span>1</span><span>8</span><span>16</span><span>23</span><span>31</span></div>
  </div>;
}

function RecordsPage({ transactions, setTransactions }) {
  const stats = calcStats(transactions);
  const rows = [...stats.rangeRows].sort(byDateDesc);
  const pass = rows.length === 15 && sum(rows) === 1105;

  function resetScreenshotData() {
    setTransactions(seedTransactions);
  }

  return <>
    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
      <h1 style={{ margin: 0, color: "#2e211a", fontSize: 26, fontWeight: 1000 }}>記錄</h1>
      <a href="/josh-os" style={{ color: "#8d6f5a", textDecoration: "none", fontSize: 14, fontWeight: 900 }}>定期 ›</a>
    </header>

    <div style={{ display: "flex", gap: 8, marginBottom: 14 }}><Chip active>• 支出</Chip><Chip>• 收入</Chip></div>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
      <div style={{ flex: 1, border: "1px solid #dbbda2", borderRadius: 999, padding: "8px 13px", color: "#4a2d20", fontWeight: 950, background: "#fffaf5" }}>日期&nbsp; {RANGE_START} → {RANGE_END} ×</div>
      <button onClick={resetScreenshotData} style={{ border: "none", borderRadius: 999, background: "#4a2d20", color: "#fff8ed", padding: "10px 14px", fontWeight: 1000 }}>篩選・</button>
    </div>

    <MiniChart rows={rows} />
    <div style={{ display: "flex", gap: 14, justifyContent: "center", color: "#9a8a7f", fontSize: 12, fontWeight: 850, marginBottom: 28 }}><span>■ 收入</span><span>■ 支出</span><span>— 累計結餘</span></div>

    <section style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
      <h2 style={{ margin: 0, color: "#2e211a", fontSize: 20, fontWeight: 1000 }}>2026年7月</h2>
      <div style={{ color: "#8d6f5a", fontSize: 13, fontWeight: 900 }}>{rows.length} 筆・{nt(sum(rows))}</div>
    </section>

    <section style={{ background: "#fffdfa", borderRadius: 18, padding: "4px 14px", boxShadow: "0 10px 26px rgba(82,50,28,.08)", border: "1px solid #f0e4d8" }}>
      {rows.map((tx) => <RecordRow key={tx.id} tx={tx} />)}
    </section>

    <div style={{ textAlign: "center", color: pass ? "#667d5b" : "#b45309", fontSize: 13, fontWeight: 900, margin: "24px 0 8px" }}>
      {pass ? "核對通過：15 筆支出 = NT$1,105" : `核對中：${rows.length} 筆 / ${nt(sum(rows))}`}
    </div>
  </>;
}

function HomePage({ transactions }) {
  const s = calcStats(transactions);
  const remaining = LIVING_BUDGET - s.expense;
  return <>
    <header style={{ marginBottom: 16 }}><h1 style={{ margin: 0, color: "#2e211a", fontSize: 26, fontWeight: 1000 }}>Josh Financial OS</h1><div style={{ color: "#8d6f5a", marginTop: 5, fontSize: 13, fontWeight: 850 }}>2026年7月生活費記帳</div></header>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      {[['本月支出', nt(s.expense)], ['食費合計', nt(s.food)], ['剩餘預算', nt(remaining)], ['收支結餘', nt(s.income - s.expense)]].map(([label, value]) => <section key={label} style={{ background: "#fffdfa", border: "1px solid #f0e4d8", borderRadius: 18, padding: 15 }}><div style={{ color: "#9a8a7f", fontSize: 12, fontWeight: 900 }}>{label}</div><div style={{ color: "#2e211a", fontSize: 23, fontWeight: 1000, marginTop: 6 }}>{value}</div></section>)}
    </div>
    <section style={{ marginTop: 14, background: "#fffdfa", borderRadius: 18, padding: 16, border: "1px solid #f0e4d8" }}><h2 style={{ margin: "0 0 12px", color: "#2e211a", fontSize: 18 }}>細項統計</h2>{s.detailRows.map((r) => <div key={r.name} style={{ display: "grid", gridTemplateColumns: "86px 1fr 70px", alignItems: "center", gap: 10, margin: "12px 0" }}><div style={{ color: "#4a2d20", fontWeight: 950 }}>{r.name}</div><div style={{ height: 9, borderRadius: 999, background: "#efdcca", overflow: "hidden" }}><div style={{ width: `${Math.max(4, Math.round((r.amount / Math.max(1, s.expense)) * 100))}%`, height: "100%", background: "#d7a86f", borderRadius: 999 }} /></div><div style={{ color: "#2e211a", textAlign: "right", fontWeight: 1000 }}>{shortMoney(r.amount)}</div></div>)}</section>
  </>;
}

function BudgetPage({ transactions }) {
  const s = calcStats(transactions);
  const pct = Math.round((s.expense / LIVING_BUDGET) * 1000) / 10;
  return <section style={{ background: "#fffdfa", borderRadius: 18, padding: 16, border: "1px solid #f0e4d8" }}>
    <h1 style={{ margin: 0, color: "#2e211a", fontSize: 24 }}>預算</h1>
    <div style={{ marginTop: 16, color: "#4a2d20", fontWeight: 950 }}>生活費：已用 {nt(s.expense)} / 預算 {nt(LIVING_BUDGET)}</div>
    <div style={{ marginTop: 10, height: 12, borderRadius: 999, background: "#efdcca", overflow: "hidden" }}><div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: "linear-gradient(90deg,#85aa7b,#d7a86f)", borderRadius: 999 }} /></div>
    <div style={{ marginTop: 8, color: "#8d6f5a", fontWeight: 900 }}>{pct}%｜剩餘 {nt(LIVING_BUDGET - s.expense)}</div>
  </section>;
}

function AssetsPage() {
  return <section style={{ background: "#fffdfa", borderRadius: 18, padding: 16, border: "1px solid #f0e4d8" }}>
    <h1 style={{ margin: 0, color: "#2e211a", fontSize: 24 }}>資產</h1>
    <div style={{ color: "#8d6f5a", marginTop: 12, lineHeight: 1.8, fontWeight: 850 }}>這頁保留給三帳戶、ETF、BTC、xStocks 與未來銀行同步。這次只更新支出紀錄，不動資產核心。</div>
  </section>;
}

export default function FinancialOSPage() {
  const [tab, setTab] = useState("records");
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

  const tabs = [
    ["home", "首頁"],
    ["records", "紀錄"],
    ["budget", "愛物"],
    ["assets", "設定"],
  ];

  return <main style={{ minHeight: "100vh", background: "#f7eadc", color: "#2e211a", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 430, margin: "0 auto", padding: "52px 18px 104px" }}>
      {tab === "home" ? <HomePage transactions={transactions} /> : null}
      {tab === "records" ? <RecordsPage transactions={transactions} setTransactions={setTransactions} /> : null}
      {tab === "budget" ? <BudgetPage transactions={transactions} /> : null}
      {tab === "assets" ? <AssetsPage /> : null}
    </div>
    <nav style={{ position: "fixed", left: 0, right: 0, bottom: 0, background: "rgba(255,253,250,.92)", backdropFilter: "blur(18px)", borderTop: "1px solid #ead8c5", padding: "9px 12px 12px" }}>
      <div style={{ maxWidth: 430, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr 76px 1fr 1fr", gap: 8, alignItems: "center" }}>
        <button onClick={() => setTab("home")} style={navButton(tab === "home")}>⌂<br />首頁</button>
        <button onClick={() => setTab("records")} style={navButton(tab === "records")}>▤<br />紀錄</button>
        <button onClick={() => setTransactions(seedTransactions)} style={{ width: 64, height: 64, borderRadius: 999, border: "none", background: "#4a2d20", color: "#fff8ed", fontSize: 30, fontWeight: 900, boxShadow: "0 10px 24px rgba(74,45,32,.28)" }}>＋</button>
        <button onClick={() => setTab("budget")} style={navButton(tab === "budget")}>▦<br />愛物</button>
        <button onClick={() => setTab("assets")} style={navButton(tab === "assets")}>⚙<br />設定</button>
      </div>
    </nav>
  </main>;
}

function navButton(active) {
  return { border: "none", background: "transparent", color: active ? "#4a2d20" : "#a39386", fontSize: 12, fontWeight: active ? 1000 : 850, lineHeight: 1.45 };
}
