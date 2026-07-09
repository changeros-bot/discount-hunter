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
function toneForResult(result) { if ((result || "").includes("FAIL")) return "red"; if ((result || "").includes("WATCH")) return "yellow"; if ((result || "").includes("PASS")) return "green"; return "gray"; }
function List({ items }) { return <ul style={{ marginTop: 8, paddingLeft: 20, color: "#cbd5e1", fontWeight: 850, fontSize: 12, lineHeight: 1.65 }}>{(items || []).map((x, i) => <li key={i}>{x}</li>)}</ul>; }

export default function NvdaAvgoVerificationV1() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { fetch(`/api/v17/market-91-nvda-avgo-verification-v1?t=${Date.now()}`, { cache: "no-store" }).then((r) => r.json()).then((x) => { if (!x.ok) throw new Error(x.error || "讀取失敗"); setData(x); }).catch((e) => setError(e.message || "讀取失敗")); }, []);
  const subjects = data?.subjects || [];
  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "linear-gradient(180deg,#020617 0%,#07111f 55%,#0f172a 100%)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "22px 14px 40px" }}>
      <a href="/market-91-pilot-result-summary" style={{ color: "#93c5fd", textDecoration: "none", fontWeight: 900 }}>← 返回 Pilot Summary</a>
      <header style={{ marginTop: 18, marginBottom: 18 }}>
        <div style={{ color: "#38bdf8", letterSpacing: 3, fontWeight: 1000, fontSize: 13 }}>NVDA / AVGO EVIDENCE</div>
        <h1 style={{ fontSize: 34, lineHeight: 1.05, margin: "10px 0", fontWeight: 1000 }}>Verification v1</h1>
        <p style={{ color: "#cbd5e1", lineHeight: 1.55, fontWeight: 850, margin: 0 }}>暫行證據標記，不是完整官方 filing extraction。</p>
      </header>
      {error && <Box title="讀取失敗" tone="red"><div style={{ color: "#fecaca" }}>{error}</div></Box>}
      {!data && !error && <Box title="讀取中"><div style={{ color: "#94a3b8" }}>讀取 NVDA / AVGO Verification 中…</div></Box>}
      {data && <>
        <Box title="安全邊界" tone="red"><Pill tone="red">No Permission</Pill><Pill>Provisional Only</Pill><Pill>No Auto Buy</Pill><List items={data.evidenceLimits} /></Box>
        <Box title="兩檔結果">{subjects.map((s) => <div key={s.symbol} style={{ marginTop: 10, padding: 10, borderRadius: 14, background: "rgba(2,6,23,.45)", border: "1px solid rgba(148,163,184,.18)" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><strong style={{ color: "#f8fafc", fontSize: 20 }}>{s.symbol}</strong><Pill tone={(s.finalScoreLockStatus || "").includes("DOWNGRADE") ? "yellow" : "green"}>{s.provisionalScoreLock}/18</Pill></div><div style={{ marginTop: 6 }}><Pill tone="gray">Draft {s.currentDraftScore}</Pill><Pill tone="red">No Permission</Pill></div><div style={{ marginTop: 8, color: "#cbd5e1", fontWeight: 850, fontSize: 13, lineHeight: 1.55 }}>{s.verdict}</div>{(s.checklistResults || []).map((x, i) => <div key={i} style={{ marginTop: 8, padding: 8, borderRadius: 12, background: "rgba(15,23,42,.72)", border: "1px solid rgba(148,163,184,.14)" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><strong style={{ color: "#f8fafc", fontSize: 12 }}>{x.item}</strong><Pill tone={toneForResult(x.result)}>{x.result}</Pill></div><div style={{ marginTop: 5, color: "#cbd5e1", fontWeight: 850, fontSize: 12, lineHeight: 1.5 }}>{x.evidenceSignal}</div><div style={{ marginTop: 5, color: "#fde68a", fontWeight: 1000, fontSize: 12 }}>Action：{x.action}</div></div>)}<div style={{ marginTop: 8, color: "#93c5fd", fontWeight: 1000, fontSize: 12, lineHeight: 1.55 }}>Next：{s.nextAction}</div></div>)}</Box>
        <Box title="合併決策" tone="yellow"><div style={{ color: "#bbf7d0", fontWeight: 1000, lineHeight: 1.55 }}>{data.combinedDecision?.nvda}</div><div style={{ marginTop: 6, color: "#fde68a", fontWeight: 1000, lineHeight: 1.55 }}>{data.combinedDecision?.avgo}</div><div style={{ marginTop: 6, color: "#fecaca", fontWeight: 1000, lineHeight: 1.55 }}>{data.combinedDecision?.orclComparison}</div><div style={{ marginTop: 8, color: "#f8fafc", fontWeight: 1000 }}>Expand workflow：{String(data.combinedDecision?.expandWorkflow)}</div></Box>
        <Box title="入口"><a href="/market-91-pilot-result-summary" style={{ color: "#fecaca", fontWeight: 1000, textDecoration: "none" }}>Pilot Result Summary</a><br /><a href="/market-91-orcl-verification-v1" style={{ color: "#fecaca", fontWeight: 1000, textDecoration: "none" }}>ORCL Verification v1</a><br /><a href="/market-91-final-pipeline" style={{ color: "#fecaca", fontWeight: 1000, textDecoration: "none" }}>Final Pipeline</a><br /><a href="/market-91-governance" style={{ color: "#38bdf8", fontWeight: 1000, textDecoration: "none" }}>100分公平篩選規則</a><br /><a href="/v17" style={{ color: "#bfdbfe", fontWeight: 1000, textDecoration: "none" }}>折價獵人主頁</a></Box>
      </>}
    </div>
  </main>;
}
