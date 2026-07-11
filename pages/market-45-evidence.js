import { useEffect, useMemo, useState } from "react";
import { getMarket45EvidenceRegistry } from "../lib/v17-market-45-evidence-registry";
import { readMarket45Review } from "../lib/v17-paper-engine";
import { finalizeMarket45Review } from "../lib/v17-market-45-finalizer";

function Box({ title, children, tone = "blue" }) {
  const border = tone === "green" ? "rgba(34,197,94,.38)" : tone === "red" ? "rgba(248,113,113,.36)" : tone === "yellow" ? "rgba(245,158,11,.34)" : "rgba(59,130,246,.30)";
  return <section style={{ marginTop: 14, border: `1px solid ${border}`, background: "rgba(15,23,42,.78)", borderRadius: 22, padding: 16 }}>
    <h2 style={{ margin: "0 0 10px", color: "#f8fafc", fontSize: 18, fontWeight: 1000 }}>{title}</h2>
    {children}
  </section>;
}

function statusColor(status) {
  if (/VERIFIED/i.test(status || "")) return "#bbf7d0";
  if (/BLOCK|FOLLOWUP|NSI|DEBT/i.test(status || "")) return "#fecaca";
  return "#fde68a";
}

function EvidenceCard({ row }) {
  const permission = row.permissions || {};
  return <div style={{ padding: 12, borderRadius: 16, background: "rgba(2,6,23,.50)", border: "1px solid rgba(148,163,184,.16)", marginTop: 10 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
      <div>
        <strong style={{ color: "#f8fafc", fontSize: 17 }}>{row.symbol}</strong>
        <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 850 }}>{row.tag || "Evidence"}</div>
      </div>
      <div style={{ color: statusColor(row.status || row.evidenceStatus), fontWeight: 1000, fontSize: 12, textAlign: "right" }}>{row.evidenceStatus || row.sourceStatus || row.status}</div>
    </div>
    <div style={{ marginTop: 8, color: "#cbd5e1", fontSize: 12, lineHeight: 1.55, fontWeight: 850 }}>{row.decision}</div>
    <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 5 }}>
      <span style={{ color: permission.paperTrading ? "#bbf7d0" : "#fecaca", background: "rgba(15,23,42,.72)", padding: "4px 7px", borderRadius: 999, fontSize: 11, fontWeight: 1000 }}>紙上：{permission.paperTrading ? "允許" : "禁止"}</span>
      <span style={{ color: permission.formalObservation ? "#bbf7d0" : "#fecaca", background: "rgba(15,23,42,.72)", padding: "4px 7px", borderRadius: 999, fontSize: 11, fontWeight: 1000 }}>正式觀察：{permission.formalObservation ? "允許" : "禁止"}</span>
      <span style={{ color: permission.realAutoTrade ? "#bbf7d0" : "#fecaca", background: "rgba(15,23,42,.72)", padding: "4px 7px", borderRadius: 999, fontSize: 11, fontWeight: 1000 }}>真實交易：{permission.realAutoTrade ? "允許" : "禁止"}</span>
    </div>
    {row.nextVerification?.length ? <details style={{ marginTop: 9, borderTop: "1px solid rgba(148,163,184,.14)", paddingTop: 8 }}>
      <summary style={{ color: "#bfdbfe", fontWeight: 1000, cursor: "pointer" }}>下一步驗證清單</summary>
      <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "#cbd5e1", fontSize: 12, lineHeight: 1.6, fontWeight: 800 }}>
        {row.nextVerification.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </details> : null}
  </div>;
}

export default function Market45EvidencePage({ initialData, initialReview }) {
  const [data, setData] = useState(initialData || null);
  const [review, setReview] = useState(initialReview || null);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const [evidenceRes, reviewRes] = await Promise.all([
        fetch(`/api/v17/market-45-evidence?t=${Date.now()}`, { cache: "no-store" }),
        fetch(`/api/v17/market-45-review?t=${Date.now()}`, { cache: "no-store" }),
      ]);
      const evidenceJson = await evidenceRes.json();
      const reviewJson = await reviewRes.json();
      if (!evidenceRes.ok || evidenceJson.ok === false) throw new Error(evidenceJson.error || "Evidence 讀取失敗");
      if (!reviewRes.ok || reviewJson.ok === false) throw new Error(reviewJson.error || "Review 讀取失敗");
      setData(evidenceJson);
      setReview(reviewJson);
    } catch (err) {
      setError(err.message || "讀取失敗");
    }
  }

  useEffect(() => { load(); }, []);

  const rows = data?.rows || [];
  const pendingRows = useMemo(() => rows.filter((row) => /PENDING/i.test(`${row.evidenceStatus || row.sourceStatus || row.status || ""}`)), [rows]);
  const blockedRows = useMemo(() => rows.filter((row) => /FOLLOWUP|BLOCK|NSI|DEBT/i.test(`${row.status || row.blocker || ""}`)), [rows]);
  const finalSummary = review?.finalSummary || {};

  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "linear-gradient(180deg,#020617 0%,#07111f 55%,#0f172a 100%)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "22px 14px 40px" }}>
      <a href="/market-45-review" style={{ color: "#93c5fd", textDecoration: "none", fontWeight: 900 }}>← 返回 Market45</a>
      <header style={{ marginTop: 18, marginBottom: 18 }}>
        <div style={{ color: "#22c55e", letterSpacing: 3, fontWeight: 1000, fontSize: 13 }}>Market45 Evidence</div>
        <h1 style={{ fontSize: 34, lineHeight: 1.05, margin: "10px 0", fontWeight: 1000 }}>批次驗證任務</h1>
        <p style={{ color: "#cbd5e1", lineHeight: 1.55, fontWeight: 850, margin: 0 }}>一次管理所有待驗證候選。Evidence 未通過前，不准進紙上交易或正式觀察。</p>
      </header>

      {error && <Box title="錯誤" tone="red"><div style={{ color: "#fecaca", fontWeight: 850 }}>{error}</div></Box>}

      <Box title="收斂驗證" tone="green">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, color: "#cbd5e1", fontWeight: 850, lineHeight: 1.6 }}>
          <div>Evidence Registry：{data?.total || rows.length} 檔</div>
          <div>待驗證：{finalSummary["待驗證候選"] ?? pendingRows.length} 檔</div>
          <div>紙上交易：{finalSummary["紙上交易測試"] ?? 0} 檔</div>
          <div>正式觀察：{finalSummary["正式觀察"] ?? 0} 檔</div>
          <div>封鎖：{finalSummary["封鎖"] ?? 0} 檔</div>
          <div>缺資料：{finalSummary["缺資料"] ?? 0} 檔</div>
        </div>
      </Box>

      <Box title={`待驗證候選（${pendingRows.length}）`} tone="yellow">
        {pendingRows.map((row) => <EvidenceCard key={row.symbol} row={row} />)}
      </Box>

      <Box title={`已攔截 / 需後續確認（${blockedRows.length}）`} tone="red">
        {blockedRows.length ? blockedRows.map((row) => <EvidenceCard key={row.symbol} row={row} />) : <div style={{ color: "#94a3b8", fontWeight: 850 }}>無。</div>}
      </Box>
    </div>
  </main>;
}

export async function getServerSideProps() {
  const evidence = getMarket45EvidenceRegistry();
  const review = finalizeMarket45Review(await readMarket45Review());
  return {
    props: {
      initialData: JSON.parse(JSON.stringify({ ok: true, ...evidence })),
      initialReview: JSON.parse(JSON.stringify({ ok: true, ...review })),
    },
  };
}
