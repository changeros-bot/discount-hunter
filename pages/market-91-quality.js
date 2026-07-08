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
function toneFor(q) { return q === "PASSED_DRAFT" ? "green" : q === "WATCH" ? "yellow" : "red"; }
function labelFor(q) { return q === "PASSED_DRAFT" ? "草稿通過" : q === "WATCH" ? "觀察" : "草稿失敗"; }
function CheckList({ title, items }) {
  return <details style={{ marginTop: 10, color: "#cbd5e1", fontSize: 12, lineHeight: 1.55, fontWeight: 850 }}><summary style={{ color: "#bfdbfe", fontWeight: 1000 }}>{title}</summary><ul>{(items || []).map((x) => <li key={x.name} style={{ color: x.status === "通過" ? "#bbf7d0" : x.status === "觀察" ? "#fde68a" : "#fecaca" }}>{x.name}：{x.status} / {x.score} — {x.reason}</li>)}</ul></details>;
}
function RowCard({ row }) {
  const tone = toneFor(row.quality);
  return <article style={{ marginTop: 10, padding: 12, borderRadius: 18, background: "rgba(2,6,23,.48)", border: `1px solid ${tone === "green" ? "rgba(34,197,94,.32)" : tone === "yellow" ? "rgba(245,158,11,.28)" : "rgba(248,113,113,.30)"}` }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}><strong style={{ color: "#f8fafc", fontSize: 20 }}>{row.symbol}</strong><Pill tone={tone}>{labelFor(row.quality)}</Pill></div>
    <div style={{ marginTop: 6, color: "#cbd5e1", fontWeight: 850, fontSize: 13, lineHeight: 1.55 }}>{row.name}｜{row.bucket}<br />角色：{row.role}<br />分數：{row.totalScore}/18｜財務 {row.objectiveScore}/10｜質化 {row.qualitativeScore}/8</div>
    <div style={{ marginTop: 8, color: "#94a3b8", fontWeight: 850, fontSize: 12, lineHeight: 1.55 }}>假設：{row.thesis}<br />風險：{row.risk}<br />規則：{row.rule}</div>
    <div style={{ marginTop: 8 }}><Pill tone="red">正式名單：否</Pill><Pill tone="gray">固定DCA：禁止</Pill><Pill tone="yellow">半自動：禁止</Pill></div>
    <CheckList title="財務 5 項" items={row.financial} />
    <CheckList title="質化 4 項" items={row.qualitative} />
  </article>;
}

export default function Market91Quality() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { fetch(`/api/v17/market-91-quality?t=${Date.now()}`, { cache: "no-store" }).then((r) => r.json()).then((x) => { if (!x.ok) throw new Error(x.error || "讀取失敗"); setData(x); }).catch((e) => setError(e.message || "讀取失敗")); }, []);
  const rows = data?.rows || [];
  const passed = rows.filter((x) => x.quality === "PASSED_DRAFT");
  const watch = rows.filter((x) => x.quality === "WATCH");
  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "linear-gradient(180deg,#020617 0%,#07111f 55%,#0f172a 100%)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "22px 14px 40px" }}>
      <a href="/market-91-shortlist" style={{ color: "#93c5fd", textDecoration: "none", fontWeight: 900 }}>← 返回 91檔二審池</a>
      <header style={{ marginTop: 18, marginBottom: 18 }}>
        <div style={{ color: "#22c55e", letterSpacing: 3, fontWeight: 1000, fontSize: 13 }}>MARKET 91 QUALITY DRAFT</div>
        <h1 style={{ fontSize: 36, lineHeight: 1.05, margin: "10px 0", fontWeight: 1000 }}>深審 Quality Gate 草稿</h1>
        <p style={{ color: "#cbd5e1", lineHeight: 1.55, fontWeight: 850, margin: 0 }}>只審 10 檔深審池。這是草稿，不是來源驗證版，也不會加入正式名單。</p>
      </header>
      {error && <Box title="讀取失敗" tone="red"><div style={{ color: "#fecaca" }}>{error}</div></Box>}
      {!data && !error && <Box title="讀取中"><div style={{ color: "#94a3b8" }}>讀取 Quality Gate 草稿中…</div></Box>}
      {data && <>
        <Box title="定位" tone="yellow"><div><Pill tone="red">Not Official List</Pill><Pill>Draft Only</Pill><Pill>Pending Verification</Pill></div><div style={{ marginTop: 8, color: "#cbd5e1", fontWeight: 850, lineHeight: 1.55 }}>這一頁只做 10 檔深審池的草稿 Quality Gate；通過草稿也不代表可買。</div></Box>
        <Box title="統計" tone="green"><div><Pill>總數 {rows.length}</Pill><Pill tone="green">草稿通過 {passed.length}</Pill><Pill tone="yellow">觀察 {watch.length}</Pill></div></Box>
        <Box title={`草稿通過（${passed.length}）`} tone="green">{passed.map((row) => <RowCard key={row.symbol} row={row} />)}</Box>
        <Box title={`觀察（${watch.length}）`} tone="yellow">{watch.map((row) => <RowCard key={row.symbol} row={row} />)}</Box>
        <Box title="入口"><a href="/market-91-shortlist" style={{ color: "#fde68a", fontWeight: 1000, textDecoration: "none" }}>91檔二審池</a><br /><a href="/v17-quality" style={{ color: "#bbf7d0", fontWeight: 1000, textDecoration: "none" }}>正式 Quality Audit Center</a><br /><a href="/v17" style={{ color: "#bfdbfe", fontWeight: 1000, textDecoration: "none" }}>折價獵人主頁</a></Box>
      </>}
    </div>
  </main>;
}
