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
function List({ items }) { return <ul style={{ marginTop: 8, paddingLeft: 20, color: "#cbd5e1", fontWeight: 850, fontSize: 12, lineHeight: 1.65 }}>{(items || []).map((x, i) => <li key={i}>{typeof x === "string" ? x : `${x.rule}: ${x.confirmedBy}`}</li>)}</ul>; }
function resultTone(result) { if ((result || "").includes("FAIL")) return "red"; if ((result || "").includes("WATCH")) return "yellow"; if ((result || "").includes("PENDING")) return "yellow"; return "green"; }

export default function PilotResultSummary() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { fetch(`/api/v17/market-91-pilot-result-summary?t=${Date.now()}`, { cache: "no-store" }).then((r) => r.json()).then((x) => { if (!x.ok) throw new Error(x.error || "讀取失敗"); setData(x); }).catch((e) => setError(e.message || "讀取失敗")); }, []);
  const subjects = data?.subjects || [];
  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "linear-gradient(180deg,#020617 0%,#07111f 55%,#0f172a 100%)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "22px 14px 40px" }}>
      <a href="/market-91-final-pipeline" style={{ color: "#93c5fd", textDecoration: "none", fontWeight: 900 }}>← 返回 Final Pipeline</a>
      <header style={{ marginTop: 18, marginBottom: 18 }}>
        <div style={{ color: "#38bdf8", letterSpacing: 3, fontWeight: 1000, fontSize: 13 }}>PILOT RESULT SUMMARY</div>
        <h1 style={{ fontSize: 34, lineHeight: 1.05, margin: "10px 0", fontWeight: 1000 }}>Evidence Pilot Result</h1>
        <p style={{ color: "#cbd5e1", lineHeight: 1.55, fontWeight: 850, margin: 0 }}>先證明流程有用，再決定要不要擴大。</p>
      </header>
      {error && <Box title="讀取失敗" tone="red"><div style={{ color: "#fecaca" }}>{error}</div></Box>}
      {!data && !error && <Box title="讀取中"><div style={{ color: "#94a3b8" }}>讀取 Pilot Summary 中…</div></Box>}
      {data && <>
        <Box title="總結" tone="green"><Pill tone="green">Pilot Passed As Process Test</Pill><Pill tone="red">No Permission</Pill><div style={{ marginTop: 8, color: "#bbf7d0", fontWeight: 1000, lineHeight: 1.55 }}>{data.finalConclusion}</div></Box>
        <Box title="禁止擴張" tone="red"><div style={{ color: "#fecaca", fontWeight: 1000, lineHeight: 1.55 }}>{data.noExpansionRule}</div><div style={{ marginTop: 8, color: "#f8fafc", fontWeight: 1000 }}>Recommended：{data.recommendedNextStep}</div></Box>
        <Box title="三檔試跑">{subjects.map((s) => <div key={s.symbol} style={{ marginTop: 10, padding: 10, borderRadius: 14, background: "rgba(2,6,23,.45)", border: "1px solid rgba(148,163,184,.18)" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><strong style={{ color: "#f8fafc", fontSize: 18 }}>{s.symbol}</strong><Pill tone={resultTone(s.result)}>{s.result}</Pill></div><div style={{ marginTop: 6 }}><Pill tone="gray">{s.role}</Pill>{s.provisionalScore != null && <Pill tone="blue">Score {s.provisionalScore}</Pill>}</div><div style={{ marginTop: 8, color: "#cbd5e1", fontWeight: 850, fontSize: 13, lineHeight: 1.55 }}>{s.processFinding}</div><div style={{ marginTop: 8, color: "#fde68a", fontWeight: 1000, fontSize: 12, lineHeight: 1.55 }}>Next：{s.nextAction}</div></div>)}</Box>
        <Box title="流程教訓" tone="yellow"><List items={data.pipelineLessons} /></Box>
        <Box title="已確認規則" tone="green"><List items={data.decisionRulesConfirmed} /></Box>
        <Box title="目前權限" tone="red"><Pill tone="red">Buy {data.currentPermissions?.buy}</Pill><Pill>DCA {data.currentPermissions?.dca}</Pill><Pill>Dip-buy {data.currentPermissions?.dipBuy}</Pill><Pill>Semi-auto {data.currentPermissions?.semiAuto}</Pill><Pill>Whitelist {data.currentPermissions?.whitelist}</Pill></Box>
        <Box title="入口"><a href="/market-91-nvda-avgo-verification-v1" style={{ color: "#fecaca", fontWeight: 1000, textDecoration: "none" }}>NVDA / AVGO Verification v1</a><br /><a href="/market-91-orcl-verification-v1" style={{ color: "#fecaca", fontWeight: 1000, textDecoration: "none" }}>ORCL Verification v1</a><br /><a href="/market-91-final-pipeline" style={{ color: "#fecaca", fontWeight: 1000, textDecoration: "none" }}>Final Pipeline</a><br /><a href="/market-91-evidence-checklist-v1" style={{ color: "#bbf7d0", fontWeight: 1000, textDecoration: "none" }}>Evidence Checklist v1</a><br /><a href="/market-91-governance" style={{ color: "#38bdf8", fontWeight: 1000, textDecoration: "none" }}>100分公平篩選規則</a><br /><a href="/v17" style={{ color: "#bfdbfe", fontWeight: 1000, textDecoration: "none" }}>折價獵人主頁</a></Box>
      </>}
    </div>
  </main>;
}
