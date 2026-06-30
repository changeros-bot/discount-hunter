import { useEffect, useMemo, useState } from "react";
import { classifyUniverse } from "../lib/v17-state-classifier";

const REFRESH_MS = 10000;
const TIER_ICON = { D1: "🟢", D2: "🟡", D3: "🟠", D4: "🔴", D0: "⚪" };

function fmtPct(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(1)}%` : "--";
}

function fmtUsd(value, digits = 2) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? `$${n.toFixed(digits)}` : "--";
}

function fmtAmount(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? `${n.toFixed(2).replace(".00", "")}U` : "--";
}

function timeText(iso) {
  if (!iso) return "讀取中";
  const date = new Date(iso);
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
}

async function jsonFetch(url, options = {}) {
  const res = await fetch(url, { cache: "no-store", ...options });
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.ok === false) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
  return data;
}

function marketMapFromRows(rows = []) {
  return Object.fromEntries((rows || []).map((row) => [row.symbol, {
    symbol: row.symbol,
    price: row.price,
    high: row.high,
    high52w: row.high52w,
    cycleHigh: row.high || row.cycleHigh || row.high52w,
    discount: row.discount
  }]));
}

function LayerRules({ rules = [], amounts = [], activeTier }) {
  return <details open style={{ marginTop: 10 }}>
    <summary style={{ fontWeight: 900, color: "#e2e8f0" }}>層級規則</summary>
    <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
      {(rules || []).map((rule, index) => {
        const tier = `D${index + 1}`;
        const active = tier === activeTier;
        return <div key={tier} style={{ display: "grid", gridTemplateColumns: "52px 1fr 64px", gap: 8, padding: "8px 10px", borderRadius: 10, background: active ? "rgba(245,158,11,.18)" : "rgba(15,23,42,.92)", border: active ? "1px solid rgba(245,158,11,.65)" : "1px solid rgba(148,163,184,.15)", color: active ? "#fde68a" : "#cbd5e1", fontWeight: 900 }}>
          <span>{active ? "▶ " : ""}{tier}</span>
          <span>{fmtPct(rule)}</span>
          <span style={{ textAlign: "right" }}>{fmtAmount(amounts?.[index] || 0)}</span>
        </div>;
      })}
    </div>
  </details>;
}

function Card({ row, children }) {
  return <article style={{ padding: 14, borderRadius: 16, background: "#0f172a", border: "1px solid rgba(148,163,184,.22)", color: "#f8fafc" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 1000 }}>{TIER_ICON[row.tier] || "⚪"} {row.symbol} {row.tier}</div>
        <div style={{ color: "#94a3b8", fontWeight: 800, fontSize: 12 }}>{row.name || "--"}</div>
      </div>
      <strong style={{ color: Number(row.discount || 0) < 0 ? "#fca5a5" : "#cbd5e1" }}>{fmtPct(row.discount)}</strong>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
      <Metric label="現價" value={fmtUsd(row.price, 4)} />
      <Metric label="高點" value={fmtUsd(row.high || row.cycleHigh, 2)} />
    </div>
    <LayerRules rules={row.rules || []} amounts={row.amounts || []} activeTier={row.tier} />
    {children}
  </article>;
}

function Metric({ label, value }) {
  return <div style={{ padding: 10, borderRadius: 12, background: "#020617" }}>
    <div style={{ color: "#94a3b8", fontWeight: 850, fontSize: 12 }}>{label}</div>
    <strong style={{ display: "block", marginTop: 4, fontSize: 16 }}>{value}</strong>
  </div>;
}

function Section({ title, count, rows, empty, render }) {
  return <section style={{ marginTop: 14, padding: 12, borderRadius: 18, background: "rgba(2,6,23,.9)", border: "1px solid rgba(148,163,184,.18)" }}>
    <h2 style={{ margin: "0 0 10px", fontSize: 20, color: "#facc15" }}>{title}（{count}）</h2>
    {rows.length ? <div style={{ display: "grid", gap: 12 }}>{rows.map(render)}</div> : <div style={{ padding: "26px 0", textAlign: "center", color: "#94a3b8", fontWeight: 900 }}>{empty}</div>}
  </section>;
}

export default function V17Dashboard() {
  const [assets, setAssets] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [ledger, setLedger] = useState({});
  const [wallet, setWallet] = useState(null);
  const [updatedAt, setUpdatedAt] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const prices = await jsonFetch(`/api/prices?t=${Date.now()}`);
      const rows = Array.isArray(prices.data) ? prices.data : [];
      const ledgerData = await jsonFetch(`/api/buy-ledger?t=${Date.now()}`);
      const walletData = await jsonFetch(`/api/sync-wallet?t=${Date.now()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }).catch(() => null);
      const today = await jsonFetch(`/api/v17/ui-decisions?t=${Date.now()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markets: marketMapFromRows(rows), persistState: true })
      });
      setAssets(rows);
      setLedger(ledgerData.ledger || {});
      setWallet(walletData);
      setDecisions(today.cards || []);
      setUpdatedAt(prices.updatedAt || today.updatedAt || new Date().toISOString());
      setError("");
    } catch (err) {
      setError(err.message || "V17 讀取失敗");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  const classified = useMemo(() => classifyUniverse({
    assets,
    ledger,
    holdings: wallet?.holdings || [],
    decisions
  }), [assets, ledger, wallet, decisions]);

  return <main style={{ minHeight: "100vh", padding: 14, background: "#020617", color: "#f8fafc", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" }}>
    <header style={{ padding: "14px 10px", textAlign: "center" }}>
      <div style={{ textAlign: "right", color: "#facc15", fontSize: 11, fontWeight: 1000 }}>V17</div>
      <h1 style={{ margin: "4px 0", fontSize: 44, lineHeight: 1, color: "#fde68a" }}>折價獵人</h1>
      <div style={{ color: "#94a3b8", fontWeight: 850 }}>State Machine Dashboard｜{loading ? "更新中" : "LIVE"}｜{timeText(updatedAt)}</div>
      {error && <div style={{ marginTop: 10, padding: 10, borderRadius: 12, color: "#fecaca", background: "rgba(127,29,29,.35)", fontWeight: 900 }}>{error}</div>}
    </header>

    <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
      <Metric label="Universe" value={classified.summary.universeCount} />
      <Metric label="Visible" value={classified.summary.visibleUniqueCount} />
      <Metric label="Decision" value={classified.summary.decisionCount} />
      <Metric label="Holding Zone" value={classified.summary.holdingCount} />
    </section>

    <Section title="今日決策" count={classified.decisionRows.length} rows={classified.decisionRows} empty="暫無 D1-D4 待處理買點" render={(row) => <Card key={`decision-${row.symbol}`} row={row}>
      <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: "rgba(245,158,11,.12)", color: "#fde68a", fontWeight: 900 }}>待處理：{row.decision?.statusLabel || row.decision?.status || "queued"}｜建議 {row.decision?.amountText || fmtAmount(row.decision?.amount)}</div>
    </Card>} />

    <Section title="持倉中買點區間" count={classified.holdingRows.length} rows={classified.holdingRows} empty="目前沒有 D1-D4 區間內的持倉" render={(row) => <Card key={`holding-${row.symbol}`} row={row}>
      <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: "rgba(34,197,94,.10)", color: "#bbf7d0", fontWeight: 900 }}>已買層級：{row.ledgerDoneTiers?.length ? row.ledgerDoneTiers.join(" / ") : "鏈上持倉"}</div>
    </Card>} />

    <Section title="觀察區 D0" count={classified.watchRows.length} rows={classified.watchRows} empty="目前沒有 D0 觀察標的" render={(row) => <Card key={`watch-${row.symbol}`} row={row} />} />

    {!classified.ok && <section style={{ marginTop: 14, padding: 12, borderRadius: 14, background: "rgba(127,29,29,.35)", color: "#fecaca", fontWeight: 900 }}>
      V17 內部分類異常：missing {classified.summary.missingSymbols.join(", ") || "none"} / extra {classified.summary.extraSymbols.join(", ") || "none"}
    </section>}
  </main>;
}
