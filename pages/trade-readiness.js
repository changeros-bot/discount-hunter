import { useEffect, useState } from "react";

function Box({ title, children, tone = "blue" }) {
  const border = tone === "green" ? "rgba(34,197,94,.38)" : tone === "red" ? "rgba(248,113,113,.36)" : tone === "yellow" ? "rgba(245,158,11,.34)" : "rgba(59,130,246,.30)";
  return <section style={{ marginTop: 14, border: `1px solid ${border}`, background: "rgba(15,23,42,.76)", borderRadius: 22, padding: 16 }}>
    <h2 style={{ margin: "0 0 10px", color: "#f8fafc", fontSize: 18, fontWeight: 1000 }}>{title}</h2>
    {children}
  </section>;
}
function Pill({ children, tone = "blue" }) {
  const map = { green: ["#bbf7d0", "rgba(34,197,94,.14)"], red: ["#fecaca", "rgba(248,113,113,.14)"], yellow: ["#fde68a", "rgba(245,158,11,.14)"], blue: ["#bfdbfe", "rgba(59,130,246,.13)"] };
  const [color, bg] = map[tone] || map.blue;
  return <span style={{ display: "inline-flex", margin: "3px 4px 3px 0", padding: "5px 8px", borderRadius: 999, color, background: bg, fontSize: 12, fontWeight: 1000 }}>{children}</span>;
}
function CheckRow({ check }) {
  return <div style={{ padding: 10, borderRadius: 14, background: "rgba(2,6,23,.45)", border: `1px solid ${check.passed ? "rgba(34,197,94,.28)" : "rgba(248,113,113,.30)"}` }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><strong style={{ color: "#f8fafc" }}>{check.name}</strong><span style={{ color: check.passed ? "#bbf7d0" : "#fecaca", fontWeight: 1000 }}>{check.passed ? "PASS" : "CHECK"}</span></div>
    <div style={{ marginTop: 4, color: "#94a3b8", fontSize: 12, fontWeight: 850, lineHeight: 1.45 }}>{check.detail}</div>
  </div>;
}
function DraftRow({ draft }) {
  return <div style={{ marginTop: 8, padding: 10, borderRadius: 14, background: "rgba(2,6,23,.45)", border: "1px solid rgba(245,158,11,.24)", color: "#cbd5e1", fontSize: 13, fontWeight: 850 }}>
    <strong style={{ color: "#f8fafc" }}>{draft.symbol}</strong>｜{draft.tier}｜{Number(draft.amountUsd || 0).toFixed(2)}U｜Quality：{draft.qualityGate?.label || "—"}
  </div>;
}

export default function TradeReadiness() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    fetch(`/api/v17/trade-readiness?t=${Date.now()}`, { cache: "no-store" }).then((r) => r.json()).then((x) => {
      if (!x.ok) throw new Error(x.error || "讀取失敗");
      setData(x);
    }).catch((e) => setError(e.message || "讀取失敗"));
  }, []);
  const status = data?.readiness?.status;
  const tone = status === "READY_FOR_MANUAL_CONFIRMATION" ? "green" : status === "NEEDS_MANUAL_REVIEW" ? "red" : "yellow";
  const cycle = data?.budget?.cycle || {};
  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "linear-gradient(180deg,#020617 0%,#07111f 55%,#0f172a 100%)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "22px 14px 40px" }}>
      <a href="/v17" style={{ color: "#93c5fd", textDecoration: "none", fontWeight: 900 }}>← 返回折價獵人</a>
      <header style={{ marginTop: 18, marginBottom: 18 }}>
        <div style={{ color: "#22c55e", letterSpacing: 3, fontWeight: 1000, fontSize: 13 }}>V17.4 TRADE READINESS</div>
        <h1 style={{ fontSize: 36, lineHeight: 1.05, margin: "10px 0", fontWeight: 1000 }}>現金與預算檢查</h1>
        <p style={{ color: "#cbd5e1", lineHeight: 1.55, fontWeight: 850, margin: 0 }}>每月預算 12 號才入金；本頁用「12 號到次月 11 號」作為預算週期。只做 readiness，不下單。</p>
      </header>
      {error && <Box title="讀取失敗" tone="red"><div style={{ color: "#fecaca" }}>{error}</div></Box>}
      {!data && !error && <Box title="讀取中"><div style={{ color: "#94a3b8" }}>檢查現金與預算中…</div></Box>}
      {data && <>
        <Box title="Readiness" tone={tone}>
          <div><Pill tone={tone}>{data.readiness.label}</Pill><Pill>Auto Trade OFF</Pill><Pill>Kill Switch ON</Pill><Pill tone="yellow">預算日 12 號</Pill></div>
          <div style={{ marginTop: 8, color: "#cbd5e1", fontWeight: 850, lineHeight: 1.55 }}>{data.readiness.reason}</div>
        </Box>
        <Box title="預算週期" tone="yellow">
          <div style={{ color: "#cbd5e1", fontWeight: 850, lineHeight: 1.7 }}>
            今日：{cycle.todayTaipei || "—"}<br />
            本期：{cycle.cycleStart || "—"} ～ {cycle.cycleEnd || "—"}<br />
            下一次預算入金：{cycle.nextReleaseDate || "—"}<br />
            <span style={{ color: "#fde68a" }}>{cycle.note}</span>
          </div>
        </Box>
        <Box title="現金與預算">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, color: "#cbd5e1", fontWeight: 850 }}>
            <div>可用 USDT：{Number(data.cash.totalUSDT || 0).toFixed(2)}U</div>
            <div>草稿合計：{Number(data.summary.totalDraftAmountUsdt || 0).toFixed(2)}U</div>
            <div>草稿後現金：{Number(data.summary.cashAfterDraftsUsdt || 0).toFixed(2)}U</div>
            <div>單日上限：{Number(data.budget.dailyDraftCapUsdt || 0).toFixed(2)}U</div>
            <div>本期預算：{data.budget.monthlyBudgetTwd} TWD</div>
            <div>逢低預算：約 {Number(data.budget.dipBudgetUsdt || 0).toFixed(2)}U</div>
          </div>
        </Box>
        <Box title="檢查項目">
          <div style={{ display: "grid", gap: 8 }}>{(data.checks || []).map((x) => <CheckRow key={x.name} check={x} />)}</div>
        </Box>
        <Box title={`半自動草稿（${data.summary.draftCount}）`}>
          {data.drafts?.length ? data.drafts.map((draft) => <DraftRow key={`${draft.symbol}-${draft.tier}`} draft={draft} />) : <div style={{ color: "#94a3b8", fontWeight: 850 }}>目前沒有草稿。</div>}
        </Box>
        <Box title="入口">
          <a href="/semi-auto-drafts" style={{ color: "#bbf7d0", fontWeight: 1000, textDecoration: "none" }}>半自動草稿</a><br />
          <a href="/v17-quality" style={{ color: "#fde68a", fontWeight: 1000, textDecoration: "none" }}>Quality Audit Center</a>
        </Box>
      </>}
    </div>
  </main>;
}
