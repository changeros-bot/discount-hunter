import { useEffect, useMemo, useState } from "react";
import { classifyUniverse } from "../lib/v17-state-classifier";
import { AssetCard, fmtAmount, Metric, PageShell, Section } from "../components/v17-mobile-ui";

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

function DecisionActions({ row, onAction, busy }) {
  const decision = row.decision || {};
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
    <button disabled={busy} onClick={() => onAction(row, "complete")} style={{ padding: "10px 8px", borderRadius: 14, border: "1px solid rgba(53,245,154,.42)", background: "rgba(53,245,154,.12)", color: "#bbf7d0", fontWeight: 1000 }}>已完成</button>
    <button disabled={busy} onClick={() => onAction(row, "skip")} style={{ padding: "10px 8px", borderRadius: 14, border: "1px solid rgba(49,231,255,.30)", background: "rgba(49,231,255,.10)", color: "#bae6fd", fontWeight: 1000 }}>略過本層</button>
    <div style={{ gridColumn: "1 / -1", color: "#7dd3fc", fontSize: 12, fontWeight: 850 }}>ACTION：{decision.tier || row.tier}｜{decision.amountText || fmtAmount(decision.amount)}</div>
  </div>;
}

function Collapsible({ title, count, rows, render, open = false }) {
  return <details style={{ marginTop: 16, padding: 12, borderRadius: 24, background: "rgba(5,11,24,.72)", border: "1px solid rgba(49,231,255,.16)", boxShadow: "0 0 32px rgba(49,231,255,.06)" }} open={open}>
    <summary style={{ color: "#e0fbff", fontWeight: 1000, fontSize: 19 }}>{title}（{count}）</summary>
    <section style={{ marginTop: 12, display: "grid", gap: 12 }}>{rows.map(render)}</section>
  </details>;
}

function StateMachineCheck({ classified }) {
  const status = classified.ok ? "PASS" : "CHECK";
  const color = classified.ok ? "#35f59a" : "#ffc857";
  return <details style={{ marginTop: 16, padding: 14, borderRadius: 24, background: "rgba(5,11,24,.72)", border: `1px solid ${color}55` }}>
    <summary style={{ color, fontWeight: 1000, fontSize: 18 }}>SYSTEM STATE｜{status}</summary>
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
  const [decisionStates, setDecisionStates] = useState([]);
  const [ledger, setLedger] = useState({});
  const [wallet, setWallet] = useState(null);
  const [source, setSource] = useState("Binance xStocks public API");
  const [updatedAt, setUpdatedAt] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState("");

  async function load() {
    setLoading(true);
    try {
      const prices = await jsonFetch(`/api/prices?t=${Date.now()}`);
      const rows = Array.isArray(prices.data) ? prices.data : [];
      const ledgerData = await jsonFetch(`/api/buy-ledger?t=${Date.now()}`);
      const walletData = await jsonFetch(`/api/sync-wallet?t=${Date.now()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }).catch(() => null);
      const today = await jsonFetch(`/api/v17/ui-decisions?t=${Date.now()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ markets: marketMapFromRows(rows), persistState: true }) });
      setAssets(rows); setLedger(ledgerData.ledger || {}); setWallet(walletData); setDecisions(today.cards || []); setDecisionStates(today.states || []);
      setUpdatedAt(prices.updatedAt || today.updatedAt || new Date().toISOString()); setSource(prices.source || "Binance xStocks public API"); setError("");
    } catch (err) { setError(err.message || "V17 讀取失敗"); } finally { setLoading(false); }
  }

  async function handleDecisionAction(row, action) {
    const decision = row.decision || {};
    setActionBusy(`${row.symbol}-${row.tier}-${action}`);
    try {
      await jsonFetch("/api/v17/action-event", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, symbol: row.symbol, layer: decision.level || row.signalLevel, amount: decision.amount, price: row.price }) });
      await load();
    } catch (err) { setError(err.message || "Action failed"); } finally { setActionBusy(""); }
  }

  useEffect(() => { load(); const timer = setInterval(load, REFRESH_MS); return () => clearInterval(timer); }, []);

  const classified = useMemo(() => classifyUniverse({ assets, ledger, holdings: wallet?.holdings || [], decisions, states: decisionStates }), [assets, ledger, wallet, decisions, decisionStates]);
  const ws = walletSummary(wallet?.holdings || []);
  const ledgerStatus = classified.summary.duplicateSymbols.length || classified.summary.missingSymbols.length ? "CHECK" : "PASS";

  return <PageShell loading={loading} updatedAt={updatedAt} error={error}>
    <Section title="今日決策" count={classified.decisionRows.length} rows={classified.decisionRows} empty="已略過目前所有可執行買點，等待下一層" render={(row) => <AssetCard key={`decision-${row.symbol}`} row={row}><DecisionActions row={row} onAction={handleDecisionAction} busy={Boolean(actionBusy)} /></AssetCard>} />
    <section style={{ margin: "12px 0 16px", padding: 12, background: "rgba(5,11,24,.72)", borderRadius: 24, border: "1px solid rgba(53,245,154,.30)" }}>
      <h2 style={{ fontSize: 18, fontWeight: 1000, color: "#bbf7d0", margin: 0 }}>鏈上持倉</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}><Metric label="成本" value={usd(ws.cost)} /><Metric label="市值" value={usd(ws.value)} /><Metric label="未實現" value={signedUsd(ws.pnl)} signed={ws.pnl} /><Metric label="報酬率" value={signedPct(ws.pnlPct)} signed={ws.pnlPct} /></div>
    </section>
    <Collapsible title="持倉區" count={classified.holdingRows.length} rows={classified.holdingRows} open render={(row) => <AssetCard key={`holding-${row.symbol}`} row={row} />} />
    <Collapsible title="觀察區" count={classified.watchRows.length} rows={classified.watchRows} render={(row) => <AssetCard key={`watch-${row.symbol}`} row={row} />} />
    <StateMachineCheck classified={classified} />
    <footer style={{ marginTop: 18, padding: 13, background: "rgba(5,11,24,.78)", border: "1px solid rgba(49,231,255,.14)", borderRadius: 18, color: "#94a3b8", fontSize: 12, fontWeight: 900, lineHeight: 1.55 }}>SYSTEM｜Market：{source || "--"}｜Wallet：{wallet ? "LIVE" : "WAIT"}｜Ledger：{ledgerStatus}｜V17</footer>
  </PageShell>;
}
