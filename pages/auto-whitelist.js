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
function timeTw(iso) {
  if (!iso) return "尚未執行";
  try { return new Date(iso).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false }); } catch { return iso; }
}

export default function AutoWhitelistFrozen() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    fetch(`/api/v17/auto-whitelist?t=${Date.now()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((w) => {
        if (!w.ok) throw new Error(w.error || "凍結狀態讀取失敗");
        setData(w);
      })
      .catch((e) => setError(e.message || "讀取失敗"));
  }, []);

  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "linear-gradient(180deg,#020617 0%,#07111f 55%,#0f172a 100%)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "22px 14px 40px" }}>
      <a href="/semi-auto-drafts" style={{ color: "#93c5fd", textDecoration: "none", fontWeight: 900 }}>← 返回 Action Gate</a>
      <header style={{ marginTop: 18, marginBottom: 18 }}>
        <div style={{ color: "#f59e0b", letterSpacing: 3, fontWeight: 1000, fontSize: 13 }}>MARKET 91 V17.4 FROZEN WORKFLOW</div>
        <h1 style={{ fontSize: 34, lineHeight: 1.05, margin: "10px 0", fontWeight: 1000 }}>自動白名單已凍結</h1>
        <p style={{ color: "#cbd5e1", lineHeight: 1.55, fontWeight: 850, margin: 0 }}>Market 91 不再推進自動化白名單、乾跑下單或權限審查。現在只保留折價輔助判斷：No Action / Discount Add Allowed / Watch Only / Blocked。</p>
      </header>
      {error && <Box title="讀取失敗" tone="red"><div style={{ color: "#fecaca" }}>{error}</div></Box>}
      {!data && !error && <Box title="讀取中"><div style={{ color: "#94a3b8" }}>讀取凍結狀態中…</div></Box>}
      {data && <>
        <Box title="凍結狀態" tone="yellow">
          <div><Pill tone="red">Whitelist OFF</Pill><Pill tone="red">Auto Trade OFF</Pill><Pill tone="red">Permission Dry-run OFF</Pill><Pill tone="green">Action Gate ON</Pill></div>
          <div style={{ marginTop: 8, color: "#cbd5e1", fontWeight: 850, lineHeight: 1.65 }}>版本：{data.version}<br />更新：{timeTw(data.updatedAt)}<br />原因：{data.policy?.reason}</div>
        </Box>
        <Box title="目前主線" tone="green">
          <ol style={{ margin: 0, paddingLeft: 18, color: "#cbd5e1", fontWeight: 850, lineHeight: 1.8 }}>
            {(data.policy?.currentMainline || []).map((x) => <li key={x}>{x}</li>)}
          </ol>
        </Box>
        <Box title="允許輸出"><div>{(data.policy?.allowedActionGateOutputs || []).map((x) => <Pill key={x} tone={x === "Discount Add Allowed" ? "green" : x === "Blocked" ? "red" : "yellow"}>{x}</Pill>)}</div></Box>
        <Box title="禁止回流"><div>{(data.policy?.forbiddenOutputs || []).map((x) => <Pill key={x} tone="red">{x}</Pill>)}</div></Box>
        <Box title="入口"><a href="/semi-auto-drafts" style={{ color: "#bbf7d0", fontWeight: 1000, textDecoration: "none" }}>Action Gate</a><br /><a href="/trade-readiness" style={{ color: "#fde68a", fontWeight: 1000, textDecoration: "none" }}>現金與預算檢查</a><br /><a href="/v17" style={{ color: "#bfdbfe", fontWeight: 1000, textDecoration: "none" }}>折價獵人主頁</a></Box>
      </>}
    </div>
  </main>;
}
