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
function Candidate({ row }) {
  return <article style={{ marginTop: 10, padding: 12, borderRadius: 18, background: "rgba(2,6,23,.48)", border: "1px solid rgba(34,197,94,.32)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}><strong style={{ color: "#f8fafc", fontSize: 22 }}>{row.symbol}</strong><strong style={{ color: "#f8fafc", fontSize: 22 }}>{row.fairScore}</strong></div>
    <div style={{ marginTop: 6 }}><Pill tone="green">Quality Gate Queue</Pill><Pill tone="gray">{row.sourceBatch}</Pill><Pill tone="yellow">{row.qualityGateStatus}</Pill></div>
    <div style={{ marginTop: 8, color: "#fecaca", fontWeight: 1000, fontSize: 13, lineHeight: 1.55 }}>主風險：{row.mainRisk}</div>
    <div style={{ marginTop: 8, color: "#cbd5e1", fontWeight: 850, fontSize: 13, lineHeight: 1.55 }}>初步偏向：{row.preliminaryGateBias}</div>
    <details style={{ marginTop: 10, color: "#94a3b8", fontWeight: 850, fontSize: 12 }}><summary style={{ color: "#bbf7d0", fontWeight: 1000 }}>需要補的官方證據</summary><List items={row.nextRequiredEvidence} /></details>
  </article>;
}
function Excluded({ rows }) {
  return <details style={{ marginTop: 12, color: "#94a3b8", fontWeight: 850, fontSize: 12 }}><summary style={{ color: "#fde68a", fontWeight: 1000 }}>被排除名單（{rows?.length || 0}）</summary><div style={{ display: "grid", gap: 8, marginTop: 10 }}>{(rows || []).map((row) => <div key={`${row.sourceBatch}-${row.symbol}`} style={{ padding: 10, borderRadius: 14, background: "rgba(2,6,23,.45)", border: "1px solid rgba(148,163,184,.18)" }}><strong style={{ color: "#f8fafc" }}>{row.symbol}</strong>｜{row.fairScore}<br /><span style={{ color: "#fecaca" }}>{row.reason}</span></div>)}</div></details>;
}

export default function Market91QualityGateQueue() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { fetch(`/api/v17/market-91-quality-gate-queue?t=${Date.now()}`, { cache: "no-store" }).then((r) => r.json()).then((x) => { if (!x.ok) throw new Error(x.error || "讀取失敗"); setData(x); }).catch((e) => setError(e.message || "讀取失敗")); }, []);
  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "linear-gradient(180deg,#020617 0%,#07111f 55%,#0f172a 100%)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "22px 14px 40px" }}>
      <a href="/market-91-fair-score-report" style={{ color: "#93c5fd", textDecoration: "none", fontWeight: 900 }}>← 返回總報告</a>
      <header style={{ marginTop: 18, marginBottom: 18 }}>
        <div style={{ color: "#22c55e", letterSpacing: 3, fontWeight: 1000, fontSize: 13 }}>18-POINT QUALITY GATE QUEUE</div>
        <h1 style={{ fontSize: 36, lineHeight: 1.05, margin: "10px 0", fontWeight: 1000 }}>Quality Gate 候選佇列</h1>
        <p style={{ color: "#cbd5e1", lineHeight: 1.55, fontWeight: 850, margin: 0 }}>只有 100 分制正式觀察候選可以進入 18 分深審。這頁不授權交易。</p>
      </header>
      {error && <Box title="讀取失敗" tone="red"><div style={{ color: "#fecaca" }}>{error}</div></Box>}
      {!data && !error && <Box title="讀取中"><div style={{ color: "#94a3b8" }}>讀取 Quality Gate 佇列中…</div></Box>}
      {data && <>
        <Box title="安全邊界" tone="yellow"><Pill tone="red">Queue Only</Pill><Pill>No Buy</Pill><Pill>No DCA</Pill><Pill>No Semi-auto</Pill><Pill>No Whitelist</Pill><div style={{ marginTop: 8, color: "#cbd5e1", fontWeight: 850, lineHeight: 1.55 }}>佇列只是深審順序；完全驗證 18/18 前，不給任何交易權限。</div></Box>
        <Box title="下一步深審" tone="green"><a href="/market-91-quality-gate-drafts" style={{ color: "#bbf7d0", fontWeight: 1000, textDecoration: "none" }}>查看 META / NOW 18 分深審草稿 →</a><div style={{ marginTop: 8, color: "#cbd5e1", fontWeight: 850, lineHeight: 1.55 }}>草稿通過不等於交易權限；只是確認可以繼續官方文件驗證。</div></Box>
        <Box title="統計" tone="green"><Pill>進入深審 {data.summary?.eligible}</Pill><Pill tone="red">排除 {data.summary?.excluded}</Pill><Pill tone="yellow">順序 {(data.summary?.nextReviewOrder || []).join(" → ")}</Pill></Box>
        <Box title="進入 18 分 Quality Gate">{(data.eligible || []).map((row) => <Candidate key={row.symbol} row={row} />)}</Box>
        <Box title="18 分規則"><Pill>Objective 10</Pill><Pill>Qualitative 8</Pill><Pill tone="yellow">Pass {data.rules?.passThreshold}</Pill><Pill tone="green">Strong {data.rules?.strongThreshold}</Pill><Pill tone="red">Trading Review {data.rules?.tradingThreshold}</Pill><List items={data.rules?.permissionPolicy} /></Box>
        <Box title="越級阻擋"><Excluded rows={data.excluded} /></Box>
        <Box title="入口"><a href="/market-91-quality-gate-drafts" style={{ color: "#bbf7d0", fontWeight: 1000, textDecoration: "none" }}>18 分深審草稿</a><br /><a href="/market-91-fair-score-report" style={{ color: "#bbf7d0", fontWeight: 1000, textDecoration: "none" }}>100分公平篩選總報告</a><br /><a href="/market-91-governance" style={{ color: "#38bdf8", fontWeight: 1000, textDecoration: "none" }}>100分公平篩選規則</a><br /><a href="/v17" style={{ color: "#bfdbfe", fontWeight: 1000, textDecoration: "none" }}>折價獵人主頁</a></Box>
      </>}
    </div>
  </main>;
}
