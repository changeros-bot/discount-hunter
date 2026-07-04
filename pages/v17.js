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
  return Object.fromEntries((rows || []).map((row) => [row.symbol, {
    symbol: row.symbol,
    price: row.price,
    high: row.high,
    high52w: row.high52w,
    cycleHigh: row.high || row.cycleHigh || row.high52w,
    discount: row.discount
  }]));
}
function btcPriceFromRows(rows = []) {
  const btc = (rows || []).find((row) => String(row.symbol || "").toUpperCase() === "BTC");
  return Number(btc?.price || 0);
}
function mergeHoldingsBySymbol(...groups) {
  const map = new Map();
  for (const group of groups || []) {
    for (const holding of group || []) {
      const symbol = String(holding?.symbol || "").toUpperCase();
      if (symbol && Number(holding.quantity || 0) > 0) map.set(symbol, holding);
    }
  }
  return [...map.values()];
}
function withStrictRealPositions({ walletData, exchangeData }) {
  const base = walletData || { ok: true, holdings: [] };
  const walletHoldings = Array.isArray(base.holdings) ? base.holdings : [];
  const exchangeHoldings = Array.isArray(exchangeData?.holdings) ? exchangeData.holdings : [];
  return {
    ...base,
    holdings: mergeHoldingsBySymbol(walletHoldings, exchangeHoldings),
    btcPositionSource: exchangeHoldings.some((h) => String(h.symbol || "").toUpperCase() === "BTC" && Number(h.quantity) > 0)
      ? "binance_exchange_readonly"
      : "not_available_no_manual_fallback",
    binanceExchange: exchangeData || { ok: false, configured: false },
    strictRealPositionMode: true
  };
}
function usd(value) { const n = Number(value || 0); return `$${n.toFixed(2)}`; }
function signedUsd(value) { const n = Number(value || 0); return `${n > 0 ? "+" : n < 0 ? "-" : ""}$${Math.abs(n).toFixed(2)}`; }
function signedPct(value) { const n = Number(value || 0) * 100; return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`; }
function walletSummary(holdings = []) {
  const live = (holdings || []).filter((h) => Number(h.quantity) > 0);
  const known = live.filter((h) => Number(h.totalCost || 0) > 0 && !h.costBasisMissing);
  const missing = live.filter((h) => !(Number(h.totalCost || 0) > 0 && !h.costBasisMissing));
  const knownCost = known.reduce((s, h) => s + Number(h.totalCost || 0), 0);
  const knownValue = known.reduce((s, h) => s + Number(h.currentValue || h.marketValue || 0), 0);
  const totalValue = live.reduce((s, h) => s + Number(h.currentValue || h.marketValue || 0), 0);
  const missingValue = missing.reduce((s, h) => s + Number(h.currentValue || h.marketValue || 0), 0);
  const pnl = knownCost > 0 ? knownValue - knownCost : null;
  return { knownCost, knownValue, totalValue, missingValue, pnl, pnlPct: knownCost > 0 ? pnl / knownCost : null, costMissingCount: missing.length };
}
function statusTone(status) {
  if (["PASS", "PASS_API_SYNCED"].includes(status)) return { color: "#bbf7d0", bg: "rgba(34,197,94,.12)", border: "rgba(34,197,94,.28)" };
  if (["PARTIAL_API_QUANTITY_ONLY", "MISSING_API_COST", "CHECKING"].includes(status)) return { color: "#fde68a", bg: "rgba(245,158,11,.12)", border: "rgba(245,158,11,.28)" };
  return { color: "#fca5a5", bg: "rgba(239,68,68,.12)", border: "rgba(239,68,68,.28)" };
}
function AuditPill({ label, status }) {
  const t = statusTone(status);
  return <div style={{ padding: 10, borderRadius: 12, background: t.bg, border: `1px solid ${t.border}` }}>
    <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 850 }}>{label}</div>
    <div style={{ color: t.color, marginTop: 4, fontSize: 13, fontWeight: 1000 }}>{status || "loading"}</div>
  </div>;
}
function RealPositionAuditCard({ audit }) {
  if (!audit) return <section style={{ margin: "12px 0 16px", padding: 12, background: "rgba(15,23,42,.72)", borderRadius: 16, border: "1px solid rgba(148,163,184,.16)", color: "#94a3b8", fontWeight: 850 }}>Real Position Audit 載入中...</section>;
  const btc = audit.btc || {};
  const xs = audit.xstocks || {};
  const tone = statusTone(audit.status);
  return <section style={{ margin: "12px 0 16px", padding: 12, background: "#020617", borderRadius: 16, border: "1px solid rgba(56,189,248,.55)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
      <h2 style={{ fontSize: 19, fontWeight: 950, color: "#7dd3fc", margin: 0 }}>Real Position Audit</h2>
      <span style={{ color: tone.color, border: `1px solid ${tone.border}`, background: tone.bg, padding: "6px 9px", borderRadius: 999, fontSize: 12, fontWeight: 1000 }}>{audit.status}</span>
    </div>
    <div style={{ marginTop: 6, color: "#94a3b8", fontSize: 12, fontWeight: 850 }}>只同步 API；不估算、不截圖 fallback、不補 5U 成本。</div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
      <AuditPill label="BTC 數量" status={btc.quantityStatus} />
      <AuditPill label="BTC 成本" status={btc.costStatus} />
      <AuditPill label="xStocks 數量" status={xs.quantityStatus} />
      <AuditPill label="xStocks 成本" status={xs.costStatus} />
    </div>
    <div style={{ marginTop: 10, color: "#cbd5e1", fontSize: 12, lineHeight: 1.55, fontWeight: 800 }}>
      BTC：{btc.quantity ? `${btc.quantity} BTC｜市值 ${usd(btc.marketValue)}` : btc.message || "loading"}<br />
      xStocks：鏈上持倉 {xs.liveBalanceCount || 0} 檔｜缺成本 {xs.missingCostCount || 0} 檔｜{xs.message || ""}
    </div>
  </section>;
}
function tierStatusText(row) {
  if (row.skippedTiers?.includes(row.tier)) return `已略過：${row.tier}`;
  const done = row.ledgerDoneTiers?.length ? row.ledgerDoneTiers.join(" / ") : row.tier;
  return `已完成：${done}`;
}
function tierStatusStyle(row) {
  if (row.skippedTiers?.includes(row.tier)) return { background: "rgba(51,65,85,.55)", color: "#cbd5e1", border: "1px solid rgba(148,163,184,.24)" };
  return { background: "rgba(34,197,94,.10)", color: "#bbf7d0", border: "1px solid rgba(34,197,94,.12)" };
}
function watchStatusStyle() { return { background: "rgba(14,165,233,.10)", color: "#bae6fd", border: "1px solid rgba(14,165,233,.18)" }; }
function decisionStatusStyle() { return { background: "rgba(245,158,11,.12)", color: "#fde68a", border: "1px solid rgba(245,158,11,.24)" }; }
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
    <div style={{ marginTop: 8, display: "grid", gap: 6, color: "#cbd5e1", fontWeight: 850, fontSize: 12 }}><div>Missing：{classified.summary.missingSymbols.join(", ") || "none"}</div><div>Duplicate：{classified.summary.duplicateSymbols.join(", ") || "none"}</div></div>
  </details>;
}

export default function V17Dashboard() {
  const [assets, setAssets] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [decisionStates, setDecisionStates] = useState([]);
  const [ledger, setLedger] = useState({});
  const [wallet, setWallet] = useState(null);
  const [audit, setAudit] = useState(null);
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
      const walletRaw = await jsonFetch(`/api/sync-wallet?t=${Date.now()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }).catch(() => null);
      const btcPrice = btcPriceFromRows(rows);
      const exchangeData = await jsonFetch(`/api/binance-exchange-position?btcPrice=${encodeURIComponent(btcPrice)}&t=${Date.now()}`).catch(() => null);
      const auditData = await jsonFetch(`/api/v17/real-position-audit?t=${Date.now()}`).catch(() => null);
      const walletData = withStrictRealPositions({ walletData: walletRaw, exchangeData });
      const today = await jsonFetch(`/api/v17/ui-decisions?t=${Date.now()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ markets: marketMapFromRows(rows), persistState: true }) });
      setAssets(rows);
      setLedger(ledgerData.ledger || {});
      setWallet(walletData);
      setAudit(auditData);
      setDecisions(today.cards || []);
      setDecisionStates(today.states || []);
      setUpdatedAt(prices.updatedAt || today.updatedAt || new Date().toISOString());
      setSource(prices.source || "Binance xStocks public API");
      setError("");
    } catch (err) {
      setError(err.message || "V17 讀取失敗");
    } finally {
      setLoading(false);
    }
  }

  async function handleDecisionAction(row, action) {
    const decision = row.decision || {};
    const id = `${row.symbol}-${row.tier}-${action}`;
    setActionBusy(id);
    try {
      await jsonFetch("/api/v17/action-event", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, symbol: row.symbol, layer: decision.level || row.signalLevel, amount: decision.amount, price: row.price }) });
      await load();
    } catch (err) {
      setError(err.message || "Action failed");
    } finally {
      setActionBusy("");
    }
  }

  useEffect(() => { load(); const timer = setInterval(load, REFRESH_MS); return () => clearInterval(timer); }, []);
  const classified = useMemo(() => classifyUniverse({ assets, ledger, holdings: wallet?.holdings || [], decisions, states: decisionStates }), [assets, ledger, wallet, decisions, decisionStates]);
  const ws = walletSummary(wallet?.holdings || []);
  const ledgerStatus = classified.summary.duplicateSymbols.length || classified.summary.missingSymbols.length ? "CHECK" : "PASS";

  return <PageShell loading={loading} updatedAt={updatedAt} error={error}>
    <Section title="今日決策" count={classified.decisionRows.length} rows={classified.decisionRows} empty="已略過目前所有可執行買點，等待下一層" render={(row) => <AssetCard key={`decision-${row.symbol}`} row={row}><div style={{ marginTop: 10, padding: 10, borderRadius: 12, fontWeight: 900, ...decisionStatusStyle() }}>待處理：{row.decision?.statusLabel || row.decision?.status || row.tier}｜建議 {row.decision?.amountText || fmtAmount(row.decision?.amount)}</div><TierProgress row={row} /><DecisionActions row={row} onAction={handleDecisionAction} busy={Boolean(actionBusy)} /></AssetCard>} />
    <RealPositionAuditCard audit={audit} />
    <section style={{ margin: "12px 0 16px", padding: 12, background: "#020617", borderRadius: 16, border: "1px solid rgba(34,197,94,.75)" }}>
      <h2 style={{ fontSize: 19, fontWeight: 950, color: "#4ade80", margin: 0 }}>真實持倉</h2>
      <div style={{ marginTop: 6, color: "#94a3b8", fontSize: 12, fontWeight: 850 }}>xStocks：BNB Chain balanceOf()｜BTC：Binance read-only；不估算、不截圖 fallback。</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
        <Metric label="已知成本" value={usd(ws.knownCost)} />
        <Metric label="總市值" value={usd(ws.totalValue)} />
        <Metric label="已知成本PnL" value={ws.pnl === null ? "N/A" : signedUsd(ws.pnl)} signed={ws.pnl || 0} />
        <Metric label="已知成本報酬" value={ws.pnlPct === null ? "N/A" : signedPct(ws.pnlPct)} signed={ws.pnlPct || 0} />
      </div>
      {ws.costMissingCount > 0 ? <div style={{ marginTop: 10, padding: 10, borderRadius: 12, color: "#fde68a", background: "rgba(245,158,11,.12)", border: "1px solid rgba(245,158,11,.24)", fontSize: 12, fontWeight: 850 }}>有 {ws.costMissingCount} 筆持倉缺少真實成本，缺成本市值 {usd(ws.missingValue)} 只列入總市值，不列入 PnL / 報酬率。</div> : null}
      {wallet?.btcPositionSource === "not_available_no_manual_fallback" ? <div style={{ marginTop: 8, padding: 10, borderRadius: 12, color: "#bae6fd", background: "rgba(14,165,233,.10)", border: "1px solid rgba(14,165,233,.18)", fontSize: 12, fontWeight: 850 }}>BTC 持倉未顯示：未接到 Binance read-only；已移除手動截圖 fallback。</div> : null}
    </section>
    <Collapsible title="✅ 持倉區" count={classified.holdingRows.length} rows={classified.holdingRows} open render={(row) => <AssetCard key={`holding-${row.symbol}`} row={row}><div style={{ marginTop: 10, padding: 10, borderRadius: 12, fontWeight: 900, ...tierStatusStyle(row) }}>{tierStatusText(row)}</div><TierProgress row={row} /></AssetCard>} />
    <Collapsible title="👀 觀察區" count={classified.watchRows.length} rows={classified.watchRows} render={(row) => <AssetCard key={`watch-${row.symbol}`} row={row}><div style={{ marginTop: 10, padding: 10, borderRadius: 12, fontWeight: 900, ...watchStatusStyle() }}>觀察中：尚未到第一買點</div><TierProgress row={row} /></AssetCard>} />
    <StateMachineCheck classified={classified} />
    <details style={{ marginTop: 14, padding: 12, borderRadius: 14, color: "#94a3b8", background: "rgba(15,23,42,.72)", border: "1px solid rgba(148,163,184,.16)" }}><summary style={{ fontWeight: 1000 }}>系統資訊｜{source}｜Ledger {ledgerStatus}</summary><div style={{ marginTop: 8, display: "grid", gap: 4, fontSize: 12 }}><div>Universe：BTC + QQQon + NVDAon + TSMon + AVGOon + SPCXon + GOOGLon + AMDon + MRVLon + RKLBon</div><div>Wallet Source：{wallet?.source || "loading"}</div><div>Wallet Sync：{wallet?.walletSyncSource || "strict real position mode"}</div><div>BTC Source：{wallet?.btcPositionSource || "loading"}</div><div>Audit：{audit?.status || "loading"}</div><div>Strict Mode：no manual BTC fallback / no fake 5U cost</div><div>Last Sync：{wallet?.lastSyncTime || updatedAt}</div></div></details>
  </PageShell>;
}
