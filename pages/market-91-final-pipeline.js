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

export default function Market91FinalPipeline() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { fetch(`/api/v17/market-91-final-pipeline?t=${Date.now()}`, { cache: "no-store" }).then((r) => r.json()).then((x) => { if (!x.ok) throw new Error(x.error || "讀取失敗"); setData(x); }).catch((e) => setError(e.message || "讀取失敗")); }, []);
  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "linear-gradient(180deg,#020617 0%,#07111f 55%,#0f172a 100%)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "22px 14px 40px" }}>
      <a href="/market-91-governance" style={{ color: "#93c5fd", textDecoration: "none", fontWeight: 900 }}>← 返回 100分規則</a>
      <header style={{ marginTop: 18, marginBottom: 18 }}>
        <div style={{ color: "#38bdf8", letterSpacing: 3, fontWeight: 1000, fontSize: 13 }}>FINAL PIPELINE</div>
        <h1 style={{ fontSize: 34, lineHeight: 1.05, margin: "10px 0", fontWeight: 1000 }}>Market 91 Final Pipeline</h1>
        <p style={{ color: "#cbd5e1", lineHeight: 1.55, fontWeight: 850, margin: 0 }}>把流程封頂，防止規則自我繁殖。</p>
      </header>
      {error && <Box title="讀取失敗" tone="red"><div style={{ color: "#fecaca" }}>{error}</div></Box>}
      {!data && !error && <Box title="讀取中"><div style={{ color: "#94a3b8" }}>讀取 Final Pipeline 中…</div></Box>}
      {data && <>
        <Box title="頁首原則" tone="red"><Pill tone="red">Eligibility ≠ Buy</Pill><Pill>No Sixth Layer</Pill><Pill>Permission ≠ Order</Pill><div style={{ marginTop: 8, color: "#fecaca", fontWeight: 1000, lineHeight: 1.55 }}>{data.headlineRule}</div></Box>
        <Box title="流程封頂" tone="yellow"><div style={{ color: "#fde68a", fontWeight: 1000, lineHeight: 1.55 }}>{data.processCap}</div><div style={{ marginTop: 8, color: "#cbd5e1", fontWeight: 850 }}>{data.principle}</div></Box>
        <Box title="五層流程">{(data.steps || []).map((s) => <div key={s.step} style={{ marginTop: 10, padding: 10, borderRadius: 14, background: "rgba(2,6,23,.45)", border: "1px solid rgba(148,163,184,.18)" }}><div style={{ color: "#f8fafc", fontWeight: 1000 }}>{s.step}. {s.name}</div><div style={{ marginTop: 6, color: "#cbd5e1", fontWeight: 850, fontSize: 13, lineHeight: 1.55 }}>{s.purpose}</div><div style={{ marginTop: 6 }}>{(s.output || []).map((x) => <Pill key={x} tone="gray">{x}</Pill>)}</div><div style={{ marginTop: 6, color: "#fecaca", fontWeight: 900, fontSize: 12, lineHeight: 1.55 }}>Stop：{s.stopRule}</div></div>)}</Box>
        <Box title="反膨脹規則" tone="red"><List items={data.antiBloatRules} /></Box>
        <Box title="試跑設計" tone="green"><Pill>NVDA</Pill><Pill>AVGO</Pill><Pill tone="red">ORCL blocker test</Pill><div style={{ marginTop: 8, color: "#cbd5e1", fontWeight: 850, lineHeight: 1.55 }}>{data.pilot?.reason}</div><List items={data.pilot?.successCriteria} /></Box>
        <Box title="Permission 邊界" tone="yellow"><div style={{ color: "#bbf7d0", fontWeight: 1000, lineHeight: 1.55 }}>Permission Review 問：{data.permissionBoundary?.permissionReviewQuestion}</div><div style={{ marginTop: 8, color: "#fecaca", fontWeight: 1000, lineHeight: 1.55 }}>Actual Buy 問：{data.permissionBoundary?.actualBuyQuestion}</div><div style={{ marginTop: 8, color: "#f8fafc", fontWeight: 1000, lineHeight: 1.55 }}>{data.permissionBoundary?.boundary}</div></Box>
        <Box title="入口"><a href="/market-91-evidence-checklist-v1" style={{ color: "#fecaca", fontWeight: 1000, textDecoration: "none" }}>Evidence Checklist v1</a><br /><a href="/market-91-quality-gate-queue" style={{ color: "#bbf7d0", fontWeight: 1000, textDecoration: "none" }}>18 分 Quality Gate 候選佇列</a><br /><a href="/market-91-quality-gate-drafts" style={{ color: "#bbf7d0", fontWeight: 1000, textDecoration: "none" }}>18 分深審草稿</a><br /><a href="/market-91-governance" style={{ color: "#38bdf8", fontWeight: 1000, textDecoration: "none" }}>100分公平篩選規則</a><br /><a href="/v17" style={{ color: "#bfdbfe", fontWeight: 1000, textDecoration: "none" }}>折價獵人主頁</a></Box>
      </>}
    </div>
  </main>;
}
