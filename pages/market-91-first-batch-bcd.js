import { useEffect, useState } from "react";

function Pill({ children, tone = "blue" }) {
  const map = { green: ["#bbf7d0", "rgba(34,197,94,.14)"], yellow: ["#fde68a", "rgba(245,158,11,.14)"], red: ["#fecaca", "rgba(248,113,113,.14)"], blue: ["#bfdbfe", "rgba(59,130,246,.13)"] };
  const [color, bg] = map[tone] || map.blue;
  return <span style={{ display: "inline-flex", margin: 3, padding: "5px 8px", borderRadius: 999, color, background: bg, fontSize: 12, fontWeight: 1000 }}>{children}</span>;
}
function tone(row) {
  if (row.confidenceFlag === "OBJECTIVE_BLOCKED") return "red";
  if (String(row.scoreTrust).startsWith("provisional")) return "yellow";
  if (row.classification === "FORMAL_OBSERVATION_CANDIDATE_ONLY") return "green";
  return "blue";
}
function Box({ title, children, toneName = "blue" }) {
  const border = toneName === "red" ? "rgba(248,113,113,.35)" : toneName === "yellow" ? "rgba(245,158,11,.34)" : toneName === "green" ? "rgba(34,197,94,.34)" : "rgba(59,130,246,.30)";
  return <section style={{ marginTop: 14, border: `1px solid ${border}`, background: "rgba(15,23,42,.76)", borderRadius: 22, padding: 16 }}><h2 style={{ margin: "0 0 10px", color: "#f8fafc", fontSize: 18, fontWeight: 1000 }}>{title}</h2>{children}</section>;
}
function Card({ row }) {
  const t = tone(row);
  return <article style={{ marginTop: 10, padding: 12, borderRadius: 18, background: "rgba(2,6,23,.48)", border: "1px solid rgba(148,163,184,.22)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><strong style={{ fontSize: 20 }}>{row.ticker}</strong><Pill tone={t}>{row.confidenceFlag}</Pill></div>
    <div style={{ color: "#cbd5e1", fontWeight: 850, fontSize: 13, lineHeight: 1.55 }}>{row.name}<br />{row.classification}</div>
    <div style={{ marginTop: 8, color: "#f8fafc", fontWeight: 1000 }}>A {row.aBacktest} / B {row.bFinancial} / C {row.cSector} / D {row.dRiskFit} / Total {row.total}</div>
    <div style={{ marginTop: 8, color: "#cbd5e1", fontWeight: 850, fontSize: 12, lineHeight: 1.6 }}>{row.summary}</div>
    <div style={{ marginTop: 6, color: t === "red" ? "#fecaca" : t === "yellow" ? "#fde68a" : "#94a3b8", fontWeight: 850, fontSize: 12, lineHeight: 1.6 }}>{row.caveat}</div>
  </article>;
}
export default function Market91FirstBatchBcd() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { fetch(`/api/v17/market-91-first-batch-bcd?t=${Date.now()}`, { cache: "no-store" }).then((r) => r.json()).then((x) => { if (!x.ok) throw new Error(x.error || "讀取失敗"); setData(x); }).catch((e) => setError(e.message || "讀取失敗")); }, []);
  const rows = data?.rows || [];
  const supported = rows.filter((x) => x.visualGroup === "source_supported_draft");
  const blocked = rows.filter((x) => x.visualGroup === "objective_blocked");
  const provisional = rows.filter((x) => String(x.visualGroup).startsWith("provisional"));
  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "linear-gradient(180deg,#020617,#0f172a)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "22px 14px 40px" }}>
      <a href="/market-91-governance" style={{ color: "#93c5fd", textDecoration: "none", fontWeight: 900 }}>← 返回公平篩選規則</a>
      <header style={{ marginTop: 18 }}><div style={{ color: "#38bdf8", letterSpacing: 3, fontWeight: 1000, fontSize: 13 }}>FIRST BATCH B/C/D</div><h1 style={{ fontSize: 34, lineHeight: 1.05, margin: "10px 0", fontWeight: 1000 }}>第一批分數可信度</h1><p style={{ color: "#cbd5e1", lineHeight: 1.55, fontWeight: 850 }}>同樣有數字，不代表可信度相同。HUBB / REGN 必須和其他分數分開看。</p></header>
      {error && <Box title="讀取失敗" toneName="red"><div style={{ color: "#fecaca" }}>{error}</div></Box>}
      {!data && !error && <Box title="讀取中">讀取中…</Box>}
      {data && <>
        <Box title="安全邊界" toneName="yellow"><Pill tone="red">No Buy</Pill><Pill>No DCA</Pill><Pill>No Semi-auto</Pill><div style={{ marginTop: 8, color: "#cbd5e1", fontWeight: 850, lineHeight: 1.55 }}>100 分只是觀察資格篩選，仍需 18 分 Quality Gate。</div></Box>
        <Box title="來源支持草稿分數" toneName="green">{supported.map((row) => <Card key={row.ticker} row={row} />)}</Box>
        <Box title="Objective 財務層阻擋" toneName="red">{blocked.map((row) => <Card key={row.ticker} row={row} />)}</Box>
        <Box title="暫定分數：不可等同排名" toneName="yellow">{provisional.map((row) => <Card key={row.ticker} row={row} />)}</Box>
        <Box title="入口"><a href="/market-91-governance" style={{ color: "#38bdf8", fontWeight: 1000, textDecoration: "none" }}>100分公平篩選規則</a><br /><a href="/market-91-observation" style={{ color: "#bbf7d0", fontWeight: 1000, textDecoration: "none" }}>治理修正版觀察名單</a></Box>
      </>}
    </div>
  </main>;
}
