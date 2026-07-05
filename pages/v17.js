import { useEffect, useMemo, useState } from "react";
import { classifyUniverse } from "../lib/v17-state-classifier";
import { AssetCard, fmtAmount, Metric, PageShell, Section, TierProgress } from "../components/v17-dashboard-ui";

const REFRESH_MS = 60000;
const CACHE_KEY = "v17-fast-open-cache";

async function jsonFetch(url, options = {}) {
  const res = await fetch(url, { cache: "no-store", ...options });
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.ok === false) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
  return data;
}

function readFastCache() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function writeFastCache(payload) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(CACHE_KEY, JSON.stringify({ ...payload, cachedAt: new Date().toISOString() })); }
  catch {}
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
  const [source, setSource] = useState("Binance xStocks public API");
  const [updatedAt, setUpdatedAt] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState("");
  const [hydratedFromCache, setHydratedFromCache] = useState(false);

  function applySnapshot(snapshot) {
    if (!snapshot) return;
    setAssets(snapshot.assets || []);
    setLedger(snapshot.ledger || {});
    setWallet(snapshot.wallet || null);
    setDecisions(snapshot.decisions || []);
    setDecisionStates(snapshot.decisionStates || []);
    setUpdatedAt(snapshot.updatedAt || snapshot.cachedAt || "");
    setSource(snapshot.source || "Binance xStocks public API");
  }

  async function load({ silent = false } = {}) {
    if (!silent) setLoading(true);
    try {
      const prices = await jsonFetch(`/api/prices?t=${Date.now()}`);
      const rows = Array.isArray(prices.data) ? prices.data : [];
      const [ledgerData, today] = await Promise.all([
        jsonFetch(`/api/buy-ledger?t=${Date.now()}`),
        jsonFetch(`/api/v17/ui-decisions?t=${Date.now()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ markets: marketMapFromRows(rows), persistState: true }) })
      ]);

      setAssets(rows);
      setLedger(ledgerData.ledger || {});
      setDecisions(today.cards || []);
      setDecisionStates(today.states || []);
      setUpdatedAt(prices.updatedAt || today.updatedAt || new Date().toISOString());
      setSource(prices.source || "Binance xStocks public API");
      setError("");

      const btcPrice = btcPriceFromRows(rows);
      const [walletRaw, exchangeData] = await Promise.all([
        jsonFetch(`/api/sync-wallet?t=${Date.now()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }).catch(() => null),
        jsonFetch(`/api/binance-exchange-position?btcPrice=${encodeURIComponent(btcPrice)}&t=${Date.now()}`).catch(() => null)
      ]);
      const walletData = withStrictRealPositions({ walletData: walletRaw, exchangeData });
      setWallet(walletData);

      writeFastCache({
        assets: rows,
        ledger: ledgerData.ledger || {},
        wallet: walletData,
        decisions: today.cards || [],
        decisionStates: today.states || [],
        updatedAt: prices.updatedAt || today.updatedAt || new Date().toISOString(),
        source: prices.source || "Binance xStocks public API"
      });
    } catch (err) {
      setError(err.message || "V17 讀取失敗");
    } finally {
      if (!silent) setLoading(false);
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

  useEffect(() => {
    const cached = readFastCache();
    if (cached) { applySnapshot(cached); setHydratedFromCache(true); load({ silent: true }); }
    else load();
    const timer = setInterval(() => load({ silent: true }), REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  const classified = useMemo(() => classifyUniverse({ assets, ledger, holdings: wallet?.holdings || [], decisions, states: decisionStates }), [assets, ledger, wallet, decisions, decisionStates]);
  const ws = walletSummary(wallet?.holdings || []);
  const ledgerStatus = classified.summary.duplicateSymbols.length || classified.summary.missingSymbols.length ? "CHECK" : "PASS";

  return <PageShell loading={loading && !hydratedFromCache} updatedAt={updatedAt} error={error}>
    <Section title="今日決策" count={classified.decisionRows.length} rows={classified.decisionRows} empty="已略過目前所有可執行買點，等待下一層" render={(row) => <AssetCard key={`decision-${row.symbol}`} row={row}><div style={{ marginTop: 10, padding: 10, borderRadius: 12, fontWeight: 900, ...decisionStatusStyle() }}>待處理：{row.decision?.statusLabel || row.decision?.status || row.tier}｜建議 {row.decision?.amountText || fmtAmount(row.decision?.amount)}</div><TierProgress row={row} /><DecisionActions row={row} onAction={handleDecisionAction} busy={Boolean(actionBusy)} /></AssetCard>} />
    <section style={{ margin: "12px 0 16px", padding: 12, background: "#020617", borderRadius: 16, border: "1px solid rgba(34,197,94,.75)" }}>
      <h2 style={{ fontSize: 19, fontWeight: 950, color: "#4ade80", margin: 0 }}>真實持倉</h2>
      <div style={{ marginTop: 6, color: "#94a3b8", fontSize: 12, fontWeight: 850 }}>xStocks：BNB Chain balanceOf + NodeReal eth_getLogs｜BTC：Binance read-only。</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
        <Metric label="已知成本" value={usd(ws.knownCost)} />
        <Metric label="總市值" value={usd(ws.totalValue)} />
        <Metric label="已知成本PnL" value={ws.pnl === null ? "N/A" : signedUsd(ws.pnl)} signed={ws.pnl || 0} />
        <Metric label="已知成本報酬" value={ws.pnlPct === null ? "N/A" : signedPct(ws.pnlPct)} signed={ws.pnlPct || 0} />
      </div>
      {ws.costMissingCount > 0 ? <div style={{ marginTop: 10, padding: 10, borderRadius: 12, color: "#fde68a", background: "rgba(245,158,11,.12)", border: "1px solid rgba(245,158,11,.24)", fontSize: 12, fontWeight: 850 }}>有 {ws.costMissingCount} 筆持倉缺少真實成本，缺成本市值 {usd(ws.missingValue)} 只列入總市值，不列入 PnL / 報酬率。</div> : null}
    </section>
    <Collapsible title="✅ 持倉區" count={classified.holdingRows.length} rows={classified.holdingRows} open render={(row) => <AssetCard key={`holding-${row.symbol}`} row={row}><div style={{ marginTop: 10, padding: 10, borderRadius: 12, fontWeight: 900, ...tierStatusStyle(row) }}>{tierStatusText(row)}</div><TierProgress row={row} /></AssetCard>} />
    <Collapsible title="👀 觀察區" count={classified.watchRows.length} rows={classified.watchRows} render={(row) => <AssetCard key={`watch-${row.symbol}`} row={row}><div style={{ marginTop: 10, padding: 10, borderRadius: 12, fontWeight: 900, ...watchStatusStyle() }}>觀察中：尚未到第一買點</div><TierProgress row={row} /></AssetCard>} />
    <StateMachineCheck classified={classified} />
    <details style={{ marginTop: 14, padding: 12, borderRadius: 14, color: "#94a3b8", background: "rgba(15,23,42,.72)", border: "1px solid rgba(148,163,184,.16)" }}><summary style={{ fontWeight: 1000 }}>系統資訊｜{source}｜Ledger {ledgerStatus}</summary><div style={{ marginTop: 8, display: "grid", gap: 4, fontSize: 12 }}><div>Universe：BTC + QQQon + NVDAon + TSMon + AVGOon + SPCXon + GOOGLon + AMDon + MRVLon + RKLBon</div><div>Wallet Source：{wallet?.source || "cached / loading"}</div><div>Wallet Sync：{wallet?.walletSyncSource || "background refresh"}</div><div>BTC Source：{wallet?.btcPositionSource || "background refresh"}</div><div>Strict Mode：no manual BTC fallback / no fake 5U cost</div><div>Last Sync：{wallet?.lastSyncTime || updatedAt}</div></div></details>
  </PageShell>;
}
