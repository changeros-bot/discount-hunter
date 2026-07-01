import { useEffect, useMemo, useState } from "react";
import { classifyUniverse } from "../lib/v17-state-classifier";
import { AssetCard, fmtAmount, Metric, PageShell, Section, TierProgress } from "../components/v17-dashboard-ui";

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

function tierStatusText(row) {
  if (row.skippedTiers?.includes(row.tier)) return `已略過：${row.tier}`;
  const done = row.ledgerDoneTiers?.length ? row.ledgerDoneTiers.join(" / ") : row.tier;
  return `已完成：${done}`;
}

function tierStatusStyle(row) {
  if (row.skippedTiers?.includes(row.tier)) {
    return { background: "rgba(51,65,85,.55)", color: "#cbd5e1", border: "1px solid rgba(148,163,184,.24)" };
  }
  return { background: "rgba(34,197,94,.10)", color: "#bbf7d0", border: "1px solid rgba(34,197,94,.12)" };
}

function watchStatusStyle() {
  return { background: "rgba(14,165,233,.10)", color: "#bae6fd", border: "1px solid rgba(14,165,233,.18)" };
}

function decisionStatusStyle() {
  return { background: "rgba(245,158,11,.12)", color: "#fde68a", border: "1px solid rgba(245,158,11,.24)" };
}

function DecisionActions({ row, onAction, busy }) {
  const decision = row.decision || {};
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
    <button disabled={busy} onClick={() => onAction(row, "complete")} style={{ padding: "10px 8px", borderRadius: 12, border: "1px solid rgba(34,197,94,.45)", background: "rgba(34,197,94,.16)", color: "#bbf7d0", fontWeight: 1000 }}>已完成</button>
    <button disabled={busy} onClick={() => onAction(row, "skip")} style={{ padding: "10px 8px", borderRadius: 12, border: "1px solid rgba(250,204,21,.45)", background: "rgba(250,204,21,.13)", color: "#fde68a", fontWeight: 1000 }}>略過本層</button>
    <div style={{ gridColumn: "1 / -1", color: "#94a3b8", fontSize: 12, fontWeight: 850 }}>Action：{decision.tier || row.tier}｜{decision.amountText || fmtAmount(decision.amount)}</div>
  </div>;
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
  return <details style={{ marginTop: 16, padding: 12, borderRadius: 16, background: "linear-gradient(135deg, rgba(30,41,59,.88), rgba(15,23,42,.94))", border: `1px solid ${color}` }}>
    <summary style={{ color, fontWeight: 1000, fontSize: 16 }}>📘 State Machine｜{status}｜U{classified.summary.universeCount} D{classified.summary.decisionCount} H{classified.summary.holdingCount} W{classified.summary.watchCount}</summary>
    <div style={{ marginTop: 8, display: "grid", gap: 6, color: "#cbd5e1", fontWeight: 850, fontSize: 12 }}>
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
    const id = `${row.symbol}-${row.tier}-${action}`;
    setActionBusy(id);
    try {
      await jsonFetch("/api/v17/action-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, symbol: row.symbol, layer: decision.level || row.signalLevel, amount: decision.amount, price: row.price })
      });
      await load();
    } catch (err) { setError(err.message || "Action failed"); } finally { setActionBusy(""); }
  }

  useEffect(() => { load(); const timer = setInterval(load, REFRESH_MS); return () => clearInterval(timer); }, []);

  const classified = useMemo(() => classifyUniverse({ assets, ledger, holdings: wallet?.holdings || [], decisions, states: decisionStates }), [assets, ledger, wallet, decisions, decisionStates]);
  const ws = walletSummary(wallet?.holdings || []);
  const ledgerStatus = classified.summary.duplicateSymbols.length || classified.summary.missingSymbols.length ? "CHECK" : "PASS";

  return <PageShell loading={loading} updatedAt={updatedAt} error={error}>
    <Section title="今日決策" count={classified.decisionRows.length} rows={classified.decisionRows} empty="已略過目前所有可執行買點，等待下一層" render={(row) => <AssetCard key={`decision-${row.symbol}`} row={row}><div style={{ marginTop: 10, padding: 10, borderRadius: 12, fontWeight: 900, ...decisionStatusStyle() }}>待處理：{row.decision?.statusLabel || row.decision?.status || row.tier}｜建議 {row.decision?.amountText || fmtAmount(row.decision?.amount)}</div><TierProgress row={row} /><DecisionActions row={row} onAction={handleDecisionAction} busy={Boolean(actionBusy)} /></AssetCard>} />
    <section style={{ margin: "12px 0 16px", padding: 12, background: "#020617", borderRadius: 16, border: "1px solid rgba(34,197,94,.75)" }}>
      <h2 style={{ fontSize: 19, fontWeight: 950, color: "#4ade80", margin: 0 }}>鏈上持倉</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}><Metric label="持倉成本" value={usd(ws.cost)} /><Metric label="持倉市值" value={usd(ws.value)} /><Metric label="未實現損益" value={signedUsd(ws.pnl)} signed={ws.pnl} /><Metric label="報酬率" value={signedPct(ws.pnlPct)} signed={ws.pnlPct} /></div>
    </section>
    <Collapsible title="✅ 持倉區" count={classified.holdingRows.length} rows={classified.holdingRows} open render={(row) => <AssetCard key={`holding-${row.symbol}`} row={row}><div style={{ marginTop: 10, padding: 10, borderRadius: 12, fontWeight: 900, ...tierStatusStyle(row) }}>{tierStatusText(row)}</div><TierProgress row={row} /></AssetCard>} />
    <Collapsible title="📋 觀察區" count={classified.watchRows.length} rows={classified.watchRows} render={(row) => <AssetCard key={`watch-${row.symbol}`} row={row}><div style={{ marginTop: 10, padding: 10, borderRadius: 12, fontWeight: 900, ...watchStatusStyle() }}>等待進入 D1</div><TierProgress row={row} /></AssetCard>} />
    <StateMachineCheck classified={classified} />
    <footer style={{ marginTop: 12, padding: "9px 10px", background: "#020617", borderRadius: 14, color: "#94a3b8", fontSize: 11, fontWeight: 850, lineHeight: 1.35 }}>Market：{source || "--"}｜Wallet：{wallet ? "LIVE" : "WAIT"}｜Ledger：{ledgerStatus}</footer>
  </PageShell>;
}
