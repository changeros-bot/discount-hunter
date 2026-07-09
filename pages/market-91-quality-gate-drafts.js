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
function List({ items }) { return <ul style={{ marginTop: 8, paddingLeft: 20, color: "#cbd5e1", fontWeight: 850, fontSize: 12, lineHeight: 1.65 }}>{(items || []).map((x, i) => <li key={i}>{x}</li>)}</ul>; }
function CheckList({ title, items }) {
  return <details style={{ marginTop: 10, color: "#94a3b8", fontWeight: 850, fontSize: 12 }}><summary style={{ color: "#bfdbfe", fontWeight: 1000 }}>{title}</summary><div style={{ display: "grid", gap: 8, marginTop: 10 }}>{(items || []).map((x) => <div key={x.name} style={{ padding: 10, borderRadius: 14, background: "rgba(2,6,23,.45)", border: "1px solid rgba(148,163,184,.18)" }}><strong style={{ color: x.status === "通過" ? "#bbf7d0" : "#fde68a" }}>{x.name}：{x.score}/{x.max}｜{x.status}</strong><div style={{ marginTop: 4, color: "#94a3b8", lineHeight: 1.55 }}>{x.reason}</div></div>)}</div></details>;
}
function Card({ row }) {
  const strong = row.totalScore >= 16;
  return <article style={{ marginTop: 10, padding: 12, borderRadius: 18, background: "rgba(2,6,23,.48)", border: `1px solid ${strong ? "rgba(34,197,94,.32)" : "rgba(245,158,11,.28)"}` }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}><strong style={{ color: "#f8fafc", fontSize: 22 }}>{row.symbol}</strong><strong style={{ color: "#f8fafc", fontSize: 22 }}>{row.totalScore}/{row.maxScore}</strong></div>
    <div style={{ marginTop: 6 }}><Pill tone="yellow">{row.status}</Pill><Pill tone="gray">{row.confidence}</Pill></div>
    <div style={{ marginTop: 8, color: "#cbd5e1", fontWeight: 850, fontSize: 13, lineHeight: 1.55 }}>Objective：{row.objectiveScore}/10｜Qualitative：{row.qualitativeScore}/8<br />結論：{row.verdict}</div>
    <CheckList title="Objective 10" items={row.objectiveChecks} />
    <CheckList title="Qualitative 8" items={row.qualitativeChecks} />
    <details style={{ marginTop: 10, color: "#94a3b8", fontWeight: 850, fontSize: 12 }}><summary style={{ color: "#fecaca", fontWeight: 1000 }}>硬性阻擋 / 必補證據</summary><div style={{ marginTop: 8, color: "#fecaca", fontWeight: 900 }}>Hard Blockers</div><List items={row.hardBlockers} /><div style={{ marginTop: 8, color: "#bbf7d0", fontWeight: 900 }}>Next Evidence</div><List items={row.nextEvidence} /></details>
  </article>;
}

export default function Market91QualityGateDrafts() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { fetch(`/api/v17/market-91-quality-gate-drafts?t=${Date.now()}`, { cache: "no-store" }).then((r) => r.json()).then((x) => { if (!x.ok) throw new Error(x.error || "讀取失敗"); setData(x); }).catch((e) => setError(e.message || "讀取失敗")); }, []);
  const rows = data?.rows || [];
  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "linear-gradient(180deg,#020617 0%,#07111f 55%,#0f172a 100%)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "22px 14px 40px" }}>
      <a href="/market-91-quality-gate-queue" style={{ color: "#93c5fd", textDecoration: "none", fontWeight: 900 }}>← 返回 Quality Gate 佇列</a>
      <header style={{ marginTop: 18, marginBottom: 18 }}>
        <div style={{ color: "#22c55e", letterSpacing: 3, fontWeight: 1000, fontSize: 13 }}>QUALITY GATE DRAFT REVIEW</div>
        <h1 style={{ fontSize: 36, lineHeight: 1.05, margin: "10px 0", fontWeight: 1000 }}>18 分深審草稿</h1>
        <p style={{ color: "#cbd5e1", lineHeight: 1.55, fontWeight: 850, margin: 0 }}>META / NOW 第一輪深審。這不是交易權限。</p>
      </header>
      {error && <Box title="讀取失敗" tone="red"><div style={{ color: "#fecaca" }}>{error}</div></Box>}
      {!data && !error && <Box title="讀取中"><div style={{ color: "#94a3b8" }}>讀取 18 分草稿中…</div></Box>}
      {data && <>
        <Box title="安全邊界" tone="yellow"><Pill tone="red">No Buy</Pill><Pill>No DCA</Pill><Pill>No Semi-auto</Pill><Pill>No Whitelist</Pill><div style={{ marginTop: 8, color: "#cbd5e1", fontWeight: 850, lineHeight: 1.55 }}>Draft pass 只代表可以繼續官方驗證；18/18 前不進交易權限審查。</div></Box>
        <Box title="統計" tone="green"><Pill>總數 {data.summary?.total}</Pill><Pill tone="yellow">Draft Pass {data.summary?.draftPass}</Pill><Pill tone="green">Strong {data.summary?.strongDraft}</Pill><Pill tone="red">Trading Permission {data.summary?.tradingPermission}</Pill></Box>
        <Box title="META / NOW 草稿結果">{rows.map((row) => <Card key={row.symbol} row={row} />)}</Box>
        <Box title="入口"><a href="/market-91-quality-gate-queue" style={{ color: "#bbf7d0", fontWeight: 1000, textDecoration: "none" }}>18 分 Quality Gate 候選佇列</a><br /><a href="/market-91-fair-score-report" style={{ color: "#bbf7d0", fontWeight: 1000, textDecoration: "none" }}>100分公平篩選總報告</a><br /><a href="/v17" style={{ color: "#bfdbfe", fontWeight: 1000, textDecoration: "none" }}>折價獵人主頁</a></Box>
      </>}
    </div>
  </main>;
}
