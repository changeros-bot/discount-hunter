import { useEffect, useState } from "react";

function Box({ title, children, tone = "blue" }) {
  const border = tone === "green" ? "rgba(34,197,94,.38)" : tone === "yellow" ? "rgba(245,158,11,.34)" : tone === "red" ? "rgba(248,113,113,.36)" : "rgba(59,130,246,.30)";
  return <section style={{ marginTop: 14, border: `1px solid ${border}`, background: "rgba(15,23,42,.76)", borderRadius: 22, padding: 16 }}><h2 style={{ margin: "0 0 10px", color: "#f8fafc", fontSize: 18, fontWeight: 1000 }}>{title}</h2>{children}</section>;
}
function Pill({ children, tone = "blue" }) {
  const map = { green: ["#bbf7d0", "rgba(34,197,94,.14)"], yellow: ["#fde68a", "rgba(245,158,11,.14)"], red: ["#fecaca", "rgba(248,113,113,.14)"], blue: ["#bfdbfe", "rgba(59,130,246,.13)"] };
  const [color, bg] = map[tone] || map.blue;
  return <span style={{ display: "inline-flex", margin: "3px 4px 3px 0", padding: "5px 8px", borderRadius: 999, color, background: bg, fontSize: 12, fontWeight: 1000 }}>{children}</span>;
}
function RowCard({ row }) {
  const confirmed = row.tier === "CONFIRMED_MAIN";
  return <article style={{ marginTop: 10, padding: 12, borderRadius: 18, background: "rgba(2,6,23,.48)", border: `1px solid ${confirmed ? "rgba(34,197,94,.32)" : "rgba(245,158,11,.28)"}` }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}><strong style={{ color: "#f8fafc", fontSize: 20 }}>{row.symbol}</strong><Pill tone={confirmed ? "green" : "yellow"}>{confirmed ? "主名單" : "暫緩"}</Pill></div>
    <div style={{ marginTop: 6, color: "#cbd5e1", fontWeight: 850, fontSize: 13, lineHeight: 1.55 }}>{row.name}｜{row.bucket}<br />角色：{row.proposedRole}</div>
    <div style={{ marginTop: 8, color: "#94a3b8", fontWeight: 850, fontSize: 12, lineHeight: 1.55 }}>理由：{row.reason}<br />規則：{row.proposedRule}</div>
  </article>;
}

export default function Market91Shortlist() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { fetch(`/api/v17/market-91-shortlist?t=${Date.now()}`, { cache: "no-store" }).then((r) => r.json()).then((x) => { if (!x.ok) throw new Error(x.error || "讀取失敗"); setData(x); }).catch((e) => setError(e.message || "讀取失敗")); }, []);
  const confirmed = data?.confirmedMainList || [];
  const secondary = data?.secondaryWatch || [];
  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "linear-gradient(180deg,#020617 0%,#07111f 55%,#0f172a 100%)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "22px 14px 40px" }}>
      <a href="/v17" style={{ color: "#93c5fd", textDecoration: "none", fontWeight: 900 }}>← 返回折價獵人</a>
      <header style={{ marginTop: 18, marginBottom: 18 }}>
        <div style={{ color: "#38bdf8", letterSpacing: 3, fontWeight: 1000, fontSize: 13 }}>MARKET 91 FINAL LIST</div>
        <h1 style={{ fontSize: 34, lineHeight: 1.05, margin: "10px 0", fontWeight: 1000 }}>17檔主名單</h1>
        <p style={{ color: "#cbd5e1", lineHeight: 1.55, fontWeight: 850, margin: 0 }}>Market 91 已收斂成 17 檔主名單。這不是定期定額清單，只是個股 / xStocks 折價加碼候選。富邦 0050 / VOO / QQQM 仍是另一套主 DCA 系統。</p>
      </header>
      {error && <Box title="讀取失敗" tone="red"><div style={{ color: "#fecaca" }}>{error}</div></Box>}
      {!data && !error && <Box title="讀取中"><div style={{ color: "#94a3b8" }}>讀取最終名單中…</div></Box>}
      {data && <>
        <Box title="定位" tone="green"><div><Pill tone="green">Confirmed Main {confirmed.length}</Pill><Pill tone="yellow">Secondary Watch {secondary.length}</Pill><Pill tone="red">Auto Trade OFF</Pill></div><div style={{ marginTop: 8, color: "#cbd5e1", fontWeight: 850, lineHeight: 1.55 }}>只允許 Action Gate 判斷：No Action / Discount Add Allowed / Watch Only / Blocked。</div></Box>
        <Box title={`已確認主名單（${confirmed.length}）`} tone="green">{confirmed.map((row) => <RowCard key={row.symbol} row={row} />)}</Box>
        <Box title={`暫緩觀察（${secondary.length}）`} tone="yellow">{secondary.map((row) => <RowCard key={row.symbol} row={row} />)}</Box>
        <Box title="入口"><a href="/semi-auto-drafts" style={{ color: "#bbf7d0", fontWeight: 1000, textDecoration: "none" }}>Action Gate</a><br /><a href="/trade-readiness" style={{ color: "#fde68a", fontWeight: 1000, textDecoration: "none" }}>現金與預算檢查</a><br /><a href="/v17" style={{ color: "#bfdbfe", fontWeight: 1000, textDecoration: "none" }}>折價獵人主頁</a></Box>
      </>}
    </div>
  </main>;
}
