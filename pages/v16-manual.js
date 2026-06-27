import { useEffect, useMemo, useState } from "react";

const tierIcon = { D1: "🟢", D2: "🟡", D3: "🟠", D4: "🔴" };

function fmtPct(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(1)}%` : "--";
}

function fmtMoney(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(2)}U`.replace(".00U", "U") : "--";
}

function fmtProgress(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${Math.max(0, Math.min(100, Math.round(n)))}%` : "--";
}

async function jsonFetch(url, options = {}) {
  const res = await fetch(url, { cache: "no-store", ...options });
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.ok === false) throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
  return data;
}

async function statusFetch(url) {
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json().catch(() => null);
  return data || { ok: false, error: `HTTP ${res.status}` };
}

function requireNonEmptyArray(value, label) {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${label}_empty`);
  return value;
}

export default function V16ManualPage() {
  const [loading, setLoading] = useState(false);
  const [decisions, setDecisions] = useState([]);
  const [ledger, setLedger] = useState(null);
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const totalAmount = useMemo(() => decisions.reduce((sum, item) => sum + Number(item.amount || 0), 0), [decisions]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const prices = await jsonFetch(`/api/prices?t=${Date.now()}`);
      const assets = requireNonEmptyArray(prices.data, "prices_data");
      const ledgerData = await jsonFetch(`/api/buy-ledger?t=${Date.now()}`);
      const today = await jsonFetch(`/api/today-decisions?t=${Date.now()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assets, ledger: ledgerData.ledger || {} })
      });
      const statusData = await statusFetch(`/api/v16-status?t=${Date.now()}`);

      setDecisions(today.decisions || []);
      setLedger(ledgerData.ledger || null);
      setStatus(statusData || null);
    } catch (err) {
      setError(err.message || "讀取失敗");
    } finally {
      setLoading(false);
    }
  }

  async function recordBuy(item) {
    setError("");
    setMessage("");
    try {
      const result = await jsonFetch("/api/manual-buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: item.symbol, tier: item.tier, amount: item.amount, price: item.price, note: "v16_manual_page" })
      });
      setMessage(result.replyText || `已登帳 ${item.symbol} ${item.tier}`);
      await load();
    } catch (err) {
      setError(err.message || "登帳失敗");
    }
  }

  useEffect(() => { load(); }, []);

  return <main style={{ minHeight: "100vh", background: "#020617", color: "#f8fafc", padding: 14, fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif" }}>
    <section style={{ padding: 16, borderRadius: 20, background: "linear-gradient(135deg,#111827,#020617)", border: "1px solid rgba(250,204,21,.35)", marginBottom: 12 }}>
      <div style={{ textAlign: "right", color: "#facc15", fontWeight: 1000, fontSize: 12 }}>V16-M</div>
      <h1 style={{ margin: "4px 0", fontSize: 34, lineHeight: 1.05 }}>DCA折價獵人<br />手動決策</h1>
      <div style={{ color: "#94a3b8", fontWeight: 850 }}>100% 觸發提醒 → 手動買入 → 登帳 → 去重</div>
    </section>

    <section style={{ padding: 14, borderRadius: 18, background: "#0f172a", border: "1px solid #334155", marginBottom: 12 }}>
      <button onClick={load} disabled={loading} style={{ width: "100%", padding: 12, border: 0, borderRadius: 14, background: loading ? "#475569" : "#2563eb", color: "white", fontWeight: 1000, fontSize: 16 }}>{loading ? "更新中..." : "重新整理"}</button>
      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Metric label="可執行" value={`${decisions.length} 檔`} />
        <Metric label="建議投入" value={fmtMoney(totalAmount)} green />
        <Metric label="資料儲存" value={status?.storage || "--"} />
        <Metric label="Release Gate" value={status?.releaseBlocked ? "阻擋" : "正常"} warn={status?.releaseBlocked} />
      </div>
      {status?.releaseBlocked && <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: "rgba(250,204,21,.12)", color: "#fde68a", fontWeight: 850 }}>⚠️ Release Gate：{status.releaseBlockers?.map((b) => b.key).join("、") || status.releaseBlocker || "blocked"}</div>}
    </section>

    {message && <pre style={{ whiteSpace: "pre-wrap", padding: 12, borderRadius: 14, background: "rgba(34,197,94,.14)", color: "#bbf7d0", fontWeight: 850 }}>{message}</pre>}
    {error && <div style={{ padding: 12, borderRadius: 14, background: "rgba(239,68,68,.16)", color: "#fecaca", fontWeight: 900 }}>⚠️ {error}</div>}

    <section style={{ display: "grid", gap: 10 }}>
      {!decisions.length && !loading && <div style={{ textAlign: "center", padding: 20, color: "#94a3b8", fontWeight: 900, background: "#0f172a", borderRadius: 16 }}>目前沒有未登帳買點</div>}
      {decisions.map((item) => {
        const progressValue = item.progress?.displayProgress ?? item.progress?.progress ?? 100;
        return <article key={`${item.symbol}_${item.tier}`} style={{ padding: 14, background: "#0f172a", border: "1px solid #334155", borderRadius: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <strong style={{ fontSize: 22 }}>{tierIcon[item.tier] || "⚪"} {item.symbol}</strong>
            <strong style={{ color: "#facc15", fontSize: 20 }}>{item.tier}</strong>
          </div>
          <div style={{ marginTop: 8, display: "grid", gap: 4, color: "#cbd5e1", fontWeight: 850 }}>
            <span>進度：{fmtProgress(progressValue)}｜{item.progress?.stageText || `${item.tier} 已觸發`}</span>
            <span>跌幅：{fmtPct(item.discount)}｜門檻：{fmtPct(item.rule)}</span>
            <span>建議：{fmtMoney(item.amount)}｜價格：{Number(item.price || 0).toFixed(4)}</span>
            <span>{item.command}</span>
          </div>
          <button onClick={() => recordBuy(item)} style={{ marginTop: 12, width: "100%", padding: 12, border: 0, borderRadius: 14, background: "#16a34a", color: "white", fontWeight: 1000, fontSize: 16 }}>已手動買入，寫入 Ledger</button>
        </article>;
      })}
    </section>

    <details style={{ marginTop: 14, padding: 12, background: "#0f172a", borderRadius: 16, border: "1px solid #334155" }}>
      <summary style={{ fontWeight: 1000 }}>Ledger 檢查</summary>
      <pre style={{ whiteSpace: "pre-wrap", overflowX: "auto", color: "#cbd5e1", fontSize: 11 }}>{JSON.stringify(ledger, null, 2)}</pre>
    </details>
  </main>;
}

function Metric({ label, value, green, warn }) {
  return <div style={{ padding: 10, background: "#020617", borderRadius: 14 }}>
    <div style={{ color: "#94a3b8", fontWeight: 850, fontSize: 12 }}>{label}</div>
    <strong style={{ display: "block", marginTop: 4, color: warn ? "#facc15" : green ? "#22c55e" : "#f8fafc", fontSize: 16 }}>{value}</strong>
  </div>;
}
