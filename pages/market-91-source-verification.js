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
function toneFor(status) {
  if (String(status).includes("RISK")) return "red";
  if (String(status).includes("PARTIAL")) return "yellow";
  if (String(status).includes("VERIFIED")) return "green";
  return "yellow";
}
function RowCard({ row }) {
  const tone = toneFor(row.status);
  return <article style={{ marginTop: 10, padding: 12, borderRadius: 18, background: "rgba(2,6,23,.48)", border: `1px solid ${tone === "green" ? "rgba(34,197,94,.32)" : tone === "red" ? "rgba(248,113,113,.32)" : "rgba(245,158,11,.28)"}` }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}><strong style={{ color: "#f8fafc", fontSize: 20 }}>{row.symbol}</strong><Pill tone={tone}>{row.status}</Pill></div>
    <div style={{ marginTop: 6, color: "#cbd5e1", fontWeight: 850, fontSize: 13, lineHeight: 1.55 }}>{row.name}<br />初步結論：{row.stage1Decision || "PENDING"}<br />門檻：{row.decisionGate}</div>
    {row.stage1Summary && <div style={{ marginTop: 8, color: "#e2e8f0", fontWeight: 900, fontSize: 12, lineHeight: 1.6 }}>{row.stage1Summary}</div>}
    {row.evidence?.length > 0 && <details open style={{ marginTop: 10, color: "#cbd5e1", fontSize: 12, lineHeight: 1.6, fontWeight: 850 }}><summary style={{ color: "#bbf7d0", fontWeight: 1000 }}>第一輪證據</summary><ul>{row.evidence.map((x) => <li key={x}>{x}</li>)}</ul></details>}
    {row.riskFlags?.length > 0 && <div style={{ marginTop: 8 }}>{row.riskFlags.map((x) => <Pill key={x} tone="red">{x}</Pill>)}</div>}
    <details style={{ marginTop: 10, color: "#94a3b8", fontSize: 12, lineHeight: 1.6, fontWeight: 850 }}><summary style={{ color: "#bfdbfe", fontWeight: 1000 }}>待補檢查</summary><ul>{row.checks.map((x) => <li key={x}>{x}</li>)}</ul></details>
  </article>;
}
export default function Market91SourceVerification() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { fetch(`/api/v17/market-91-source-verification?t=${Date.now()}`, { cache: "no-store" }).then((r) => r.json()).then((x) => { if (!x.ok) throw new Error(x.error || "讀取失敗"); setData(x); }).catch((e) => setError(e.message || "讀取失敗")); }, []);
  const rows = data?.rows || [];
  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "linear-gradient(180deg,#020617 0%,#07111f 55%,#0f172a 100%)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "22px 14px 40px" }}>
      <a href="/market-91-observation" style={{ color: "#93c5fd", textDecoration: "none", fontWeight: 900 }}>← 返回正式觀察候選</a>
      <header style={{ marginTop: 18, marginBottom: 18 }}>
        <div style={{ color: "#f59e0b", letterSpacing: 3, fontWeight: 1000, fontSize: 13 }}>SOURCE VERIFICATION</div>
        <h1 style={{ fontSize: 36, lineHeight: 1.05, margin: "10px 0", fontWeight: 1000 }}>來源驗證清單</h1>
        <p style={{ color: "#cbd5e1", lineHeight: 1.55, fontWeight: 850, margin: 0 }}>5 檔正式觀察候選已加入第一輪證據。這仍不是買入名單。</p>
      </header>
      {error && <Box title="讀取失敗" tone="red"><div style={{ color: "#fecaca" }}>{error}</div></Box>}
      {!data && !error && <Box title="讀取中"><div style={{ color: "#94a3b8" }}>讀取來源驗證清單中…</div></Box>}
      {data && <>
        <Box title="安全邊界" tone="yellow"><div><Pill tone="red">No Buy</Pill><Pill>No DCA</Pill><Pill>No Semi-auto</Pill></div><div style={{ marginTop: 8, color: "#cbd5e1", fontWeight: 850, lineHeight: 1.55 }}>這只是驗證紀錄。沒有任何標的會因為列在這裡而進買點、Telegram 或半自動流程。</div></Box>
        <Box title="統計" tone="green"><Pill>總數 {rows.length}</Pill><Pill tone="green">第一輪驗證 {data.summary?.stage1Verified || 0}</Pill><Pill tone="yellow">部分驗證 {data.summary?.stage1Partial || 0}</Pill><Pill tone="red">風險旗標 {data.summary?.riskFlag || 0}</Pill></Box>
        <Box title="第一輪來源驗證" tone="yellow">{rows.map((row) => <RowCard key={row.symbol} row={row} />)}</Box>
        <Box title="入口"><a href="/market-91-observation" style={{ color: "#bbf7d0", fontWeight: 1000, textDecoration: "none" }}>正式觀察候選</a><br /><a href="/market-91-quality" style={{ color: "#fde68a", fontWeight: 1000, textDecoration: "none" }}>深審 Quality 草稿</a><br /><a href="/v17" style={{ color: "#bfdbfe", fontWeight: 1000, textDecoration: "none" }}>折價獵人主頁</a></Box>
      </>}
    </div>
  </main>;
}
