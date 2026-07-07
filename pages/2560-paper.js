import { useEffect, useState } from "react";

const pct = (v) => v === null || v === undefined ? "—" : `${(Number(v) * 100).toFixed(2)}%`;
const money = (v) => v === null || v === undefined ? "—" : `$${Number(v).toFixed(2)}`;
const td = { padding: "10px 8px", borderBottom: "1px solid rgba(148,163,184,.14)", fontSize: 13, color: "#cbd5e1", whiteSpace: "nowrap" };
const statusZh = { PENDING: "等待隔日開盤", OPEN: "追蹤中", CLOSED: "已結案" };
const exitZh = { stop_loss_8pct: "停損 -8%", take_profit_15pct: "停利 +15%", max_30d: "滿 30 個交易日" };

function pick(row, keys, fallback = "") {
  for (const key of keys) if (row?.[key] !== undefined && row?.[key] !== "") return row[key];
  return fallback;
}

function Pill({ children, color = "#38bdf8" }) {
  return <span style={{ color, border: `1px solid ${color}55`, background: `${color}14`, padding: "6px 10px", borderRadius: 999, fontWeight: 950, fontSize: 12 }}>{children}</span>;
}

function Card({ title, value, sub, color }) {
  return <section style={{ border: "1px solid rgba(148,163,184,.18)", background: "rgba(15,23,42,.76)", borderRadius: 22, padding: 16 }}>
    <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 900 }}>{title}</div>
    <div style={{ color: color || "#f8fafc", fontSize: 30, fontWeight: 1000, marginTop: 8 }}>{value}</div>
    {sub && <div style={{ color: "#64748b", fontSize: 12, marginTop: 6, fontWeight: 800 }}>{sub}</div>}
  </section>;
}

function TradeTable({ title, rows, empty }) {
  return <section style={{ marginTop: 16, border: "1px solid rgba(148,163,184,.18)", background: "rgba(15,23,42,.72)", borderRadius: 24, overflow: "hidden" }}>
    <div style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <h2 style={{ margin: 0, color: "#f8fafc", fontSize: 18, fontWeight: 1000 }}>{title}</h2>
      <Pill>{rows.length}</Pill>
    </div>
    {rows.length === 0 ? <div style={{ padding: 16, color: "#64748b", fontWeight: 850 }}>{empty}</div> : <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr><th style={td}>股票</th><th style={td}>型態</th><th style={td}>狀態</th><th style={td}>模擬本金</th><th style={td}>進場價</th><th style={td}>現價/出場價</th><th style={td}>報酬</th><th style={td}>損益</th></tr></thead>
        <tbody>{rows.map((r, i) => {
          const ticker = pick(r, ["股票", "ticker"], "—");
          const pattern = pick(r, ["型態", "pattern"], "—");
          const status = statusZh[pick(r, ["status"], "")] || pick(r, ["狀態"], "") || exitZh[pick(r, ["exit_reason"], "")] || pick(r, ["出場原因"], "—");
          const entry = pick(r, ["進場價", "entry_price"], "等待隔日開盤");
          const last = pick(r, ["最後價格", "last_price", "出場價", "exit_price"], "—");
          const ret = pick(r, ["報酬率", "return_pct"], "—");
          const pnl = pick(r, ["損益USD", "paper_pnl_usd"], "—");
          const notional = pick(r, ["模擬本金USD", "paper_notional_usd"], "100");
          return <tr key={pick(r, ["交易編號", "trade_id"], i)}>
            <td style={{ ...td, color: "#f8fafc", fontWeight: 1000 }}>{ticker}</td>
            <td style={td}>{pattern}</td>
            <td style={td}>{status}</td>
            <td style={td}>${notional}</td>
            <td style={td}>{entry}</td>
            <td style={td}>{last}</td>
            <td style={{ ...td, color: String(ret).startsWith("-") ? "#f87171" : "#4ade80", fontWeight: 950 }}>{ret}</td>
            <td style={{ ...td, color: String(pnl).startsWith("-") ? "#f87171" : "#4ade80", fontWeight: 950 }}>{pnl === "—" ? "—" : `$${pnl}`}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>}
  </section>;
}

export default function Paper2560() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    fetch("/api/2560-paper").then((r) => r.json()).then((j) => j.ok ? setData(j) : setError(j.error || "讀取失敗")).catch((e) => setError(e.message));
  }, []);
  const s = data?.summary;
  const openRows = data ? [...data.pending, ...data.open] : [];
  const closedRows = data?.closed || [];
  const openExposure = s?.openExposure ?? ((s?.open || 0) + (s?.pending || 0)) * 100;
  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "linear-gradient(180deg,#020617 0%,#07111f 55%,#0f172a 100%)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "22px 14px 40px" }}>
      <a href="/" style={{ color: "#93c5fd", textDecoration: "none", fontWeight: 900 }}>← 返回專案首頁</a>
      <header style={{ marginTop: 18, marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ color: "#38bdf8", letterSpacing: 3, fontWeight: 1000, fontSize: 13 }}>2560 技術研究室</div>
          <Pill color="#f59e0b">紙上交易 V0.5</Pill>
        </div>
        <h1 style={{ fontSize: 38, lineHeight: 1.05, margin: "10px 0", fontWeight: 1000 }}>2560 紙上交易追蹤</h1>
        <p style={{ color: "#cbd5e1", lineHeight: 1.55, fontWeight: 850, margin: 0 }}>日線收盤後訊號｜隔日開盤模擬進場｜每筆模擬本金 100 美元｜只記錄，不下單。</p>
      </header>
      {error && <section style={{ border: "1px solid #ef444455", background: "#ef444414", color: "#fecaca", borderRadius: 20, padding: 16, fontWeight: 850 }}>讀取失敗：{error}</section>}
      {!data && !error && <section style={{ border: "1px solid rgba(148,163,184,.18)", background: "rgba(15,23,42,.76)", borderRadius: 22, padding: 18, color: "#94a3b8", fontWeight: 900 }}>讀取紙上交易狀態中…</section>}
      {s && <>
        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Card title="追蹤中" value={s.open + s.pending} sub={`追蹤中 ${s.open}｜等待 ${s.pending}`} color="#38bdf8" />
          <Card title="模擬曝險" value={money(openExposure)} sub="未平倉模擬本金" color="#f59e0b" />
          <Card title="已結案" value={s.closed} sub={`總紀錄 ${s.total}`} color="#a78bfa" />
          <Card title="勝率" value={pct(s.winRate)} sub="已結案交易" color="#22c55e" />
          <Card title="損益因子" value={s.profitFactor ? Number(s.profitFactor).toFixed(2) : "—"} sub={`平均 ${pct(s.avgReturn)}`} color="#f59e0b" />
          <Card title="已實現損益" value={money(s.realizedPnl || 0)} sub="紙上損益，不是真實資金" color="#4ade80" />
        </section>
        <section style={{ marginTop: 14, border: "1px solid rgba(56,189,248,.22)", background: "rgba(8,47,73,.28)", borderRadius: 22, padding: 16, color: "#cbd5e1", fontWeight: 850, lineHeight: 1.55 }}>
          <div style={{ color: "#f8fafc", fontWeight: 1000 }}>規則</div>
          <div>{s.rule}</div>
          <div style={{ marginTop: 6, color: "#94a3b8" }}>{s.universe}</div>
        </section>
        <TradeTable title="追蹤中 / 等待進場" rows={openRows} empty="目前沒有追蹤中的紙上交易。" />
        <TradeTable title="最近已結案" rows={closedRows} empty="目前尚無已結案紙上交易。" />
      </>}
    </div>
  </main>;
}
