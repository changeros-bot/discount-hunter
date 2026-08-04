import { useEffect, useState } from "react";
import { automationAuthHeaders, readAutomationSessionToken, saveAutomationSessionToken } from "../lib/v17-automation-client";

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

function DraftCard({ draft, onAction, busy }) {
  const tone = draft.status === "DRAFT" ? "green" : draft.status === "CONFIRMED" ? "blue" : draft.status === "SKIPPED" ? "yellow" : "red";
  return <Box title={`${draft.symbol} ${draft.tier}`} tone={tone}>
    <div><Pill tone={tone}>{draft.status}</Pill><Pill>{draft.mode}</Pill><Pill tone="yellow">DRY-RUN ONLY</Pill></div>
    <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, color: "#cbd5e1", fontWeight: 850 }}>
      <div>Draft ID：<span style={{ color: "#94a3b8" }}>{draft.id}</span></div>
      <div>金額：{Number(draft.amountUSDT || 0).toFixed(2)}U</div>
      <div>回撤：{draft.drawdown ?? "—"}</div>
      <div>價格：{draft.price ?? "—"}</div>
      <div>Risk：{draft.riskStatus || "—"}</div>
      <div>建立：{draft.createdAt || "—"}</div>
    </div>
    {draft.status === "DRAFT" ? <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
      <button disabled={busy} onClick={() => onAction(draft.id, "CONFIRM")} style={{ padding: "11px 8px", borderRadius: 13, border: "1px solid rgba(34,197,94,.45)", background: "rgba(34,197,94,.18)", color: "#bbf7d0", fontWeight: 1000 }}>Confirm Dry-run</button>
      <button disabled={busy} onClick={() => onAction(draft.id, "SKIP")} style={{ padding: "11px 8px", borderRadius: 13, border: "1px solid rgba(245,158,11,.45)", background: "rgba(245,158,11,.14)", color: "#fde68a", fontWeight: 1000 }}>Skip</button>
      <button disabled={busy} onClick={() => onAction(draft.id, "CANCEL")} style={{ gridColumn: "1 / -1", padding: "11px 8px", borderRadius: 13, border: "1px solid rgba(248,113,113,.35)", background: "rgba(248,113,113,.12)", color: "#fecaca", fontWeight: 1000 }}>Cancel</button>
    </div> : null}
  </Box>;
}

export default function SemiAutoDraft() {
  const [drafts, setDrafts] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [accessCode, setAccessCode] = useState("");

  async function load() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/v17/trade-drafts?t=${Date.now()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error || "讀取草稿失敗");
      setDrafts(json.drafts || []);
    } catch (err) {
      setError(err.message || "讀取草稿失敗");
    } finally {
      setBusy(false);
    }
  }

  async function onAction(draftId, action) {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/v17/confirm-draft", {
        method: "POST",
        headers: automationAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ draftId, action }),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error || "動作失敗");
      setMessage(action === "CONFIRM" ? `已模擬執行：${json.execution?.id}` : `已更新草稿：${draftId}`);
      await load();
    } catch (err) {
      setError(err.message || "動作失敗");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    setAccessCode(readAutomationSessionToken());
    load();
  }, []);

  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "linear-gradient(180deg,#020617 0%,#07111f 55%,#0f172a 100%)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "22px 14px 40px" }}>
      <a href="/v17" style={{ color: "#93c5fd", textDecoration: "none", fontWeight: 900 }}>← 返回折價獵人 V17</a>
      <header style={{ marginTop: 18, marginBottom: 18 }}>
        <div style={{ color: "#22c55e", letterSpacing: 3, fontWeight: 1000, fontSize: 13 }}>V17.6 DRY-RUN DRAFTS</div>
        <h1 style={{ fontSize: 34, lineHeight: 1.05, margin: "10px 0", fontWeight: 1000 }}>Semi-Auto Draft</h1>
        <p style={{ color: "#cbd5e1", lineHeight: 1.55, fontWeight: 850, margin: 0 }}>半自動交易草稿。Confirm 只會寫入 SIMULATED 紀錄，不會真實下單。</p>
      </header>
      {error && <Box title="錯誤" tone="red"><div style={{ color: "#fecaca", fontWeight: 850 }}>{error}</div></Box>}
      {message && <Box title="結果" tone="green"><div style={{ color: "#bbf7d0", fontWeight: 900 }}>{message}</div></Box>}
      <Box title="Secure Access">
        <input
          type="password"
          value={accessCode}
          onChange={(event) => setAccessCode(event.target.value)}
          placeholder="輸入 V17.7 Automation Access Code"
          autoComplete="off"
          style={{ width: "100%", boxSizing: "border-box", padding: "12px 10px", borderRadius: 14, border: "1px solid rgba(148,163,184,.28)", background: "rgba(2,6,23,.55)", color: "#f8fafc", fontWeight: 850 }}
        />
        <button onClick={() => { saveAutomationSessionToken(accessCode); setMessage("本次工作階段的安全碼已保存。"); }} style={{ width: "100%", marginTop: 8, padding: "11px 10px", borderRadius: 14, border: "1px solid rgba(59,130,246,.35)", background: "rgba(59,130,246,.12)", color: "#bfdbfe", fontWeight: 1000 }}>Save for this session</button>
        <div style={{ marginTop: 8, color: "#94a3b8", fontSize: 12, fontWeight: 800 }}>只保存在目前瀏覽器工作階段，關閉後自動清除。</div>
      </Box>
      <Box title="Actions">
        <a href="/trade-readiness" style={{ color: "#bbf7d0", fontWeight: 1000, textDecoration: "none" }}>Trade Readiness / Create Draft</a><br />
        <a href="/execution-log" style={{ color: "#fde68a", fontWeight: 1000, textDecoration: "none" }}>Execution Log</a>
        <button disabled={busy} onClick={load} style={{ width: "100%", marginTop: 10, padding: "12px 10px", borderRadius: 14, border: "1px solid rgba(59,130,246,.35)", background: "rgba(59,130,246,.12)", color: "#bfdbfe", fontWeight: 1000 }}>Refresh</button>
      </Box>
      {drafts.length ? drafts.map((draft) => <DraftCard key={draft.id} draft={draft} onAction={onAction} busy={busy} />) : <Box title="目前沒有草稿" tone="yellow"><div style={{ color: "#94a3b8", fontWeight: 850 }}>先到 Trade Readiness 建立 dry-run draft。</div></Box>}
    </div>
  </main>;
}
