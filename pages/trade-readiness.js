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

function CheckRow({ check }) {
  const pass = check.status === "PASS" || check.passed === true;
  return <div style={{ padding: 10, borderRadius: 14, background: "rgba(2,6,23,.45)", border: `1px solid ${pass ? "rgba(34,197,94,.28)" : "rgba(248,113,113,.30)"}` }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
      <strong style={{ color: "#f8fafc" }}>{check.name}</strong>
      <span style={{ color: pass ? "#bbf7d0" : "#fecaca", fontWeight: 1000 }}>{pass ? "PASS" : "FAIL"}</span>
    </div>
    <div style={{ marginTop: 4, color: "#94a3b8", fontSize: 12, fontWeight: 850, lineHeight: 1.45 }}>{check.detail}</div>
  </div>;
}

export default function TradeReadiness() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/v17/trade-readiness?t=${Date.now()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error || "讀取失敗");
      setData(json);
    } catch (err) {
      setError(err.message || "讀取失敗");
    } finally {
      setBusy(false);
    }
  }

  async function createDraft() {
    if (!data?.candidate) return;
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/v17/trade-drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidate: data.candidate }),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.readiness?.summary || json.error || "建立草稿失敗");
      setMessage(json.duplicate ? `已有草稿：${json.draft.id}` : `已建立草稿：${json.draft.id}`);
    } catch (err) {
      setError(err.message || "建立草稿失敗");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { load(); }, []);

  const tone = data?.status === "READY" ? "green" : data?.status === "BLOCKED" ? "red" : "yellow";
  const candidate = data?.candidate;

  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "linear-gradient(180deg,#020617 0%,#07111f 55%,#0f172a 100%)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "22px 14px 40px" }}>
      <a href="/v17" style={{ color: "#93c5fd", textDecoration: "none", fontWeight: 900 }}>← 返回折價獵人 V17</a>
      <header style={{ marginTop: 18, marginBottom: 18 }}>
        <div style={{ color: "#22c55e", letterSpacing: 3, fontWeight: 1000, fontSize: 13 }}>V17.6 SEMI-AUTO EXECUTION FLOW</div>
        <h1 style={{ fontSize: 34, lineHeight: 1.05, margin: "10px 0", fontWeight: 1000 }}>Trade Readiness</h1>
        <p style={{ color: "#cbd5e1", lineHeight: 1.55, fontWeight: 850, margin: 0 }}>交易準備檢查。第一版只做 DRY-RUN，不呼叫 Binance 真實下單 API。</p>
      </header>

      {error && <Box title="讀取失敗" tone="red"><div style={{ color: "#fecaca", fontWeight: 850 }}>{error}</div></Box>}
      {!data && !error && <Box title="讀取中"><div style={{ color: "#94a3b8" }}>檢查 V17.6 Risk Gate 中…</div></Box>}
      {data && <>
        <Box title="Readiness Status" tone={tone}>
          <div><Pill tone={tone}>{data.status}</Pill><Pill>{data.mode}</Pill><Pill tone="yellow">DRY-RUN ONLY</Pill></div>
          <div style={{ marginTop: 8, color: "#cbd5e1", fontWeight: 850, lineHeight: 1.55 }}>{data.summary}</div>
        </Box>

        <Box title="Candidate" tone={candidate ? "green" : "yellow"}>
          {candidate ? <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, color: "#cbd5e1", fontWeight: 850 }}>
            <div>標的：<strong style={{ color: "#f8fafc" }}>{candidate.symbol}</strong></div>
            <div>層級：<strong style={{ color: "#f8fafc" }}>{candidate.tier}</strong></div>
            <div>金額：<strong style={{ color: "#f8fafc" }}>{Number(candidate.amountUSDT || 0).toFixed(2)}U</strong></div>
            <div>回撤：{candidate.drawdown ?? "—"}</div>
          </div> : <div style={{ color: "#94a3b8", fontWeight: 850 }}>目前沒有可產生草稿的買點。</div>}
        </Box>

        <Box title="Risk Checks" tone={tone}>
          <div style={{ display: "grid", gap: 8 }}>{(data.checks || []).map((x) => <CheckRow key={x.name} check={x} />)}</div>
          {data.blockedReasons?.length ? <div style={{ marginTop: 10, color: "#fecaca", fontWeight: 900 }}>Blocked：{data.blockedReasons.join(" / ")}</div> : null}
        </Box>

        <Box title="Actions">
          <button disabled={busy || data.status !== "READY"} onClick={createDraft} style={{ width: "100%", padding: "12px 10px", borderRadius: 14, border: "1px solid rgba(34,197,94,.45)", background: data.status === "READY" ? "rgba(34,197,94,.18)" : "rgba(51,65,85,.55)", color: data.status === "READY" ? "#bbf7d0" : "#94a3b8", fontWeight: 1000 }}>Create Dry-run Draft</button>
          <button disabled={busy} onClick={load} style={{ width: "100%", marginTop: 8, padding: "12px 10px", borderRadius: 14, border: "1px solid rgba(59,130,246,.35)", background: "rgba(59,130,246,.12)", color: "#bfdbfe", fontWeight: 1000 }}>Refresh</button>
          {message && <div style={{ marginTop: 10, color: "#bbf7d0", fontWeight: 900 }}>{message}</div>}
        </Box>

        <Box title="入口">
          <a href="/semi-auto-draft" style={{ color: "#bbf7d0", fontWeight: 1000, textDecoration: "none" }}>Semi-Auto Draft</a><br />
          <a href="/execution-log" style={{ color: "#fde68a", fontWeight: 1000, textDecoration: "none" }}>Execution Log</a>
        </Box>
      </>}
    </div>
  </main>;
}
