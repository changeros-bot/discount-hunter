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
function Card({ row }) {
  return <article style={{ marginTop: 12, padding: 12, borderRadius: 18, background: "rgba(2,6,23,.48)", border: "1px solid rgba(245,158,11,.28)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}><strong style={{ color: "#f8fafc", fontSize: 22 }}>{row.symbol}</strong><strong style={{ color: "#fde68a", fontSize: 18 }}>{row.currentDraftScore}/18</strong></div>
    <div style={{ marginTop: 6 }}><Pill tone="yellow">{row.status}</Pill><Pill tone="red">No Permission</Pill></div>
    <div style={{ marginTop: 8, color: "#cbd5e1", fontWeight: 850, fontSize: 13, lineHeight: 1.55 }}>{row.thesis}</div>
    <details style={{ marginTop: 10 }} open>
      <summary style={{ color: "#bfdbfe", fontWeight: 1000, fontSize: 13 }}>官方來源目標</summary>
      <List items={row.officialSourceTargets} />
    </details>
    <details style={{ marginTop: 10 }}>
      <summary style={{ color: "#fde68a", fontWeight: 1000, fontSize: 13 }}>證據檢查項目</summary>
      {(row.checklist || []).map((x, i) => <div key={i} style={{ marginTop: 10, padding: 10, borderRadius: 14, background: "rgba(15,23,42,.72)", border: "1px solid rgba(148,163,184,.18)" }}>
        <div style={{ color: "#f8fafc", fontWeight: 1000, fontSize: 13 }}>{i + 1}. {x.item}</div>
        <div style={{ marginTop: 6, color: "#cbd5e1", fontWeight: 850, fontSize: 12, lineHeight: 1.55 }}>證據：{x.evidenceRequired}</div>
        <div style={{ marginTop: 6, color: "#bbf7d0", fontWeight: 850, fontSize: 12, lineHeight: 1.55 }}>通過：{x.passCondition}</div>
        <div style={{ marginTop: 6, color: "#fecaca", fontWeight: 850, fontSize: 12, lineHeight: 1.55 }}>失敗：{x.failCondition}</div>
        <div style={{ marginTop: 6, color: "#fde68a", fontWeight: 1000, fontSize: 12, lineHeight: 1.55 }}>影響：{x.impact}</div>
      </div>)}
    </details>
    <div style={{ marginTop: 10, color: "#93c5fd", fontWeight: 1000, fontSize: 12 }}>下一步：{row.nextAction}</div>
  </article>;
}

export default function Market91EvidenceChecklistV1() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { fetch(`/api/v17/market-91-evidence-checklist-v1?t=${Date.now()}`, { cache: "no-store" }).then((r) => r.json()).then((x) => { if (!x.ok) throw new Error(x.error || "讀取失敗"); setData(x); }).catch((e) => setError(e.message || "讀取失敗")); }, []);
  const rows = data?.rows || [];
  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "linear-gradient(180deg,#020617 0%,#07111f 55%,#0f172a 100%)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "22px 14px 40px" }}>
      <a href="/market-91-quality-gate-drafts" style={{ color: "#93c5fd", textDecoration: "none", fontWeight: 900 }}>← 返回 18 分草稿</a>
      <header style={{ marginTop: 18, marginBottom: 18 }}>
        <div style={{ color: "#38bdf8", letterSpacing: 3, fontWeight: 1000, fontSize: 13 }}>OFFICIAL EVIDENCE CHECKLIST</div>
        <h1 style={{ fontSize: 34, lineHeight: 1.05, margin: "10px 0", fontWeight: 1000 }}>Evidence Checklist v1</h1>
        <p style={{ color: "#cbd5e1", lineHeight: 1.55, fontWeight: 850, margin: 0 }}>NVDA / AVGO / MSFT。把高分草稿轉成官方文件驗證清單。</p>
      </header>
      {error && <Box title="讀取失敗" tone="red"><div style={{ color: "#fecaca" }}>{error}</div></Box>}
      {!data && !error && <Box title="讀取中"><div style={{ color: "#94a3b8" }}>讀取 Evidence Checklist 中…</div></Box>}
      {data && <>
        <Box title="安全邊界" tone="red"><Pill tone="red">Created ≠ Verified</Pill><Pill>No Buy</Pill><Pill>No DCA</Pill><Pill>No Semi-auto</Pill><Pill>No Whitelist</Pill><div style={{ marginTop: 8, color: "#cbd5e1", fontWeight: 850, lineHeight: 1.55 }}>{data.purpose}</div></Box>
        <Box title="統計" tone="yellow"><Pill>總數 {data.summary?.total}</Pill><Pill tone="gray">已驗證 {data.summary?.verified}</Pill><Pill tone="yellow">未驗證 {data.summary?.unverified}</Pill><Pill tone="red">交易權限 {data.summary?.tradingPermission}</Pill></Box>
        <Box title="三檔清單">{rows.map((row) => <Card key={row.symbol} row={row} />)}</Box>
        <Box title="入口"><a href="/market-91-quality-gate-queue" style={{ color: "#bbf7d0", fontWeight: 1000, textDecoration: "none" }}>18 分 Quality Gate 候選佇列</a><br /><a href="/market-91-quality-gate-drafts" style={{ color: "#bbf7d0", fontWeight: 1000, textDecoration: "none" }}>18 分深審草稿</a><br /><a href="/market-91-governance" style={{ color: "#38bdf8", fontWeight: 1000, textDecoration: "none" }}>100分公平篩選規則</a><br /><a href="/v17" style={{ color: "#bfdbfe", fontWeight: 1000, textDecoration: "none" }}>折價獵人主頁</a></Box>
      </>}
    </div>
  </main>;
}
