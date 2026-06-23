import { useEffect, useMemo, useState } from "react";

const MODEL_VERSION = "15.37-progress-display-guard";
const REFRESH_MS = 5000;
const ruleColors = ["🟢", "🟡", "🟠", "🔴"];
const levelNames = ["", "第一層", "第二層", "第三層", "第四層"];

function normalizeSymbol(symbol) {
  return String(symbol || "").trim().toUpperCase();
}

function stripOn(symbol) {
  return normalizeSymbol(symbol).replace(/ON$/, "");
}

function isLiveHolding(holding) {
  return !!holding && Number(holding.quantity) > 0 && holding.quantitySource === "bsc_rpc_balanceOf_live";
}

function parsePercentValue(value) {
  const number = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(number) ? number : NaN;
}

function parseAmount(value) {
  const number = Number(String(value || "0").replace(/[^0-9.]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value, digits = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  return number.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function formatCurrency(value, digits = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  const rounded = Number(number.toFixed(digits));
  const sign = rounded > 0 ? "+" : rounded < 0 ? "-" : "";
  return `${sign}$${Math.abs(rounded).toLocaleString(undefined, { maximumFractionDigits: digits })}`;
}

function formatPct(value, digits = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  const pct = Number((number * 100).toFixed(digits));
  return `${pct > 0 ? "+" : ""}${pct.toFixed(digits)}%`;
}

function formatTime(isoString) {
  if (!isoString) return "讀取中";
  const d = new Date(isoString);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

function getSignedColor(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number === 0) return "#f8fafc";
  return number > 0 ? "#22c55e" : "#ff4d4d";
}

function SignedText({ value, children, style = {} }) {
  return <strong style={{ color: getSignedColor(value), fontWeight: 1000, ...style }}>{children}</strong>;
}

function getCurrentSignalLevel(asset) {
  return asset?.signal?.level || 0;
}

function getCompletedLevelByCost(asset, holding) {
  if (!isLiveHolding(holding)) return 0;
  const totalCost = Number(holding.totalCost || 0);
  const amounts = asset.amounts || [];
  let cumulative = 0;
  let completed = 0;
  for (let i = 0; i < amounts.length; i += 1) {
    cumulative += Number(amounts[i] || 0);
    if (totalCost + 0.01 >= cumulative) completed = i + 1;
  }
  return completed;
}

function getActionAmount(asset, completedLevel) {
  const level = getCurrentSignalLevel(asset);
  if (level <= completedLevel) return 0;
  const amounts = asset.amounts || [];
  return Number(amounts[level - 1] || parseAmount(asset.signal?.amount) || 0);
}

function getRuleRows(asset) {
  const rules = asset.rules || [];
  const amounts = asset.amounts || [];
  return rules.map((rule, index) => ({
    color: ruleColors[index] || "⚪",
    levelName: levelNames[index + 1] || `第${index + 1}層`,
    discountText: `-${Math.abs(parsePercentValue(rule) || 0)}%`,
    amountText: `${amounts[index] ?? 0}U`,
  }));
}

function getNextBuyPoint(asset, completedLevel = 0) {
  const currentDepth = Math.abs(parsePercentValue(asset.discount));
  const rules = asset.rules || [];
  const amounts = asset.amounts || [];
  if (!Number.isFinite(currentDepth) || rules.length === 0) return { currentAmount: "0U", targetAmount: "0U", progress: 0, displayProgress: 0, targetDepth: 0, remainingDepth: null };

  const ruleDepths = rules.map((rule) => Math.abs(parsePercentValue(rule))).filter(Number.isFinite);
  if (ruleDepths.length === 0) return { currentAmount: "0U", targetAmount: "0U", progress: 0, displayProgress: 0, targetDepth: 0, remainingDepth: null };

  let targetIndex = Math.max(0, Number(completedLevel || 0));
  if (targetIndex >= ruleDepths.length) targetIndex = ruleDepths.length - 1;

  const targetDepth = ruleDepths[targetIndex] || ruleDepths[ruleDepths.length - 1];
  const progress = targetDepth > 0 ? Math.min(100, Math.max(0, (currentDepth / targetDepth) * 100)) : 0;
  const reachedTarget = currentDepth >= targetDepth;
  const displayProgress = reachedTarget ? 100 : Math.min(99, Math.floor(progress));
  const remainingDepth = Number.isFinite(targetDepth) ? Math.max(0, targetDepth - currentDepth) : null;

  return {
    currentAmount: `${targetIndex === 0 ? 0 : amounts[targetIndex - 1] || 0}U`,
    targetAmount: `${amounts[targetIndex] || 0}U`,
    progress,
    displayProgress,
    targetDepth,
    remainingDepth,
  };
}

function getProgressScore(asset) {
  return Number(getNextBuyPoint(asset, asset.completedLevel || 0).progress || 0);
}

function summarizeLiveHoldings(holdings) {
  const liveHoldings = (holdings || []).filter(isLiveHolding);
  const totalCost = liveHoldings.reduce((sum, h) => sum + Number(h.totalCost || 0), 0);
  const marketValue = liveHoldings.reduce((sum, h) => sum + Number(h.currentValue || 0), 0);
  const pnl = marketValue - totalCost;
  const pnlPct = totalCost > 0 ? pnl / totalCost : 0;
  return { liveHoldings, totalCost, marketValue, pnl, pnlPct };
}

export default function Home() {
  const [assets, setAssets] = useState([]);
  const [updatedAt, setUpdatedAt] = useState("");
  const [source, setSource] = useState("");
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [walletSummary, setWalletSummary] = useState(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState("");
  const [walletToast, setWalletToast] = useState(null);

  async function loadPrices() {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/prices?t=${Date.now()}`, { cache: "no-store" });
      const data = await res.json();
      setAssets(data.data || []);
      setUpdatedAt(data.updatedAt || "");
      setSource(data.source || "");
      setError(data.error || "");
    } catch (err) {
      setError(err.message || "行情讀取失敗");
    } finally {
      setRefreshing(false);
    }
  }

  async function syncWallet(showToast = false) {
    if (walletLoading) return;
    setWalletLoading(true);
    setWalletError("");
    if (showToast) setWalletToast(null);
    try {
      const res = await fetch(`/api/sync-wallet?t=${Date.now()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}), cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "錢包同步失敗");
      setWalletSummary(data);
      if (showToast) setWalletToast({ type: "success", message: "鏈上持倉同步完成" });
    } catch (err) {
      const message = err.message || "錢包同步失敗";
      setWalletError(message);
      if (showToast) setWalletToast({ type: "error", message });
    } finally {
      setWalletLoading(false);
    }
  }

  useEffect(() => {
    loadPrices();
    syncWallet();
    const priceTimer = setInterval(loadPrices, REFRESH_MS);
    const walletTimer = setInterval(syncWallet, 60000);
    return () => { clearInterval(priceTimer); clearInterval(walletTimer); };
  }, []);

  const liveWallet = useMemo(() => summarizeLiveHoldings(walletSummary?.holdings), [walletSummary]);

  const holdingMap = useMemo(() => {
    const map = new Map();
    for (const h of liveWallet.liveHoldings || []) {
      map.set(normalizeSymbol(h.symbol), h);
      map.set(stripOn(h.symbol), h);
    }
    return map;
  }, [liveWallet]);

  const enhancedAssets = useMemo(() => assets.map((asset) => {
    const holding = holdingMap.get(normalizeSymbol(asset.symbol)) || holdingMap.get(stripOn(asset.symbol));
    const hasHolding = isLiveHolding(holding);
    const completedLevel = getCompletedLevelByCost(asset, holding);
    const signalLevel = getCurrentSignalLevel(asset);
    const actionAmount = getActionAmount(asset, completedLevel);
    return { ...asset, holding, hasHolding, completedLevel, signalLevel, actionAmount, isActionable: signalLevel > completedLevel && actionAmount > 0 };
  }), [assets, holdingMap]);

  const sortedAssets = useMemo(() => [...enhancedAssets].sort((a, b) => {
    if (a.isActionable !== b.isActionable) return a.isActionable ? -1 : 1;
    if ((a.signalLevel || 0) !== (b.signalLevel || 0)) return (b.signalLevel || 0) - (a.signalLevel || 0);
    if (a.hasHolding !== b.hasHolding) return a.hasHolding ? -1 : 1;
    return Math.abs(parsePercentValue(b.discount || 0)) - Math.abs(parsePercentValue(a.discount || 0));
  }), [enhancedAssets]);

  const actionList = sortedAssets.filter((asset) => asset.isActionable);
  const heldSignalList = sortedAssets.filter((asset) => asset.signalLevel > 0 && asset.hasHolding && !asset.isActionable);
  const watchList = useMemo(() => sortedAssets.filter((asset) => !asset.isActionable && !heldSignalList.includes(asset)).sort((a, b) => getProgressScore(b) - getProgressScore(a)), [sortedAssets, heldSignalList]);
  const totalAmount = actionList.reduce((sum, asset) => sum + Number(asset.actionAmount || 0), 0);
  const marketOnline = assets.length > 0 && !error;
  const walletOnline = !!walletSummary && !walletError;

  return <main className="page">
    <section className="hero compactHero" style={{ textAlign: "center", padding: "18px 12px 10px", background: "linear-gradient(135deg, rgba(10,14,39,.96), rgba(3,7,18,.96))" }}>
      <div style={{ textAlign: "right", color: "rgba(243,186,47,.6)", fontSize: 10, fontWeight: 900 }}>v15.37</div>
      <h1 style={{ fontSize: "clamp(48px, 14vw, 78px)", fontWeight: 1000, margin: "6px 0", lineHeight: .95, background: "linear-gradient(180deg, #fff6b7, #ffd700, #b8860b)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>美股DCA<br />折價追蹤</h1>
      <h2 style={{ fontSize: 14, margin: 0, color: "rgba(248,250,252,.68)", fontWeight: 750 }}>Binance xStocks 財富儀表板</h2>
      {error && <div className="dataGuard">{error}</div>}
    </section>

    <DecisionSection actionList={actionList} totalAmount={totalAmount} updatedAt={updatedAt} refreshing={refreshing} />
    <WalletSyncSection walletSummary={walletSummary} walletLoading={walletLoading} walletError={walletError} walletToast={walletToast} onSync={() => syncWallet(true)} liveWallet={liveWallet} />

    {actionList.length > 0 && <section className="list"><h3 style={{ color: "#f8fafc", margin: "0 0 10px" }}>🔥 可執行買點</h3>{actionList.map((asset) => <AssetCard key={asset.symbol} asset={asset} />)}</section>}
    {heldSignalList.length > 0 && <section className="list" style={{ marginTop: 16 }}><h3 style={{ color: "#f8fafc", margin: "0 0 10px" }}>✅ 鏈上已持有買點區</h3>{heldSignalList.map((asset) => <AssetCard key={asset.symbol} asset={asset} />)}</section>}
    <details className="idleGroup" style={{ marginTop: 16 }}><summary>📋 觀察區（{watchList.length}）</summary><section className="list" style={{ marginTop: 12 }}>{watchList.map((asset) => <AssetCard key={asset.symbol} asset={asset} />)}</section></details>
    <FooterStatus source={source} marketOnline={marketOnline} walletOnline={walletOnline} walletLoading={walletLoading} walletSummary={walletSummary} liveWallet={liveWallet} />
  </main>;
}

function DecisionSection({ actionList, totalAmount, updatedAt, refreshing }) {
  return <section style={{ margin: "12px 0", padding: 14, background: "linear-gradient(135deg, rgba(30,41,59,.92), rgba(15,23,42,.96))", borderRadius: 16, border: actionList.length > 0 ? "2px solid #f59e0b" : "1px solid rgba(243,186,47,.22)" }}>
    <div className="liveLine" style={{ fontSize: 12, textAlign: "right", marginBottom: 6, fontWeight: 850 }}><span className={refreshing ? "liveDot loading" : "liveDot"} /><span className="liveText">{refreshing ? "行情更新中" : "LIVE"}</span>｜{formatTime(updatedAt)}</div>
    <h2 style={{ fontSize: 20, fontWeight: 950, color: "#f59e0b", margin: "0 0 10px" }}>今日決策</h2>
    {actionList.length > 0 ? <>
      <div style={{ display: "grid", gap: 8, color: "#e2e8f0", fontSize: 16, fontWeight: 900, marginBottom: 12 }}><div>可執行買點：{actionList.length}檔</div><div>建議投入：<span style={{ color: "#22c55e", fontWeight: 950 }}>{totalAmount}U</span></div></div>
      <div style={{ display: "grid", gap: 8 }}>{actionList.map((asset) => <div key={asset.symbol} style={{ padding: "10px 12px", background: "#0f172a", borderRadius: 10, fontWeight: 900, color: "#f8fafc" }}>{ruleColors[(asset.signalLevel || 1) - 1]} {asset.symbol} {levelNames[asset.signalLevel]}（{asset.actionAmount}U）{asset.hasHolding ? "｜加碼" : "｜新買"}</div>)}</div>
    </> : <div style={{ textAlign: "center", padding: "6px 0 10px" }}><div style={{ fontSize: 30, fontWeight: 1000, color: "#f8fafc", lineHeight: 1.1 }}>暫無買點</div><div style={{ marginTop: 8, color: "#94a3b8", fontWeight: 850 }}>等待下一層</div></div>}
  </section>;
}

function WalletSyncSection({ walletSummary, walletLoading, walletError, walletToast, onSync, liveWallet }) {
  const toastColor = walletToast?.type === "success" ? "#86efac" : "#fecaca";
  const toastBg = walletToast?.type === "success" ? "rgba(34,197,94,.16)" : "rgba(239,68,68,.18)";
  return <section style={{ margin: "12px 0 16px", padding: 12, background: "#020617", borderRadius: 16, border: "1px solid rgba(34,197,94,.75)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}><h2 style={{ fontSize: 19, fontWeight: 950, color: "#4ade80", margin: 0 }}>鏈上持倉</h2><button onClick={onSync} disabled={walletLoading} style={{ padding: "8px 11px", borderRadius: 10, border: 0, background: walletLoading ? "#334155" : "#2563eb", color: "white", fontWeight: 950 }}>{walletLoading ? "同步中…" : "重新同步"}</button></div>
    {walletToast && <div role="status" aria-live="polite" style={{ marginTop: 10, padding: 10, background: toastBg, color: toastColor, borderRadius: 10, fontWeight: 900 }}>{walletToast.type === "success" ? "✓" : "⚠️"} {walletToast.message}</div>}
    {walletError && <div style={{ marginTop: 10, padding: 10, background: "rgba(239,68,68,.18)", color: "#fecaca", borderRadius: 10, fontWeight: 900 }}>⚠️ {walletError}</div>}
    {walletSummary && <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
        <WalletMetric label="持倉成本" value={`$${formatNumber(liveWallet.totalCost)}`} />
        <WalletMetric label="持倉市值" value={`$${formatNumber(liveWallet.marketValue)}`} />
        <WalletMetric label="未實現損益" value={formatCurrency(liveWallet.pnl)} signedValue={liveWallet.pnl} />
        <WalletMetric label="報酬率" value={formatPct(liveWallet.pnlPct)} signedValue={liveWallet.pnlPct} />
      </div>
      <details style={{ marginTop: 10 }}><summary style={{ color: "#cbd5e1", fontWeight: 950, cursor: "pointer" }}>同步資料與持倉明細（{liveWallet.liveHoldings.length}）</summary><div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: "#0f172a", color: "#94a3b8", fontSize: 12, fontWeight: 850 }}>只顯示 live RPC balanceOf 持倉<br />最後同步：{formatTime(walletSummary.lastSyncTime || walletSummary.checkedAt)}</div><div style={{ display: "grid", gap: 10, marginTop: 12 }}>{liveWallet.liveHoldings.map((holding) => <WalletHoldingCard key={holding.symbol} holding={holding} />)}</div></details>
    </>}
  </section>;
}

function WalletMetric({ label, value, signedValue }) {
  return <div style={{ padding: 10, background: "#0f172a", borderRadius: 12 }}><span style={{ color: "#94a3b8", fontWeight: 900, fontSize: 12 }}>{label}</span>{signedValue === undefined ? <strong style={{ display: "block", color: "#f8fafc", marginTop: 4, fontSize: 16 }}>{value}</strong> : <SignedText value={signedValue} style={{ display: "block", marginTop: 4, fontSize: 16 }}>{value}</SignedText>}</div>;
}

function WalletHoldingCard({ holding }) {
  return <div style={{ padding: 12, background: "#0f172a", borderRadius: 12, border: "1px solid rgba(148,163,184,.22)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 8 }}><strong style={{ color: "#f8fafc", fontSize: 18 }}>{holding.symbol}</strong><SignedText value={holding.unrealizedPnL}>{formatCurrency(holding.unrealizedPnL)}｜{formatPct(holding.pnlPct, 1)}</SignedText></div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, color: "#cbd5e1", fontSize: 13, fontWeight: 850 }}><div>數量<br /><strong style={{ color: "#f8fafc" }}>{formatNumber(holding.quantity, 6)}</strong></div><div>成本<br /><strong style={{ color: "#f8fafc" }}>${formatNumber(holding.totalCost)}</strong></div><div>均價<br /><strong style={{ color: "#f8fafc" }}>${formatNumber(holding.averageCost)}</strong></div><div>現價<br /><strong style={{ color: "#f8fafc" }}>${formatNumber(holding.tokenPrice)}</strong></div><div>市值<br /><strong style={{ color: "#f8fafc" }}>${formatNumber(holding.currentValue)}</strong></div><div>損益<br /><SignedText value={holding.unrealizedPnL}>{formatCurrency(holding.unrealizedPnL)}</SignedText></div></div>
  </div>;
}

function ProgressBar({ nextBuy }) {
  const pct = Math.min(100, Math.max(0, Number(nextBuy.displayProgress ?? nextBuy.progress ?? 0)));
  return <div><div style={{ fontWeight: 900, color: "#e2e8f0", marginBottom: 8 }}>下一層</div><div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 8 }}><span style={{ fontSize: 13, fontWeight: 900, color: "#cbd5e1" }}>{nextBuy.currentAmount}</span><div style={{ height: 10, width: "100%", background: "rgba(148,163,184,.22)", borderRadius: 999, overflow: "hidden" }}><div style={{ width: `${pct}%`, height: "100%", background: "#22c55e", borderRadius: 999 }} /></div><span style={{ fontSize: 13, fontWeight: 900, color: "#cbd5e1" }}>{nextBuy.targetAmount}</span></div><div style={{ marginTop: 8, textAlign: "center", fontWeight: 950, color: "#e2e8f0" }}>{pct.toFixed(0)}%</div></div>;
}

function AssetCard({ asset }) {
  const level = asset.signalLevel || asset.signal?.level || 0;
  const completedLevel = asset.completedLevel || 0;
  const actionAmount = asset.actionAmount ?? getActionAmount(asset, completedLevel);
  const nextBuy = getNextBuyPoint(asset, completedLevel);
  const ruleRows = getRuleRows(asset);
  const held = asset.hasHolding;
  const depthText = Math.abs(parsePercentValue(asset.discount));
  const discountValue = parsePercentValue(asset.discount);
  const signalText = level > 0 ? (actionAmount > 0 ? `${ruleColors[level - 1]} ${levelNames[level]}｜${held ? "加碼" : "建議"} ${actionAmount}U` : "✅ 鏈上已持有｜等待下一層") : (held ? "✅ 鏈上已持有｜觀察中" : "尚未到買點");
  const layerLabel = actionAmount > 0 ? "本層建議" : held ? "本層已完成" : "本層建議";
  const layerValue = actionAmount > 0 ? `${actionAmount}U` : held ? "不需加碼" : "0U";
  const remainingText = Number.isFinite(nextBuy.remainingDepth) ? `｜還差 ${nextBuy.remainingDepth.toFixed(1)}%` : "";
  return <div className={`card ${level > 0 ? "active" : "idle"}`}>
    <div className="cardTop"><div className="titleRow"><div className="logoText">{asset.symbol.slice(0, 2)}</div><div><h2>{asset.symbol}</h2><p>{asset.name}</p><p className="desc">{asset.grade}級 ｜ {asset.description}</p></div></div><div className="badge">{asset.grade}級</div></div>
    <div className="signal">{signalText}</div>
    <div className="dataGrid"><div><span>{asset.highType || "52週高點"}</span><strong>{formatNumber(asset.high)}</strong></div><div><span>Binance現價</span><strong>{formatNumber(asset.price)}</strong></div><div><span>回撤</span><SignedText value={discountValue}>{asset.discount ?? "--"}%</SignedText></div><div><span>{layerLabel}</span><strong>{layerValue}</strong></div></div>
    <details style={{ marginTop: 10, padding: "8px 10px", borderRadius: 10, background: "rgba(15,23,42,.72)", border: "1px solid rgba(251,191,36,.22)", color: "#fef3c7", fontSize: 11, fontWeight: 850, lineHeight: 1.55 }}><summary style={{ cursor: "pointer", fontWeight: 950 }}>買點規則 ▼</summary><div style={{ display: "grid", gap: 4, marginTop: 8 }}>{ruleRows.map((row) => <div key={`${asset.symbol}-${row.levelName}`}>{row.color} {row.levelName} {row.discountText}｜{row.amountText}</div>)}</div></details>
    {asset.holding && <div style={{ marginTop: 10, padding: 10, background: "#020617", borderRadius: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, color: "#cbd5e1", fontSize: 12, fontWeight: 850 }}><div>鏈上數量<br /><strong style={{ color: "#f8fafc" }}>{formatNumber(asset.holding.quantity, 6)}</strong></div><div>持倉損益<br /><SignedText value={asset.holding.unrealizedPnL}>{formatCurrency(asset.holding.unrealizedPnL)}</SignedText></div></div>}
    <div className="nextBuyBox"><div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6, fontWeight: 850 }}>深度 {Number.isFinite(depthText) ? `${depthText.toFixed(1)}%` : "--"}｜前往下一層 {Number(nextBuy.displayProgress ?? nextBuy.progress || 0).toFixed(0)}%{remainingText}</div><ProgressBar nextBuy={nextBuy} /></div>
  </div>;
}

function FooterStatus({ source, marketOnline, walletOnline, walletLoading, walletSummary, liveWallet }) {
  const marketClass = source ? (marketOnline ? "status-live" : "status-error") : "status-loading";
  const marketText = source ? (marketOnline ? "LIVE" : "ERROR") : "LOADING";
  const walletClass = walletLoading ? "status-loading" : walletOnline ? "status-live" : "status-error";
  const walletText = walletLoading ? "LOADING" : walletOnline ? "LIVE" : "ERROR";
  const lastSyncTime = walletSummary?.lastSyncTime || walletSummary?.checkedAt;
  return <section style={{ margin: "18px 0 8px", padding: 12, background: "#020617", borderRadius: 14, border: "1px solid rgba(148,163,184,.22)", color: "#94a3b8", fontSize: 12, fontWeight: 850 }}><div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}><span className={marketClass}>● Market API {marketText}</span><span className={walletClass}>● Wallet {walletText}</span></div><div style={{ marginTop: 8 }}>行情資料源：{source || "讀取中"}</div><div style={{ marginTop: 6 }}>版本：{MODEL_VERSION}｜最後同步：{formatTime(lastSyncTime)}</div>{walletSummary?.debugCounts && <div style={{ marginTop: 6 }}>Transfers {walletSummary.debugCounts.totalTransfers}｜Ledger {walletSummary.debugCounts.buyRecordsCount}｜Live Holdings {liveWallet.liveHoldings.length}</div>}</section>;
}
