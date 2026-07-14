import { useEffect, useMemo, useState } from "react";

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => today().slice(0, 7) + "-01";
const nt = (n) => "$" + Number(n || 0).toLocaleString("zh-TW", { maximumFractionDigits: 0 });

const inputStyle = {
  width: "100%",
  background: "rgba(15,23,42,.9)",
  border: "1px solid rgba(34,197,94,.3)",
  color: "#f8fafc",
  borderRadius: 14,
  padding: 11,
  fontSize: 14,
  outline: "none",
};

const card = {
  background: "linear-gradient(160deg,rgba(17,24,39,.98),rgba(15,23,42,.98))",
  border: "1px solid rgba(34,197,94,.36)",
  borderRadius: 22,
  padding: 15,
  marginBottom: 12,
};

export default function FinancialAudit() {
  const [filters, setFilters] = useState({ start: monthStart(), end: today(), q: "", type: "", category: "", account: "", budgetId: "" });
  const [data, setData] = useState({ transactions: [], budgets: [], assets: [] });
  const [status, setStatus] = useState("讀取 Neon 帳本…");
  const [loading, setLoading] = useState(false);

  async function load(next = filters) {
    setLoading(true);
    setStatus("查帳中…");
    try {
      const params = new URLSearchParams({ ...next, limit: "1000" });
      Object.keys(next).forEach((key) => { if (!next[key]) params.delete(key); });
      const res = await fetch(`/api/financial/data?${params.toString()}&t=${Date.now()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || json?.ok === false) throw new Error(json?.error || `HTTP ${res.status}`);
      setData(json);
      setStatus(`Neon 已載入 ${json.transactions.length} 筆交易`);
    } catch (error) {
      setStatus(`查帳失敗：${error.message || "unknown_error"}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(filters); }, []);

  const categories = useMemo(() => [...new Set(data.transactions.map((t) => t.category).filter(Boolean))].sort(), [data.transactions]);
  const accounts = useMemo(() => [...new Set(data.transactions.map((t) => t.account).filter(Boolean))].sort(), [data.transactions]);
  const totals = useMemo(() => {
    const income = data.transactions.filter((t) => t.type === "收入").reduce((s, t) => s + Number(t.amount || 0), 0);
    const expense = data.transactions.filter((t) => t.type !== "收入").reduce((s, t) => s + Number(t.amount || 0), 0);
    return { income, expense, balance: income - expense };
  }, [data.transactions]);

  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "radial-gradient(circle at 50% -10%,rgba(34,197,94,.16),transparent 28%),linear-gradient(180deg,#020617,#0f172a)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 430, margin: "0 auto", padding: "18px 14px 80px" }}>
      <div style={{ marginBottom: 15 }}>
        <div style={{ fontSize: 24, fontWeight: 1000 }}>多元記帳本・查帳</div>
        <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 5, fontWeight: 800 }}>資料源：Neon PostgreSQL｜可依日期、備註、分類、帳戶、預算查詢</div>
      </div>

      <section style={card}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
          <input type="date" value={filters.start} onChange={(e) => setFilters({ ...filters, start: e.target.value })} style={inputStyle} />
          <input type="date" value={filters.end} onChange={(e) => setFilters({ ...filters, end: e.target.value })} style={inputStyle} />
        </div>
        <input value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} placeholder="搜尋備註、分類或帳戶，例如：99、燈具、其他" style={{ ...inputStyle, marginTop: 9 }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginTop: 9 }}>
          <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })} style={inputStyle}><option value="">全部類型</option><option>收入</option><option>支出</option><option>投資扣款</option></select>
          <select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })} style={inputStyle}><option value="">全部分類</option>{categories.map((x) => <option key={x}>{x}</option>)}</select>
          <select value={filters.account} onChange={(e) => setFilters({ ...filters, account: e.target.value })} style={inputStyle}><option value="">全部帳戶</option>{accounts.map((x) => <option key={x}>{x}</option>)}</select>
          <select value={filters.budgetId} onChange={(e) => setFilters({ ...filters, budgetId: e.target.value })} style={inputStyle}><option value="">全部預算</option>{data.budgets.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        </div>
        <button disabled={loading} onClick={() => load(filters)} style={{ width: "100%", marginTop: 10, padding: 12, borderRadius: 14, border: "1px solid rgba(212,175,55,.72)", background: "linear-gradient(180deg,rgba(250,204,21,.28),rgba(92,64,16,.74))", color: "#fff7bd", fontWeight: 1000 }}>{loading ? "查帳中…" : "執行查帳"}</button>
      </section>

      <section style={card}>
        <div style={{ color: "#86efac", fontSize: 12, fontWeight: 900 }}>{status}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 12 }}>
          {[["收入", totals.income, "#86efac"], ["總支出", totals.expense, "#fca5a5"], ["淨額", totals.balance, totals.balance >= 0 ? "#86efac" : "#fca5a5"]].map(([label, value, color]) => <div key={label} style={{ padding: 11, borderRadius: 13, background: "rgba(2,6,23,.65)", textAlign: "center", border: "1px solid rgba(148,163,184,.15)" }}><div style={{ color: "#94a3b8", fontSize: 11 }}>{label}</div><div style={{ color, fontSize: 20, fontWeight: 1000, marginTop: 3 }}>{nt(value)}</div></div>)}
        </div>
      </section>

      <section style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}><b style={{ fontSize: 18 }}>查帳明細</b><span style={{ color: "#86efac", fontSize: 12, fontWeight: 900 }}>{data.transactions.length} 筆</span></div>
        {data.transactions.length === 0 ? <div style={{ color: "#94a3b8", fontSize: 12 }}>沒有符合條件的紀錄。</div> : data.transactions.map((t) => <div key={t.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, padding: "11px 0", borderBottom: "1px solid rgba(148,163,184,.12)" }}>
          <div><b>{t.note || t.category || t.type}</b><div style={{ color: "#94a3b8", fontSize: 11, marginTop: 4 }}>{t.date}｜{t.type}｜{t.category}｜{t.account}{t.budgetId ? `｜預算：${data.budgets.find((b) => b.id === t.budgetId)?.name || t.budgetId}` : ""}</div></div>
          <b style={{ color: t.type === "收入" ? "#86efac" : "#fca5a5" }}>{nt(t.amount)}</b>
        </div>)}
      </section>

      <div style={{ display: "grid", gap: 9 }}>
        <a href="/financial-os" style={{ textAlign: "center", textDecoration: "none", padding: 12, borderRadius: 14, border: "1px solid rgba(34,197,94,.38)", color: "#bbf7d0", fontWeight: 900 }}>返回多元記帳本</a>
        <a href="/financial-migrate" style={{ textAlign: "center", textDecoration: "none", padding: 12, borderRadius: 14, border: "1px solid rgba(148,163,184,.26)", color: "#cbd5e1", fontWeight: 900 }}>安全轉移／重新同步</a>
      </div>
    </div>
  </main>;
}
