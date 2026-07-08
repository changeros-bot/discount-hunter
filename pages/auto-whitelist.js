import { useEffect, useState } from "react";

function Box({ title, children, tone = "blue" }) {
  const border = tone === "green" ? "rgba(34,197,94,.38)" : tone === "red" ? "rgba(248,113,113,.36)" : tone === "yellow" ? "rgba(245,158,11,.34)" : "rgba(59,130,246,.30)";
  return <section style={{ marginTop: 14, border: `1px solid ${border}`, background: "rgba(15,23,42,.76)", borderRadius: 22, padding: 16 }}><h2 style={{ margin: "0 0 10px", color: "#f8fafc", fontSize: 18, fontWeight: 1000 }}>{title}</h2>{children}</section>;
}
function Pill({ children, tone = "blue" }) {
  const map = { green: ["#bbf7d0", "rgba(34,197,94,.14)"], red: ["#fecaca", "rgba(248,113,113,.14)"], yellow: ["#fde68a", "rgba(245,158,11,.14)"], blue: ["#bfdbfe", "rgba(59,130,246,.13)"] };
  const [color, bg] = map[tone] || map.blue;
  return <span style={{ display: "inline-flex", margin: "3px 4px 3px 0", padding: "5px 8px", borderRadius: 999, color, background: bg, fontSize: 12, fontWeight: 1000 }}>{children}</span>;
}
function RowCard({ row }) {
  const tone = row.precheckStatus === "ELIGIBLE" ? "green" : row.precheckStatus === "NOT_YET" ? "yellow" : "red";
  const label = row.precheckStatus === "ELIGIBLE" ? "可列候選" : row.precheckStatus === "NOT_YET" ? "尚未達標" : "排除";
  return <article style={{ marginTop: 10, padding: 12, borderRadius: 18, background: "rgba(2,6,23,.48)", border: `1px solid ${tone === "green" ? "rgba(34,197,94,.32)" : tone === "yellow" ? "rgba(245,158,11,.32)" : "rgba(248,113,113,.30)"}` }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}><strong style={{ color: "#f8fafc", fontSize: 20 }}>{row.symbol}</strong><Pill tone={tone}>{label}</Pill></div>
    <div style={{ marginTop: 6, color: "#cbd5e1", fontWeight: 850, fontSize: 13, lineHeight: 1.55 }}>{row.underlying}｜{row.role}<br />Quality：{row.qualityLabel}｜Pipeline：{row.pipeline}｜分數：{row.score ?? "—"}</div>
    <div style={{ marginTop: 8, color: "#94a3b8", fontWeight: 850, fontSize: 12 }}>{row.reason}</div>
    <details style={{ marginTop: 10, color: "#cbd5e1", fontSize: 12, lineHeight: 1.55, fontWeight: 850 }}>
      <summary style={{ color: "#bfdbfe", fontWeight: 1000 }}>前置檢查</summary>
      <ul>{(row.checks || []).map((x) => <li key={x.name} style={{ color: x.passed ? "#bbf7d0" : "#fecaca" }}>{x.name}：{x.passed ? "PASS" : "未通過"} — {x.detail}</li>)}</ul>
    </details>
  </article>;
}
function DryRunOrder({ order }) {
  const ok = order.dryRunAction === "WOULD_REQUEST_MANUAL_CONFIRMATION";
  return <article style={{ marginTop: 8, padding: 10, borderRadius: 16, background: "rgba(2,6,23,.48)", border: `1px solid ${ok ? "rgba(34,197,94,.30)" : "rgba(248,113,113,.30)"}` }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><strong style={{ color: "#f8fafc", fontSize: 18 }}>{order.symbol}</strong><Pill tone={ok ? "green" : "red"}>{ok ? "會要求人工確認" : "會擋下"}</Pill></div>
    <div style={{ marginTop: 6, color: "#cbd5e1", fontSize: 12, lineHeight: 1.55, fontWeight: 850 }}>{order.tier}｜{Number(order.amountUsd || 0).toFixed(2)}U｜Quality：{order.quality}<br />{order.reason}</div>
  </article>;
}

export default function AutoWhitelist() {
  const [data, setData] = useState(null);
  const [dryRun, setDryRun] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    Promise.all([
      fetch(`/api/v17/auto-whitelist?t=${Date.now()}`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/v17/automation-dry-run?t=${Date.now()}`, { cache: "no-store" }).then((r) => r.json()),
    ]).then(([w, d]) => {
      if (!w.ok) throw new Error(w.error || "白名單讀取失敗");
      setData(w);
      setDryRun(d);
    }).catch((e) => setError(e.message || "讀取失敗"));
  }, []);
  const rows = data?.rows || [];
  const s = data?.summary || {};
  const ds = dryRun?.summary || {};
  const orders = dryRun?.simulatedOrders || [];
  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "linear-gradient(180deg,#020617 0%,#07111f 55%,#0f172a 100%)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "22px 14px 40px" }}>
      <a href="/semi-auto-drafts" style={{ color: "#93c5fd", textDecoration: "none", fontWeight: 900 }}>← 返回半自動草稿</a>
      <header style={{ marginTop: 18, marginBottom: 18 }}>
        <div style={{ color: "#f59e0b", letterSpacing: 3, fontWeight: 1000, fontSize: 13 }}>V17.5 AUTOMATION DOORSTEP</div>
        <h1 style={{ fontSize: 36, lineHeight: 1.05, margin: "10px 0", fontWeight: 1000 }}>自動化門口</h1>
        <p style={{ color: "#cbd5e1", lineHeight: 1.55, fontWeight: 850, margin: 0 }}>只判斷誰有資格靠近自動化，並做今日乾跑模擬。現在仍不啟用真實下單。</p>
      </header>
      {error && <Box title="讀取失敗" tone="red"><div style={{ color: "#fecaca" }}>{error}</div></Box>}
      {!data && !error && <Box title="讀取中"><div style={{ color: "#94a3b8" }}>檢查自動化門檻與乾跑模擬中…</div></Box>}
      {data && <>
        <Box title="安全邊界" tone="yellow"><div><Pill tone="red">Auto Trade OFF</Pill><Pill>Dry Run ON</Pill><Pill tone="yellow">Kill Switch Required</Pill></div><div style={{ marginTop: 8, color: "#cbd5e1", fontWeight: 850, lineHeight: 1.55 }}>這裡只模擬今天如果開自動化會發生什麼，不會送出 Binance 訂單。</div></Box>
        <Box title="今日乾跑模擬" tone="green">
          {!dryRun?.ok ? <div style={{ color: "#fecaca", fontWeight: 850 }}>乾跑讀取失敗：{dryRun?.error || "unknown"}</div> : <>
            <div><Pill>草稿 {ds.draftCount || 0}</Pill><Pill tone="green">人工確認 {ds.wouldRequestManualConfirmationCount || 0}</Pill><Pill tone="red">會擋下 {ds.wouldBlockCount || 0}</Pill></div>
            <div style={{ marginTop: 8, color: "#cbd5e1", lineHeight: 1.55, fontWeight: 850 }}>Trade Readiness：{ds.readinessLabel || ds.readinessStatus || "—"}｜模擬金額：{Number(ds.totalDraftAmountUsd || 0).toFixed(2)}U</div>
            {orders.length ? orders.map((order) => <DryRunOrder key={`${order.symbol}-${order.tier}`} order={order} />) : <div style={{ marginTop: 8, color: "#94a3b8", fontWeight: 850 }}>今天沒有自動化候選動作。</div>}
          </>}
        </Box>
        <Box title="白名單門檻統計"><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}><Pill>總數 {s.total || 0}</Pill><Pill tone="yellow">尚未達標 {s.NOT_YET || 0}</Pill><Pill tone="red">排除 {s.EXCLUDED || 0}</Pill></div></Box>
        <Box title="規則"><ul style={{ margin: 0, paddingLeft: 18, color: "#cbd5e1", fontWeight: 850, lineHeight: 1.7 }}>{(data.rules || []).map((x) => <li key={x}>{x}</li>)}</ul></Box>
        <Box title={`標的檢查（${rows.length}）`}>{rows.map((row) => <RowCard key={row.symbol} row={row} />)}</Box>
        <Box title="入口"><a href="/semi-auto-drafts" style={{ color: "#bbf7d0", fontWeight: 1000, textDecoration: "none" }}>半自動草稿</a><br /><a href="/v17-quality" style={{ color: "#fde68a", fontWeight: 1000, textDecoration: "none" }}>Quality Audit Center</a><br /><a href="/v17" style={{ color: "#bfdbfe", fontWeight: 1000, textDecoration: "none" }}>折價獵人主頁</a></Box>
      </>}
    </div>
  </main>;
}
