import { useEffect, useState } from "react";

function Box({ title, children, tone = "blue" }) {
  const border = tone === "green" ? "rgba(34,197,94,.38)" : tone === "red" ? "rgba(248,113,113,.36)" : tone === "yellow" ? "rgba(245,158,11,.34)" : "rgba(59,130,246,.30)";
  return <section style={{ marginTop: 14, border: `1px solid ${border}`, background: "rgba(15,23,42,.78)", borderRadius: 22, padding: 16 }}>
    <h2 style={{ margin: "0 0 10px", color: "#f8fafc", fontSize: 18, fontWeight: 1000 }}>{title}</h2>
    {children}
  </section>;
}

function Pill({ children, tone = "blue" }) {
  const map = { green: ["#bbf7d0", "rgba(34,197,94,.14)"], red: ["#fecaca", "rgba(248,113,113,.14)"], yellow: ["#fde68a", "rgba(245,158,11,.14)"], blue: ["#bfdbfe", "rgba(59,130,246,.13)"] };
  const [color, bg] = map[tone] || map.blue;
  return <span style={{ display: "inline-flex", margin: "3px 4px 3px 0", padding: "5px 8px", borderRadius: 999, color, background: bg, fontSize: 12, fontWeight: 1000 }}>{children}</span>;
}

function LogCard({ log }) {
  const tone = log.status === "SIMULATED" ? "green" : log.status === "FAILED" ? "red" : "yellow";
  return <Box title={`${log.symbol} ${log.tier}`} tone={tone}>
    <div><Pill tone={tone}>{log.status}</Pill><Pill>{log.mode}</Pill><Pill tone="yellow">DRY-RUN ONLY</Pill></div>
    <div style={{ marginTop: 10, display: "grid", gap: 6, color: "#cbd5e1", fontWeight: 850, fontSize: 13 }}>
      <div>Time：{log.createdAt || "—"}</div>
      <div>Amount：{Number(log.amountUSDT || 0).toFixed(2)}U</div>
      <div>Draft ID：<span style={{ color: "#94a3b8" }}>{log.draftId}</span></div>
      <div>Order ID：{log.orderId || "null"}</div>
      <div>Tx Hash：{log.txHash || "null"}</div>
      <div>Error：{log.error || "none"}</div>
      <div style={{ color: "#fde68a" }}>{log.note || "No real order was sent."}</div>
    </div>
  </Box>;
}

export default function ExecutionLog() {
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/v17/execution-log?t=${Date.now()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error || "讀取紀錄失敗");
      setLogs(json.logs || []);
    } catch (err) {
      setError(err.message || "讀取紀錄失敗");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { load(); }, []);

  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "linear-gradient(180deg,#020617 0%,#07111f 55%,#0f172a 100%)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "22px 14px 40px" }}>
      <a href="/v17" style={{ color: "#93c5fd", textDecoration: "none", fontWeight: 900 }}>← 返回折價獵人 V17</a>
      <header style={{ marginTop: 18, marginBottom: 18 }}>
        <div style={{ color: "#22c55e", letterSpacing: 3, fontWeight: 1000, fontSize: 13 }}>V17.6 EXECUTION LOG</div>
        <h1 style={{ fontSize: 34, lineHeight: 1.05, margin: "10px 0", fontWeight: 1000 }}>Execution Log</h1>
        <p style={{ color: "#cbd5e1", lineHeight: 1.55, fontWeight: 850, margin: 0 }}>交易黑盒子。V17.6 只允許 SIMULATED / BLOCKED / FAILED，不會出現真實 EXECUTED。</p>
      </header>
      {error && <Box title="錯誤" tone="red"><div style={{ color: "#fecaca", fontWeight: 850 }}>{error}</div></Box>}
      <Box title="Actions">
        <a href="/trade-readiness" style={{ color: "#bbf7d0", fontWeight: 1000, textDecoration: "none" }}>Trade Readiness</a><br />
        <a href="/semi-auto-draft" style={{ color: "#fde68a", fontWeight: 1000, textDecoration: "none" }}>Semi-Auto Draft</a>
        <button disabled={busy} onClick={load} style={{ width: "100%", marginTop: 10, padding: "12px 10px", borderRadius: 14, border: "1px solid rgba(59,130,246,.35)", background: "rgba(59,130,246,.12)", color: "#bfdbfe", fontWeight: 1000 }}>Refresh</button>
      </Box>
      {logs.length ? logs.map((log) => <LogCard key={log.id} log={log} />) : <Box title="目前沒有執行紀錄" tone="yellow"><div style={{ color: "#94a3b8", fontWeight: 850 }}>確認 dry-run 草稿後，這裡會出現 SIMULATED 紀錄。</div></Box>}
    </div>
  </main>;
}
