import { useEffect, useState } from "react";

function twTime(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false }); } catch { return iso; }
}
function Box({ title, children, tone = "blue" }) {
  const border = tone === "green" ? "rgba(34,197,94,.38)" : tone === "yellow" ? "rgba(245,158,11,.34)" : tone === "red" ? "rgba(248,113,113,.36)" : "rgba(59,130,246,.30)";
  return <section style={{ marginTop: 14, border: `1px solid ${border}`, background: "rgba(15,23,42,.76)", borderRadius: 22, padding: 16 }}><h2 style={{ margin: "0 0 10px", color: "#f8fafc", fontSize: 18, fontWeight: 1000 }}>{title}</h2>{children}</section>;
}
function Stat({ label, value, tone = "blue" }) {
  const color = tone === "green" ? "#bbf7d0" : tone === "yellow" ? "#fde68a" : tone === "red" ? "#fecaca" : "#bfdbfe";
  return <div style={{ padding: 12, borderRadius: 16, background: "rgba(2,6,23,.50)", border: "1px solid rgba(148,163,184,.15)" }}><div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 900 }}>{label}</div><strong style={{ display: "block", marginTop: 5, color, fontSize: 24 }}>{value}</strong></div>;
}
function EventCard({ event }) {
  const executed = event.action === "MANUALLY_EXECUTED";
  const skipped = event.action === "SKIPPED_BY_USER";
  const color = executed ? "#bbf7d0" : skipped ? "#fde68a" : "#cbd5e1";
  const label = executed ? "已手動完成" : skipped ? "已略過本層" : event.action;
  return <article style={{ marginTop: 10, padding: 12, borderRadius: 18, background: "rgba(2,6,23,.48)", border: `1px solid ${executed ? "rgba(34,197,94,.32)" : skipped ? "rgba(245,158,11,.32)" : "rgba(148,163,184,.18)"}` }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}><strong style={{ color: "#f8fafc", fontSize: 20 }}>{event.symbol}</strong><span style={{ color, fontWeight: 1000 }}>{label}</span></div>
    <div style={{ marginTop: 8, color: "#cbd5e1", fontWeight: 850, fontSize: 13, lineHeight: 1.6 }}>
      層級：{event.tier}｜金額：{event.amount ?? "—"}U｜價格：{event.price ? `$${Number(event.price).toFixed(4)}` : "—"}<br />
      時間：{twTime(event.time)}<br />
      備註：{event.note || "—"}
    </div>
  </article>;
}

export default function SemiAutoFlowLog() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { fetch(`/api/v17/semi-auto-flow-log?t=${Date.now()}`, { cache: "no-store" }).then((r) => r.json()).then((x) => { if (!x.ok) throw new Error(x.error || "讀取失敗"); setData(x); }).catch((e) => setError(e.message || "讀取失敗")); }, []);
  const s = data?.summary || {};
  const events = data?.events || [];
  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "linear-gradient(180deg,#020617 0%,#07111f 55%,#0f172a 100%)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "22px 14px 40px" }}>
      <a href="/semi-auto-drafts" style={{ color: "#93c5fd", textDecoration: "none", fontWeight: 900 }}>← 返回半自動草稿</a>
      <header style={{ marginTop: 18, marginBottom: 18 }}>
        <div style={{ color: "#22c55e", letterSpacing: 3, fontWeight: 1000, fontSize: 13 }}>V17.4 FLOW LOG</div>
        <h1 style={{ fontSize: 36, lineHeight: 1.05, margin: "10px 0", fontWeight: 1000 }}>半自動流程紀錄</h1>
        <p style={{ color: "#cbd5e1", lineHeight: 1.55, fontWeight: 850, margin: 0 }}>記錄你按下「已手動完成」或「略過本層」的事件。這不是交易 API，也不會自動下單。</p>
      </header>
      {error && <Box title="讀取失敗" tone="red"><div style={{ color: "#fecaca" }}>{error}</div></Box>}
      {!data && !error && <Box title="讀取中"><div style={{ color: "#94a3b8" }}>讀取流程紀錄中…</div></Box>}
      {data && <>
        <Box title="流程統計" tone="green">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Stat label="半自動事件" value={s.semiAutoEvents || 0} tone="blue" />
            <Stat label="已完成" value={s.manuallyExecuted || 0} tone="green" />
            <Stat label="已略過" value={s.skippedByUser || 0} tone="yellow" />
            <Stat label="全部事件" value={s.totalEvents || 0} />
          </div>
        </Box>
        <Box title={`最近紀錄（${events.length}）`}>
          {events.length ? events.map((event) => <EventCard key={event.id} event={event} />) : <div style={{ color: "#94a3b8", fontWeight: 850, lineHeight: 1.6 }}>目前還沒有流程紀錄。等有草稿後，你按「已手動完成」或「略過本層」，這裡就會出現。</div>}
        </Box>
        <Box title="入口">
          <a href="/auto-whitelist" style={{ color: "#fca5a5", fontWeight: 1000, textDecoration: "none" }}>有限自動白名單前置檢查</a><br />
          <a href="/semi-auto-drafts" style={{ color: "#bbf7d0", fontWeight: 1000, textDecoration: "none" }}>半自動草稿</a><br />
          <a href="/trade-readiness" style={{ color: "#bfdbfe", fontWeight: 1000, textDecoration: "none" }}>現金與預算檢查</a><br />
          <a href="/v17" style={{ color: "#fde68a", fontWeight: 1000, textDecoration: "none" }}>折價獵人主頁</a>
        </Box>
      </>}
    </div>
  </main>;
}
