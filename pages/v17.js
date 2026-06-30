import { useEffect, useMemo, useState } from "react";
import { classifyUniverse } from "../lib/v17-state-classifier";
import { AssetCard, fmtAmount, HoldingMetrics, Metric, PageShell, Section } from "../components/v17-dashboard-ui";

const REFRESH_MS = 10000;

async function jsonFetch(url, options = {}) {
  const res = await fetch(url, { cache: "no-store", ...options });
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.ok === false) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
  return data;
}

function marketMapFromRows(rows = []) {
  return Object.fromEntries((rows || []).map((row) => [row.symbol, { symbol: row.symbol, price: row.price, high: row.high, high52w: row.high52w, cycleHigh: row.high || row.cycleHigh || row.high52w, discount: row.discount }]));
}

function usd(value) { const n = Number(value || 0); return `$${n.toFixed(2)}`; }
function signedUsd(value) { const n = Number(value || 0); return `${n > 0 ? "+" : n < 0 ? "-" : ""}$${Math.abs(n).toFixed(2)}`; }
function signedPct(value) { const n = Number(value || 0) * 100; return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`; }
function walletSummary(holdings = []) {
  const live = (holdings || []).filter((h) => Number(h.quantity) > 0);
  const cost = live.reduce((s, h) => s + Number(h.totalCost || 0), 0);
  const value = live.reduce((s, h) => s + Number(h.currentValue || 0), 0);
  const pnl = value - cost;
  return { cost, value, pnl, pnlPct: cost > 0 ? pnl / cost : 0 };
}

function Collapsible({ title, count, rows, render, open = false }) {
  return <details style={{ marginTop: 16, padding: 14, borderRadius: 16, background: "linear-gradient(135deg, rgba(30,41,59,.92), rgba(15,23,42,.96))", border: "1px solid rgba(243,186,47,.22)" }} open={open}>
    <summary style={{ color: "#e2e8f0", fontWeight: 1000, fontSize: 19 }}>{title}（{count}）</summary>
    <section style={{ marginTop: 12, display: "grid", gap: 12 }}>{rows.map(render)}</section>
  </details>;
}

function StateMachineCheck({ classified }) {
  const status = classified.ok ? "PASS" : "CHECK";
  const color = classified.ok ? "#22c55e" : "#f59e0b";
  return <details style={{ marginTop: 16, padding: 14, borderRadius: 16, background: "linear-gradient(135deg, rgba(30,41,59,.92), rgba(15,23,42,.96))", border: `1px solid ${color}` }}>
    <summary style={{ color, fontWeight: 1000, fontSize: 19 }}>📘 V17 State Machine｜{status}</summary>
    <div style={{ marginTop: 10, display: "grid", gap: 8, color: "#cbd5e1", fontWeight: 850, fontSize: 13 }}>
      <div>Universe：{classified.summary.universeCount}｜Decision：{classified.summary.decisionCount}｜Holding：{classified.summary.holdingCount}｜Watch：{classified.summary.watchCount}</div>
      <div>Missing：{classified.summary.missingSymbols.join(", ") || "none"}</div>
      <div>Duplicate：{classified.summary.duplicateSymbols.join(", ") || "none"}</div>
    </div>
  </details>;
}

export default function V17Dashboard() {
  const [assets, setAssets] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [ledger, setLedger] = useState({});
  const [wallet, setWallet] = useState(null);
  const [source, setSource] = useState("Binance xStocks public API");
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
      const today = await jsonFetch(`/api/v17/ui-decisions?t=${Date.now()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ markets: marketMapFromRows(rows), persistState: true }) });
      setAssets(rows); setLedger(ledgerData.ledger || {}); setWallet(walletData); setDecisions(today.cards || []);
      setUpdatedAt(prices.updatedAt || today.updatedAt || new Date().toISOString()); setSource(prices.source || "Binance xStocks public API"); setError("");
    } catch (err) { setError(err.message || "V17 讀取失敗"); } finally { setLoading(false); }
  }

  useEffect(() => { load(); const timer = setInterval(load, REFRESH_MS); return () => clearInterval(timer); }, []);

  const classified = useMemo(() => classifyUniverse({ assets, ledger, holdings: wallet?.holdings || [], decisions }), [assets, ledger, wallet, decisions]);
  const ws = walletSummary(wallet?.holdings || []);
  const ledgerStatus = classified.summary.duplicateSymbols.length || classified.summary.missingSymbols.length ? "CHECK" : "PASS";

  return <PageShell loading={loading} updatedAt={updatedAt} error={error}>
    <Section title="今日決策" count={classified.decisionRows.length} rows={classified.decisionRows} empty="暫無待執行買點" render={(row) => <AssetCard key={`decision-${row.symbol}`} row={row}><div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: "rgba(245,158,11,.12)", color: "#fde68a", fontWeight: 900 }}>待處理：{row.decision?.statusLabel || row.decision?.status || "queued"}｜建議 {row.decision?.amountText || fmtAmount(row.decision?.amount)}</div></AssetCard>} />
    <section style={{ margin: "12px 0 16px", padding: 12, background: "#020617", borderRadius: 16, border: "1px solid rgba(34,197,94,.75)" }}>
      <h2 style={{ fontSize: 19, fontWeight: 950, color: "#4ade80", margin: 0 }}>鏈上持倉</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}><Metric label="持倉成本" value={usd(ws.cost)} /><Metric label="持倉市值" value={usd(ws.value)} /><Metric label="未實現損益" value={signedUsd(ws.pnl)} signed={ws.pnl} /><Metric label="報酬率" value={signedPct(ws.pnlPct)} signed={ws.pnlPct} /></div>
    </section>
    <Collapsible title="✅ 持倉區" count={classified.holdingRows.length} rows={classified.holdingRows} open render={(row) => <AssetCard key={`holding-${row.symbol}`} row={row}><HoldingMetrics holding={row.walletHolding} /><div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: "rgba(34,197,94,.10)", color: "#bbf7d0", fontWeight: 900 }}>已買層級：{row.ledgerDoneTiers?.length ? row.ledgerDoneTiers.join(" / ") : "鏈上持倉"}</div></AssetCard>} />
    <Collapsible title="📋 觀察區" count={classified.watchRows.length} rows={classified.watchRows} render={(row) => <AssetCard key={`watch-${row.symbol}`} row={row} />} />
    <StateMachineCheck classified={classified} />
    <footer style={{ marginTop: 18, padding: 12, background: "#020617", borderRadius: 14, color: "#94a3b8", fontSize: 12, fontWeight: 850, lineHeight: 1.45 }}>Market：{source || "--"}｜Wallet：{wallet ? "LIVE" : "等待同步"}｜Ledger：{ledgerStatus}｜V17 Exclusive State Machine</footer>
  </PageShell>;
}
