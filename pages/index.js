import { useEffect, useMemo, useState } from "react";

const MODEL_VERSION = "15.43-level-progress";
const REFRESH_MS = 5000;
const ruleColors = ["🟢", "🟡", "🟠", "🔴"];
const levelNames = ["", "第一層", "第二層", "第三層", "第四層"];

function normalizeSymbol(symbol) { return String(symbol || "").trim().toUpperCase(); }
function stripOn(symbol) { return normalizeSymbol(symbol).replace(/ON$/, ""); }
function parsePercentValue(value) { const n = Number(String(value ?? "").replace(/[^0-9.-]/g, "")); return Number.isFinite(n) ? n : NaN; }
function parseAmount(value) { const n = Number(String(value || "0").replace(/[^0-9.]/g, "")); return Number.isFinite(n) ? n : 0; }
function isLiveHolding(holding) { return !!holding && Number(holding.quantity) > 0 && holding.quantitySource === "bsc_rpc_balanceOf_live"; }
function formatNumber(value, digits = 2) { const n = Number(value); return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: digits }) : "--"; }
function formatCurrency(value, digits = 2) { const n = Number(value); if (!Number.isFinite(n)) return "--"; const r = Number(n.toFixed(digits)); return `${r > 0 ? "+" : r < 0 ? "-" : ""}$${Math.abs(r).toLocaleString(undefined, { maximumFractionDigits: digits })}`; }
function formatPct(value, digits = 2) { const n = Number(value); if (!Number.isFinite(n)) return "--"; const pct = Number((n * 100).toFixed(digits)); return `${pct > 0 ? "+" : ""}${pct.toFixed(digits)}%`; }
function formatTime(iso) { if (!iso) return "讀取中"; const d = new Date(iso); return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`; }
function signedColor(value) { const n = Number(value || 0); if (!Number.isFinite(n) || n === 0) return "#f8fafc"; return n > 0 ? "#22c55e" : "#ff4d4d"; }
function SignedText({ value, children, style = {} }) { return <strong style={{ color: signedColor(value), fontWeight: 1000, ...style }}>{children}</strong>; }
function getCompletedLevelByDipLedger() { return 0; }
function getSignalLevel(asset) { return asset?.signal?.level || 0; }
function getActionAmount(asset, completedLevel) {
  const level = getSignalLevel(asset);
  if (level <= completedLevel) return 0;
  const amounts = asset.amounts || [];
  return Number(amounts[level - 1] || parseAmount(asset.signal?.amount) || 0);
}
function getLevelProgress(asset) {
  const currentDepth = Math.abs(parsePercentValue(asset.discount));
  const rules = asset.rules || [];
  const amounts = asset.amounts || [];
  const ruleDepths = rules.map((r) => Math.abs(parsePercentValue(r))).filter(Number.isFinite);
  const level = getSignalLevel(asset);
  const empty = { fromText: "0U", toText: "0U", stageText: "資料未就緒", progress: 0, displayProgress: 0, remainingDepth: null };
  if (!Number.isFinite(currentDepth) || !ruleDepths.length) return empty;
  if (level <= 0) {
    const targetDepth = ruleDepths[0];
    const progress = targetDepth > 0 ? Math.min(99, Math.max(0, (currentDepth / targetDepth) * 100)) : 0;
    return { fromText: "0U", toText: `${amounts[0] || 0}U`, stageText: `尚未到買點 → ${levelNames[1]}`, progress, displayProgress: Math.floor(progress), remainingDepth: Math.max(0, targetDepth - currentDepth) };
  }
  if (level >= ruleDepths.length) {
    return { fromText: `${amounts[level - 1] || 0}U`, toText: "最深層", stageText: `${levelNames[level]} 已觸發`, progress: 100, displayProgress: 100, remainingDepth: 0 };
  }
  const startDepth = ruleDepths[level - 1];
  const targetDepth = ruleDepths[level];
  const progress = Math.min(100, Math.max(0, ((currentDepth - startDepth) / Math.max(0.000001, targetDepth - startDepth)) * 100));
  return { fromText: `${amounts[level - 1] || 0}U`, toText: `${amounts[level] || 0}U`, stageText: `${levelNames[level]} → ${levelNames[level + 1]}`, progress, displayProgress: Math.floor(progress), remainingDepth: Math.max(0, targetDepth - currentDepth) };
}
function summarizeLiveHoldings(holdings) {
  const liveHoldings = (holdings || []).filter(isLiveHolding);
  const totalCost = liveHoldings.reduce((s, h) => s + Number(h.totalCost || 0), 0);
  const marketValue = liveHoldings.reduce((s, h) => s + Number(h.currentValue || 0), 0);
  const pnl = marketValue - totalCost;
  return { liveHoldings, totalCost, marketValue, pnl, pnlPct: totalCost > 0 ? pnl / totalCost : 0 };
}
function ruleRows(asset) { return (asset.rules || []).map((rule, i) => ({ color: ruleColors[i] || "⚪", levelName: levelNames[i + 1] || `第${i + 1}層`, discountText: `-${Math.abs(parsePercentValue(rule) || 0)}%`, amountText: `${asset.amounts?.[i] ?? 0}U` })); }

export default function Home() {
  const [assets, setAssets] = useState([]);
  const [updatedAt, setUpdatedAt] = useState("");
  const [source, setSource] = useState("");
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [walletSummary, setWalletSummary] = useState(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState("");
  async function loadPrices() {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/prices?t=${Date.now()}`, { cache: "no-store" });
      const data = await res.json();
      setAssets(data.data || []);
      setUpdatedAt(data.updatedAt || "");
      setSource(data.source || "");
      setError(data.error || "");
    } catch (err) { setError(err.message || "行情讀取失敗"); }
    finally { setRefreshing(false); }
  }
  async function syncWallet() {
    if (walletLoading) return;
    setWalletLoading(true); setWalletError("");
    try {
      const res = await fetch(`/api/sync-wallet?t=${Date.now()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}), cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "錢包同步失敗");
      setWalletSummary(data);
    } catch (err) { setWalletError(err.message || "錢包同步失敗"); }
    finally { setWalletLoading(false); }
  }
  useEffect(() => {
    loadPrices(); syncWallet();
    const priceTimer = setInterval(loadPrices, REFRESH_MS);
    const walletTimer = setInterval(syncWallet, 60000);
    return () => { clearInterval(priceTimer); clearInterval(walletTimer); };
  }, []);
  const liveWallet = useMemo(() => summarizeLiveHoldings(walletSummary?.holdings), [walletSummary]);
  const holdingMap = useMemo(() => {
    const map = new Map();
    for (const h of liveWallet.liveHoldings || []) { map.set(normalizeSymbol(h.symbol), h); map.set(stripOn(h.symbol), h); }
    return map;
  }, [liveWallet]);
  const enhancedAssets = useMemo(() => assets.map((asset) => {
    const holding = holdingMap.get(normalizeSymbol(asset.symbol)) || holdingMap.get(stripOn(asset.symbol));
    const hasHolding = isLiveHolding(holding);
    const completedLevel = getCompletedLevelByDipLedger(asset, holding);
    const signalLevel = getSignalLevel(asset);
    const actionAmount = getActionAmount(asset, completedLevel);
    return { ...asset, holding, hasHolding, completedLevel, signalLevel, actionAmount, isActionable: signalLevel > completedLevel && actionAmount > 0 };
  }), [assets, holdingMap]);
  const sortedAssets = useMemo(() => [...enhancedAssets].sort((a, b) => {
    if (a.isActionable !== b.isActionable) return a.isActionable ? -1 : 1;
    if ((a.signalLevel || 0) !== (b.signalLevel || 0)) return (b.signalLevel || 0) - (a.signalLevel || 0);
    const aDepth = Math.abs(parsePercentValue(a.discount || 0));
    const bDepth = Math.abs(parsePercentValue(b.discount || 0));
    if (aDepth !== bDepth) return bDepth - aDepth;
    if (a.hasHolding !== b.hasHolding) return a.hasHolding ? -1 : 1;
    return a.symbol.localeCompare(b.symbol);
  }), [enhancedAssets]);
  const actionList = sortedAssets.filter((a) => a.isActionable);
  const heldSignalList = sortedAssets.filter((a) => a.signalLevel > 0 && a.hasHolding && !a.isActionable);
  const watchList = sortedAssets.filter((a) => !a.isActionable && !heldSignalList.includes(a));
  const totalAmount = actionList.reduce((s, a) => s + Number(a.actionAmount || 0), 0);
  const marketOnline = assets.length > 0 && !error;
  const walletOnline = !!walletSummary && !walletError;
  return <main className="page">
    <section className="hero compactHero" style={{ textAlign: "center", padding: "18px 12px 10px", background: "linear-gradient(135deg, rgba(10,14,39,.96), rgba(3,7,18,.96))" }}>
      <div style={{ textAlign: "right", color: "rgba(243,186,47,.6)", fontSize: 10, fontWeight: 900 }}>v15.43</div>
      <h1 style={{ fontSize: "clamp(48px, 14vw, 78px)", fontWeight: 1000, margin: "6px 0", lineHeight: .95, background: "linear-gradient(180deg, #fff6b7, #ffd700, #b8860b)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>美股DCA<br />折價追蹤</h1>
      <h2 style={{ fontSize: 14, margin: 0, color: "rgba(248,250,252,.68)", fontWeight: 750 }}>Binance xStocks 財富儀表板</h2>
      {error && <div className="dataGuard">{error}</div>}
    </section>
    <DecisionSection actionList={actionList} totalAmount={totalAmount} updatedAt={updatedAt} refreshing={refreshing} />
    <WalletSyncSection walletSummary={walletSummary} walletLoading={walletLoading} walletError={walletError} onSync={syncWallet} liveWallet={liveWallet} />
    {actionList.length > 0 && <section className="list"><h3 style={{ color: "#f8fafc", margin: "0 0 10px" }}>🔥 可執行買點</h3>{actionList.map((a) => <AssetCard key={a.symbol} asset={a} />)}</section>}
    {heldSignalList.length > 0 && <section className="list" style={{ marginTop: 16 }}><h3 style={{ color: "#f8fafc", margin: "0 0 10px" }}>✅ 鏈上已持有買點區</h3>{heldSignalList.map((a) => <AssetCard key={a.symbol} asset={a} />)}</section>}
    <details className="idleGroup" style={{ marginTop: 16 }}><summary>📋 觀察區（{watchList.length}）</summary><section className="list" style={{ marginTop: 12 }}>{watchList.map((a) => <AssetCard key={a.symbol} asset={a} />)}</section></details>
    <FooterStatus source={source} marketOnline={marketOnline} walletOnline={walletOnline} walletLoading={walletLoading} walletSummary={walletSummary} liveWallet={liveWallet} />
  </main>;
}
function DecisionSection({ actionList, totalAmount, updatedAt, refreshing }) {
  return <section style={{ margin: "12px 0", padding: 14, background: "linear-gradient(135deg, rgba(30,41,59,.92), rgba(15,23,42,.96))", borderRadius: 16, border: actionList.length > 0 ? "2px solid #f59e0b" : "1px solid rgba(243,186,47,.22)" }}>
    <div className="liveLine" style={{ fontSize: 12, textAlign: "right", marginBottom: 6, fontWeight: 850 }}><span className={refreshing ? "liveDot loading" : "liveDot"} /><span className="liveText">{refreshing ? "行情更新中" : "LIVE"}</span>｜{formatTime(updatedAt)}</div>
    <h2 style={{ fontSize: 20, fontWeight: 950, color: "#f59e0b", margin: "0 0 10px" }}>今日決策</h2>
    {actionList.length > 0 ? <><div style={{ display: "grid", gap: 8, color: "#e2e8f0", fontSize: 16, fontWeight: 900, marginBottom: 12 }}><div>可執行買點：{actionList.length}檔</div><div>建議投入：<span style={{ color: "#22c55e", fontWeight: 950 }}>{totalAmount}U</span></div></div><div style={{ display: "grid", gap: 8 }}>{actionList.map((a) => <div key={a.symbol} style={{ padding: "10px 12px", background: "#0f172a", borderRadius: 10, fontWeight: 900, color: "#f8fafc" }}>{ruleColors[(a.signalLevel || 1) - 1]} {a.symbol} {levelNames[a.signalLevel]}（{a.actionAmount}U）{a.hasHolding ? "｜加碼" : "｜新買"}</div>)}</div></> : <div style={{ textAlign: "center", padding: "6px 0 10px" }}><div style={{ fontSize: 30, fontWeight: 1000, color: "#f8fafc", lineHeight: 1.1 }}>暫無買點</div><div style={{ marginTop: 8, color: "#94a3b8", fontWeight: 850 }}>等待下一層</div></div>}
  </section>;
}
function WalletSyncSection({ walletSummary, walletLoading, walletError, onSync, liveWallet }) {
  return <section style={{ margin: "12px 0 16px", padding: 12, background: "#020617", borderRadius: 16, border: "1px solid rgba(34,197,94,.75)" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}><h2 style={{ fontSize: 19, fontWeight: 950, color: "#4ade80", margin: 0 }}>鏈上持倉</h2><button onClick={onSync} disabled={walletLoading} style={{ padding: "8px 11px", borderRadius: 10, border: 0, background: walletLoading ? "#334155" : "#2563eb", color: "white", fontWeight: 950 }}>{walletLoading ? "同步中…" : "重新同步"}</button></div>{walletError && <div style={{ marginTop: 10, padding: 10, background: "rgba(239,68,68,.18)", color: "#fecaca", borderRadius: 10, fontWeight: 900 }}>⚠️ {walletError}</div>}{walletSummary && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}><WalletMetric label="持倉成本" value={`$${formatNumber(liveWallet.totalCost)}`} /><WalletMetric label="持倉市值" value={`$${formatNumber(liveWallet.marketValue)}`} /><WalletMetric label="未實現損益" value={formatCurrency(liveWallet.pnl)} signedValue={liveWallet.pnl} /><WalletMetric label="報酬率" value={formatPct(liveWallet.pnlPct)} signedValue={liveWallet.pnlPct} /></div>}</section>;
}
function WalletMetric({ label, value, signedValue }) { return <div style={{ padding: 10, background: "#0f172a", borderRadius: 12 }}><span style={{ color: "#94a3b8", fontWeight: 900, fontSize: 12 }}>{label}</span>{signedValue === undefined ? <strong style={{ display: "block", color: "#f8fafc", marginTop: 4, fontSize: 16 }}>{value}</strong> : <SignedText value={signedValue} style={{ display: "block", marginTop: 4, fontSize: 16 }}>{value}</SignedText>}</div>; }
function ProgressBar({ progress }) { const pct = Math.min(100, Math.max(0, Number((progress.displayProgress ?? progress.progress) || 0))); return <div><div style={{ fontWeight: 900, color: "#e2e8f0", marginBottom: 8 }}>{progress.stageText}</div><div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 8 }}><span style={{ fontSize: 13, fontWeight: 900, color: "#cbd5e1" }}>{progress.fromText}</span><div style={{ height: 10, width: "100%", background: "rgba(148,163,184,.22)", borderRadius: 999, overflow: "hidden" }}><div style={{ width: `${pct}%`, height: "100%", background: "#22c55e", borderRadius: 999 }} /></div><span style={{ fontSize: 13, fontWeight: 900, color: "#cbd5e1" }}>{progress.toText}</span></div><div style={{ marginTop: 8, textAlign: "center", fontWeight: 950, color: "#e2e8f0" }}>{pct.toFixed(0)}%</div></div>; }
function AssetCard({ asset }) {
  const level = asset.signalLevel || asset.signal?.level || 0;
  const completedLevel = asset.completedLevel || 0;
  const actionAmount = asset.actionAmount ?? getActionAmount(asset, completedLevel);
  const progress = getLevelProgress(asset);
  const rows = ruleRows(asset);
  const held = asset.hasHolding;
  const depthText = Math.abs(parsePercentValue(asset.discount));
  const discountValue = parsePercentValue(asset.discount);
  const displayProgress = Number((progress.displayProgress ?? progress.progress) || 0);
  const signalText = level > 0 ? (actionAmount > 0 ? `${ruleColors[level - 1]} ${levelNames[level]}｜${held ? "鏈上已持有，可加碼" : "建議