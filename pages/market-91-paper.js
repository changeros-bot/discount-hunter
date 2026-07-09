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
function LinkButton({ href, children }) {
  return <a href={href} style={{ display: "block", marginTop: 10, padding: "12px 10px", borderRadius: 14, border: "1px solid rgba(59,130,246,.38)", background: "rgba(59,130,246,.13)", color: "#bfdbfe", fontWeight: 1000, textAlign: "center", textDecoration: "none" }}>{children}</a>;
}
function RuleText({ rule }) {
  if (!rule) return null;
  return <div style={{ marginTop: 6, color: "#94a3b8", fontSize: 11, fontWeight: 850, lineHeight: 1.45 }}>規則：{rule.layer1.triggerPct}% / {rule.layer2.triggerPct}% / {rule.layer3.triggerPct}%｜{rule.layer1.amountUsd}U / {rule.layer2.amountUsd}U / {rule.layer3.amountUsd}U</div>;
}
function Row({ row }) {
  const triggered = row.actionGate === "Paper Buy Triggered";
  return <article style={{ marginTop: 10, padding: 12, borderRadius: 18, background: "rgba(2,6,23,.48)", border: `1px solid ${triggered ? "rgba(34,197,94,.34)" : "rgba(148,163,184,.18)"}` }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
      <strong style={{ color: "#f8fafc", fontSize: 20 }}>{row.symbol}</strong>
      <Pill tone={triggered ? "green" : "yellow"}>{triggered ? "紙上買入" : "無動作"}</Pill>
    </div>
    <div style={{ marginTop: 6, color: "#cbd5e1", fontWeight: 850, fontSize: 13, lineHeight: 1.55 }}>
      {row.name}｜{row.role}<br />跌幅：{row.discountText}｜價格：${Number(row.price || 0).toFixed(4)}
      {triggered ? <><br />模擬：{Number(row.amountUsd || 0).toFixed(2)}U｜觸發：{row.triggerPct}%｜估算數量：{Number(row.estimatedQty || 0).toFixed(6)}</> : null}
    </div>
    <RuleText rule={row.rule} />
  </article>;
}

export default function Market91Paper() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    fetch(`/api/v17/market-91-paper?t=${Date.now()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((x) => { if (!x.ok) throw new Error(x.error || "讀取失敗"); setData(x); })
      .catch((e) => setError(e.message || "讀取失敗"));
  }, []);
  const triggered = data?.triggered || [];
  const rows = data?.rows || [];
  const idle = rows.filter((x) => x.actionGate !== "Paper Buy Triggered");
  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "linear-gradient(180deg,#020617 0%,#07111f 55%,#0f172a 100%)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "22px 14px 40px" }}>
      <a href="/v17" style={{ color: "#93c5fd", textDecoration: "none", fontWeight: 900 }}>← 返回折價獵人</a>
      <header style={{ marginTop: 18, marginBottom: 18 }}>
        <div style={{ color: "#38bdf8", letterSpacing: 3, fontWeight: 1000, fontSize: 13 }}>MARKET 91 PAPER TRADING</div>
        <h1 style={{ fontSize: 34, lineHeight: 1.05, margin: "10px 0", fontWeight: 1000 }}>紙上交易買點</h1>
        <p style={{ color: "#cbd5e1", lineHeight: 1.55, fontWeight: 850, margin: 0 }}>只用 17 檔主名單測試折價買點績效。這不是實盤、不送單、不進白名單。</p>
      </header>
      {error && <Box title="讀取失敗" tone="red"><div style={{ color: "#fecaca" }}>{error}</div></Box>}
      {!data && !error && <Box title="讀取中"><div style={{ color: "#94a3b8" }}>計算紙上買點中…</div></Box>}
      {data && <>
        <Box title="今日狀態" tone={triggered.length ? "green" : "yellow"}>
          <div><Pill tone="green">觸發 {data.summary.triggeredCount}</Pill><Pill tone="yellow">無動作 {data.summary.noActionCount}</Pill><Pill tone="red">Real Orders OFF</Pill></div>
          <div style={{ marginTop: 8, color: "#cbd5e1", fontWeight: 850, lineHeight: 1.55 }}>紙上模擬金額：{Number(data.summary.totalPaperAmountUsd || 0).toFixed(2)}U。目標是先看 30 / 60 / 90 天績效，再決定是否改真實規則。</div>
        </Box>
        <Box title="規則" tone="yellow"><div style={{ color: "#cbd5e1", lineHeight: 1.7, fontWeight: 850 }}>核心股：-15% / -25% / -35%，5U / 5U / 10U。<br />衛星股：-20% / -30% / -40%，5U / 5U / 10U。<br />高波動股：-25% / -40% / -55%，5U / 5U / 10U。</div></Box>
        <Box title={`今日紙上買入（${triggered.length}）`} tone="green">{triggered.length ? triggered.map((row) => <Row key={row.symbol} row={row} />) : <div style={{ color: "#94a3b8", fontWeight: 850 }}>今天沒有觸發紙上買點。</div>}</Box>
        <Box title={`未觸發（${idle.length}）`}>{idle.map((row) => <Row key={row.symbol} row={row} />)}</Box>
        <Box title="入口"><LinkButton href="/market-91-shortlist">17檔主名單</LinkButton><LinkButton href="/semi-auto-drafts">Action Gate</LinkButton><LinkButton href="/trade-readiness">現金與預算檢查</LinkButton></Box>
      </>}
    </div>
  </main>;
}
