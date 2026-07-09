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
function List({ items }) {
  return <ul style={{ marginTop: 8, paddingLeft: 20, color: "#cbd5e1", fontWeight: 850, fontSize: 13, lineHeight: 1.65 }}>{(items || []).map((x, i) => <li key={i}>{x}</li>)}</ul>;
}
function Evidence({ rows }) {
  return <div style={{ display: "grid", gap: 8, marginTop: 10 }}>{(rows || []).map((row) => <div key={row.item} style={{ padding: 10, borderRadius: 14, background: "rgba(2,6,23,.45)", border: "1px solid rgba(148,163,184,.18)" }}><div style={{ color: row.impact === "+" ? "#bbf7d0" : "#fecaca", fontWeight: 1000 }}>{row.item}：{row.value}</div><div style={{ marginTop: 4, color: "#94a3b8", fontWeight: 850, fontSize: 12, lineHeight: 1.55 }}>{row.note}</div></div>)}</div>;
}

export default function Market91HubbVerification() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { fetch(`/api/v17/market-91-hubb-verification?t=${Date.now()}`, { cache: "no-store" }).then((r) => r.json()).then((x) => { if (!x.ok) throw new Error(x.error || "讀取失敗"); setData(x); }).catch((e) => setError(e.message || "讀取失敗")); }, []);
  const v = data?.verification;
  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "linear-gradient(180deg,#020617 0%,#07111f 55%,#0f172a 100%)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "22px 14px 40px" }}>
      <a href="/market-91-first-batch" style={{ color: "#93c5fd", textDecoration: "none", fontWeight: 900 }}>← 返回第一批</a>
      <header style={{ marginTop: 18, marginBottom: 18 }}>
        <div style={{ color: "#f59e0b", letterSpacing: 3, fontWeight: 1000, fontSize: 13 }}>HUBB OFFICIAL VERIFICATION</div>
        <h1 style={{ fontSize: 36, lineHeight: 1.05, margin: "10px 0", fontWeight: 1000 }}>HUBB 官方季報驗證</h1>
        <p style={{ color: "#cbd5e1", lineHeight: 1.55, fontWeight: 850, margin: 0 }}>Q1 很強，但 NSI 併購與債務融資讓 79 分不能自動升 80。</p>
      </header>
      {error && <Box title="讀取失敗" tone="red"><div style={{ color: "#fecaca" }}>{error}</div></Box>}
      {!data && !error && <Box title="讀取中"><div style={{ color: "#94a3b8" }}>讀取 HUBB 官方驗證中…</div></Box>}
      {data && <>
        <Box title="結論" tone="yellow"><div><Pill tone="yellow">{v?.status}</Pill><Pill tone="gray">{v?.confidence}</Pill></div><div style={{ marginTop: 10, color: "#f8fafc", fontWeight: 1000, fontSize: 24 }}>HUBB：{v?.previousScore} → {v?.verifiedScore}</div><div style={{ marginTop: 8, color: "#fecaca", fontWeight: 1000, lineHeight: 1.55 }}>阻擋：{v?.blocker}</div><div style={{ marginTop: 8, color: "#cbd5e1", fontWeight: 850, lineHeight: 1.55 }}>{v?.decision}</div></Box>
        <Box title="官方證據"><Evidence rows={v?.officialEvidence} /></Box>
        <Box title="為什麼維持高分" tone="green"><List items={v?.scoreRationale?.keepHigh} /></Box>
        <Box title="為什麼不升80" tone="red"><List items={v?.scoreRationale?.doNotUpgrade} /></Box>
        <Box title="下一步驗證"><List items={v?.nextVerification} /></Box>
        <Box title="安全邊界" tone="yellow"><Pill tone="red">No Buy</Pill><Pill>No DCA</Pill><Pill>No Semi-auto</Pill><Pill>No Whitelist</Pill></Box>
        <Box title="入口"><a href="/market-91-first-batch" style={{ color: "#bbf7d0", fontWeight: 1000, textDecoration: "none" }}>第一批公平篩選結果</a><br /><a href="/market-91-governance" style={{ color: "#38bdf8", fontWeight: 1000, textDecoration: "none" }}>100分公平篩選規則</a><br /><a href="/v17" style={{ color: "#bfdbfe", fontWeight: 1000, textDecoration: "none" }}>折價獵人主頁</a></Box>
      </>}
    </div>
  </main>;
}
