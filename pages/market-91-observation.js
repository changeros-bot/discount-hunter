import { useEffect, useState } from "react";

function Box({ title, children, tone = "blue" }) {
  const border = tone === "green" ? "rgba(34,197,94,.38)" : tone === "yellow" ? "rgba(245,158,11,.34)" : tone === "red" ? "rgba(248,113,113,.34)" : "rgba(59,130,246,.30)";
  return <section style={{ marginTop: 14, border: `1px solid ${border}`, background: "rgba(15,23,42,.76)", borderRadius: 22, padding: 16 }}><h2 style={{ margin: "0 0 10px", color: "#f8fafc", fontSize: 18, fontWeight: 1000 }}>{title}</h2>{children}</section>;
}
function Pill({ children, tone = "blue" }) {
  const map = { green: ["#bbf7d0", "rgba(34,197,94,.14)"], yellow: ["#fde68a", "rgba(245,158,11,.14)"], red: ["#fecaca", "rgba(248,113,113,.14)"], blue: ["#bfdbfe", "rgba(59,130,246,.13)"], gray: ["#cbd5e1", "rgba(148,163,184,.13)"] };
  const [color, bg] = map[tone] || map.blue;
  return <span style={{ display: "inline-flex", margin: "3px 4px 3px 0", padding: "5px 8px", borderRadius: 999, color, background: bg, fontSize: 12, fontWeight: 1000 }}>{children}</span>;
}
function RowCard({ row }) {
  return <article style={{ marginTop: 10, padding: 12, borderRadius: 18, background: "rgba(2,6,23,.48)", border: "1px solid rgba(34,197,94,.32)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}><strong style={{ color: "#f8fafc", fontSize: 20 }}>{row.priority}. {row.symbol}</strong><Pill tone="green">18分制待驗證</Pill></div>
    <div style={{ marginTop: 6, color: "#cbd5e1", fontWeight: 850, fontSize: 13, lineHeight: 1.55 }}>{row.name}｜{row.bucket}<br />角色：{row.role}</div>
    <div style={{ marginTop: 8, color: "#94a3b8", fontWeight: 850, fontSize: 12, lineHeight: 1.55 }}>理由：{row.reason}<br />規則：{row.rule}<br />下一步：{row.nextStep}</div>
  </article>;
}
export default function Market91Observation() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { fetch(`/api/v17/market-91-observation?t=${Date.now()}`, { cache: "no-store" }).then((r) => r.json()).then((x) => { if (!x.ok) throw new Error(x.error || "讀取失敗"); setData(x); }).catch((e) => setError(e.message || "讀取失敗")); }, []);
  const rows = data?.rows || [];
  const pending = data?.pending || [];
  const reserve = data?.reserve || [];
  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "linear-gradient(180deg,#020617 0%,#07111f 55%,#0f172a 100%)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "22px 14px 40px" }}>
      <a href="/market-91-quality" style={{ color: "#93c5fd", textDecoration: "none", fontWeight: 900 }}>← 返回 Quality 草稿</a>
      <header style={{ marginTop: 18, marginBottom: 18 }}>
        <div style={{ color: "#22c55e", letterSpacing: 3, fontWeight: 1000, fontSize: 13 }}>MARKET 91 OBSERVATION</div>
        <h1 style={{ fontSize: 36, lineHeight: 1.05, margin: "10px 0", fontWeight: 1000 }}>治理修正版</h1>
        <p style={{ color: "#cbd5e1", lineHeight: 1.55, fontWeight: 850, margin: 0 }}>修正後只剩 2 檔可列正式觀察候選，且都必須補完同一套 18 分 Quality Gate。</p>
      </header>
      {error && <Box title="讀取失敗" tone="red"><div style={{ color: "#fecaca" }}>{error}</div></Box>}
      {!data && !error && <Box title="讀取中"><div style={{ color: "#94a3b8" }}>讀取正式觀察候選中…</div></Box>}
      {data && <>
        <Box title="治理原則" tone="yellow"><div><Pill tone="red">Not Buying List</Pill><Pill>Same 18-point Gate</Pill><Pill>Objective First</Pill></div><div style={{ marginTop: 8, color: "#cbd5e1", fontWeight: 850, lineHeight: 1.55 }}>Market 91 只是截圖市場清單，不是推薦榜。任何 AI 敘事或星等都只能初篩；若敘事與 FCF / 資產負債表 / CapEx 衝突，客觀財務層優先。</div></Box>
        <Box title={`正式觀察候選（${rows.length}）`} tone="green">{rows.map((row) => <RowCard key={row.symbol} row={row} />)}</Box>
        <Box title={`待補驗證（${pending.length}）`} tone="yellow">{pending.map((row) => <div key={row.symbol} style={{ marginTop: 8, color: "#cbd5e1", fontWeight: 850, lineHeight: 1.55 }}><Pill tone="yellow">{row.symbol}</Pill>{row.reason}<br /><span style={{ color: "#94a3b8" }}>補件：{row.requiredFix}</span></div>)}</Box>
        <Box title={`保留觀察（${reserve.length}）`} tone="yellow">{reserve.map((row) => <div key={row.symbol} style={{ marginTop: 8, color: "#cbd5e1", fontWeight: 850, lineHeight: 1.55 }}><Pill tone="yellow">{row.symbol}</Pill>{row.reason}</div>)}</Box>
        <Box title="入口"><a href="/market-91-source-verification" style={{ color: "#facc15", fontWeight: 1000, textDecoration: "none" }}>來源驗證清單</a><br /><a href="/market-91-quality" style={{ color: "#bbf7d0", fontWeight: 1000, textDecoration: "none" }}>深審 Quality Gate 草稿</a><br /><a href="/market-91-shortlist" style={{ color: "#fde68a", fontWeight: 1000, textDecoration: "none" }}>91檔二審池</a><br /><a href="/v17" style={{ color: "#bfdbfe", fontWeight: 1000, textDecoration: "none" }}>折價獵人主頁</a></Box>
      </>}
    </div>
  </main>;
}
