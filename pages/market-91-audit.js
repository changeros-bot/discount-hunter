import { useEffect, useState } from "react";
import { getMarket91AuditTrail } from "../lib/v17-market-91-audit-trail";

function Box({ title, children, tone = "blue" }) {
  const border = tone === "green" ? "rgba(34,197,94,.38)" : tone === "red" ? "rgba(248,113,113,.36)" : tone === "yellow" ? "rgba(245,158,11,.34)" : "rgba(59,130,246,.30)";
  return <section style={{ marginTop: 14, border: `1px solid ${border}`, background: "rgba(15,23,42,.78)", borderRadius: 22, padding: 16 }}>
    <h2 style={{ margin: "0 0 10px", color: "#f8fafc", fontSize: 18, fontWeight: 1000 }}>{title}</h2>
    {children}
  </section>;
}

function toneForCategory(category) {
  if (/待補|尚未排到/.test(category || "")) return "#fde68a";
  if (/分數|風險/.test(category || "")) return "#fecaca";
  return "#bfdbfe";
}

function Row({ row }) {
  return <div style={{ marginTop: 9, padding: 11, borderRadius: 15, background: "rgba(2,6,23,.48)", border: "1px solid rgba(148,163,184,.14)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
      <strong style={{ color: "#f8fafc", fontSize: 15 }}>{row.symbol}</strong>
      <span style={{ color: toneForCategory(row.auditCategory), fontSize: 11, fontWeight: 1000, textAlign: "right" }}>{row.auditCategory}</span>
    </div>
    <div style={{ marginTop: 5, color: "#94a3b8", fontSize: 11, fontWeight: 850 }}>{row.tier}｜{row.sourceFile || "source pending"}｜score {row.score ?? "—"}</div>
    <div style={{ marginTop: 6, color: "#cbd5e1", lineHeight: 1.5, fontSize: 12, fontWeight: 850 }}>{row.auditReason}</div>
    <details style={{ marginTop: 7 }}>
      <summary style={{ color: "#93c5fd", fontSize: 12, fontWeight: 1000 }}>原始理由 / 風險</summary>
      <div style={{ marginTop: 6, color: "#cbd5e1", fontSize: 12, lineHeight: 1.5 }}>理由：{row.reason}<br />風險：{row.risk}</div>
    </details>
  </div>;
}

export default function Market91AuditPage({ initialData }) {
  const [data, setData] = useState(initialData);
  useEffect(() => {
    fetch(`/api/v17/market-91-audit?t=${Date.now()}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => { if (json?.ok) setData(json); })
      .catch(() => {});
  }, []);

  const rows = data?.rows || [];
  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "linear-gradient(180deg,#020617 0%,#07111f 55%,#0f172a 100%)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "22px 14px 40px" }}>
      <a href="/market-45-review" style={{ color: "#93c5fd", textDecoration: "none", fontWeight: 900 }}>← 返回 Market45</a>
      <header style={{ marginTop: 18, marginBottom: 18 }}>
        <div style={{ color: "#22c55e", letterSpacing: 3, fontWeight: 1000, fontSize: 13 }}>Market91 Audit Trail</div>
        <h1 style={{ fontSize: 34, lineHeight: 1.05, margin: "10px 0", fontWeight: 1000 }}>91 → 45 淘汰紀錄</h1>
        <p style={{ color: "#cbd5e1", lineHeight: 1.55, fontWeight: 850, margin: 0 }}>這頁專門處理沒有進入 Market45 的 46 檔，避免黑箱。</p>
      </header>

      <Box title="收斂驗證" tone={data?.closedLoop ? "green" : "yellow"}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, color: "#cbd5e1", fontWeight: 850, lineHeight: 1.6 }}>
          <div>原始目標：{data?.totalOriginalTarget}</div>
          <div>Market45：{data?.market45Count}</div>
          <div>Audit 目標：{data?.auditTarget}</div>
          <div>已覆蓋：{data?.auditCovered}</div>
          <div>待回填：{data?.unresolvedCount}</div>
          <div>閉環：{data?.closedLoop ? "是" : "否"}</div>
        </div>
        <div style={{ marginTop: 9, color: data?.closedLoop ? "#bbf7d0" : "#fde68a", fontWeight: 1000 }}>
          {data?.closedLoop ? "91 檔已形成完整 audit trail。" : "尚未完全閉環：仍有原始91檔來源需要回填。"}
        </div>
      </Box>

      <Box title="三類淘汰原因">
        {Object.entries(data?.categories || {}).map(([key, value]) => <div key={key} style={{ display: "flex", justifyContent: "space-between", color: toneForCategory(key), fontWeight: 1000, borderBottom: "1px solid rgba(148,163,184,.12)", padding: "7px 0" }}><span>{key}</span><span>{value}</span></div>)}
      </Box>

      <Box title={`46 檔紀錄（${rows.length}）`} tone="blue">
        {rows.map((row) => <Row key={row.symbol} row={row} />)}
      </Box>
    </div>
  </main>;
}

export async function getServerSideProps() {
  const data = getMarket91AuditTrail();
  return { props: { initialData: JSON.parse(JSON.stringify(data)) } };
}
