import { useEffect, useMemo, useState } from "react";

const MODEL_VERSION = "15.5d-svg-hero";
const REFRESH_MS = 5000;
const ruleColors = ["🟢", "🟡", "🟠", "🔴"];
const levelNames = ["", "第一層", "第二層", "第三層", "第四層"];

const heroPanelStyle = {
  position: "relative",
  textAlign: "center",
  padding: "14px 12px 8px",
  minHeight: "220px",
  overflow: "hidden",
  background: "radial-gradient(circle at 50% 18%, rgba(243,186,47,.08) 0%, rgba(10,14,39,0) 30%), linear-gradient(135deg, rgba(10,14,39,.96) 0%, rgba(3,7,18,.96) 100%)",
};

const versionMiniStyle = {
  position: "absolute",
  top: 10,
  right: 10,
  padding: "4px 8px",
  borderRadius: 999,
  border: "1px solid rgba(243,186,47,.16)",
  background: "rgba(243,186,47,.06)",
  color: "rgba(243,186,47,.62)",
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: "1px",
  textTransform: "uppercase",
  transform: "scale(0.5)",
  transformOrigin: "top right",
};

function normalizeSymbol(symbol) {
  return String(symbol || "").trim().toUpperCase();
}

function parseAmount(value) {
  const number = Number(String(value || "0").replace(/[^0-9.]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function parsePercentValue(value) {
  const number = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(number) ? number : NaN;
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

function valueClass(value) {
  const text = String(value ?? "").trim();
  if (text.startsWith("-")) return "pnl-value negative";
  if (text.startsWith("+")) return "pnl-value positive";
  return "pnl-value";
}

function getCurrentSignalLevel(asset) {
  return asset.signal?.level || 0;
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
  return rules.map((rule, index) => {
    const discount = Math.abs(parsePercentValue(rule));
    const amount = amounts[index] ?? 0;
    return {
      color: ruleColors[index] || "⚪",
      levelName: levelNames[index + 1] || `第${index + 1}層`,
      discountText: `-${Number.isFinite(discount) ? discount : 0}%`,
      amountText: `${amount}U`,
    };
  });
}

function getNextBuyPoint(asset, completedLevel = 0) {
  const currentDepth = Math.abs(parsePercentValue(asset.discount));
  const rules = asset.rules || [];
  const amounts = asset.amounts || [];
  if (!Number.isFinite(currentDepth) || rules.length === 0) return { currentAmount: "0U", targetAmount: "0U", progress: 0 };

  const ruleDepths = rules
    .map((rule) => Math.abs(parsePercentValue(rule)))
    .filter((value) => Number.isFinite(value));

  if (ruleDepths.length === 0) return { currentAmount: "0U", targetAmount: "0U", progress: 0 };

  let targetIndex = ruleDepths.findIndex((depth) => currentDepth < depth);
  if (targetIndex === -1) targetIndex = ruleDepths.length - 1;

  const previousDepth = targetIndex === 0 ? 0 : ruleDepths[targetIndex - 1];
  const targetDepth = ruleDepths[targetIndex];
  const range = Math.max(1, targetDepth - previousDepth);
  const rawProgress = ((currentDepth - previousDepth) / range) * 100;
  const progress = currentDepth >= targetDepth ? 100 : Math.min(100, Math.max(0, rawProgress));

  return {
    currentAmount: `${targetIndex === 0 ? 0 : amounts[targetIndex - 1] || 0}U`,
    targetAmount: `${amounts[targetIndex] || 0}U`,
    progress,
  };
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

  useEffect(() => {
    try { localStorage.setItem("discountHunterModelVersion", MODEL_VERSION); } catch {}
  }, []);

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

  async function syncWallet() {
    setWalletLoading(true);
    setWalletError("");
    try {
      const res = await fetch("/api/sync-wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "錢包同步失敗");
      setWalletSummary(data);
    } catch (err) {
      setWalletError(err.message || "錢包同步失敗");
    } finally {
      setWalletLoading(false);
    }
  }

  useEffect(() => {
    loadPrices();
    syncWallet();
    const priceTimer = setInterval(loadPrices, REFRESH_MS);
    const walletTimer = setInterval(syncWallet, 60000);
    return () => {
      clearInterval(priceTimer);
      clearInterval(walletTimer);
    };
  }, []);

  const holdingMap = useMemo(() => {
    const map = new Map();
    for (const h of walletSummary?.holdings || []) map.set(normalizeSymbol(h.symbol), h);
    return map;
  }, [walletSummary]);

  const enhancedAssets = useMemo(() => assets.map((asset) => {
    const key = normalizeSymbol(asset.symbol);
    const holding = holdingMap.get(key);
    const hasHolding = !!holding && Number(holding.quantity) > 0;
    const completedLevel = hasHolding ? 1 : 0;
    const signalLevel = getCurrentSignalLevel(asset);
    const actionAmount = getActionAmount(asset, completedLevel);
    return {
      ...asset,
      holding,
      hasHolding,
      completedLevel,
      signalLevel,
      actionAmount,
      isActionable: signalLevel > completedLevel && actionAmount > 0,
    };
  }), [assets, holdingMap]);

  const sortedAssets = useMemo(() => [...enhancedAssets].sort((a, b) => {
    if (a.isActionable !== b.isActionable) return a.isActionable ? -1 : 1;
    if ((a.signalLevel || 0) !== (b.signalLevel || 0)) return (b.signalLevel || 0) - (a.signalLevel || 0);
    if (a.hasHolding !== b.hasHolding) return a.hasHolding ? -1 : 1;
    return Math.abs(parsePercentValue(b.discount || 0)) - Math.abs(parsePercentValue(a.discount || 0));
  }), [enhancedAssets]);

  const actionList = sortedAssets.filter((asset) => asset.isActionable);
  const heldSignalList = sortedAssets.filter((asset) => asset.signalLevel > 0 && asset.hasHolding && !asset.isActionable);
  const watchList = sortedAssets.filter((asset) => !asset.isActionable && !heldSignalList.includes(asset));
  const totalAmount = actionList.reduce((sum, asset) => sum + Number(asset.actionAmount || 0), 0);
  const marketOnline = assets.length > 0 && !error;
  const walletOnline = !!walletSummary && !walletError;
  const holdingsCount = walletSummary?.holdings?.length || 0;

  return <main className="page">
    <section className="hero compactHero" style={heroPanelStyle}>
      <div style={versionMiniStyle}>v15.5</div>
      <img className="heroLogoSvg" src="/hero-logo.svg" alt="美股DCA 折價追蹤" />
      {error && <div className="dataGuard">{error}</div>}
    </section>

    <section className="warRoom" style={{ margin: "12px 0", padding: 12 }}>
      <div className="warRoomHeader" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div><span>鏈上持倉</span><strong>{walletLoading ? "同步中" : `${holdingsCount}檔`}</strong></div>
        <div><span>今日買點</span><strong>{actionList.length}檔</strong></div>
      </div>
    </section>

    <DecisionSection actionList={actionList} totalAmount={totalAmount} updatedAt={updatedAt} refreshing={refreshing} />

    <WalletSyncSection walletSummary={walletSummary} walletLoading={walletLoading} walletError={walletError} onSync={syncWallet} />

    {actionList.length > 0 && <section className="list">
      <h3 style={{ color: "#f8fafc", margin: "0 0 10px" }}>🔥 可執行買點</h3>
      {actionList.map((asset) => <AssetCard key={asset.symbol} asset={asset} />)}
    </section>}

    {heldSignalList.length > 0 && <section className="list" style={{ marginTop: 16 }}>
      <h3 style={{ color: "#f8fafc", margin: "0 0 10px" }}>✅ 已持有買點區</h3>
      {heldSignalList.map((asset) => <AssetCard key={asset.symbol} asset={asset} />)}
    </section>}

    <details className="idleGroup" style={{ marginTop: 16 }}>
      <summary>📋 觀察區（{watchList.length}）</summary>
      <section className="list" style={{ marginTop: 12 }}>
        {watchList.map((asset) => <AssetCard key={asset.symbol} asset={asset} />)}
      </section>
    </details>

    <FooterStatus source={source} marketOnline={marketOnline} walletOnline={walletOnline} walletLoading={walletLoading} walletSummary={walletSummary} />
  </main>;
}

function DecisionSection({ actionList, totalAmount, updatedAt, refreshing }) {
  return <section style={{ margin: "12px 0 16px", padding: 16, background: "linear-gradient(135deg, rgba(30,41,59,.92), rgba(15,23,42,.96))", borderRadius: 16, border: actionList.length > 0 ? "2px solid #f59e0b" : "1px solid rgba(243,186,47,.22)" }}>
    <div className="liveLine" style={{ fontSize: 12, textAlign: "right", marginBottom: 8, fontWeight: 850 }}>
      <span className={refreshing ? "liveDot loading" : "liveDot"} />
      <span className="liveText">{refreshing ? "行情更新中" : "LIVE"}</span>｜{formatTime(updatedAt)}
    </div>
    <h2 style={{ fontSize: 20, fontWeight: 950, color: "#f59e0b", margin: "0 0 12px" }}>今日決策</h2>
    {actionList.length > 0 ? <>
      <div style={{ display: "grid", gap: 8, color: "#e2e8f0", fontSize: 16, fontWeight: 900, marginBottom: 12 }}>
        <div>可執行買點：{actionList.length}檔</div>
        <div>建議投入：<span className="pnl-value positive">{totalAmount}U</span></div>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {actionList.map((asset) => {
          const level = asset.signalLevel || 0;
          return <div key={asset.symbol} style={{ padding: "10px 12px", background: "#0f172a", borderRadius: 10, fontWeight: 900, color: "#f8fafc" }}>
            {ruleColors[level - 1]} {asset.symbol} {levelNames[level]}（{asset.actionAmount}U）{asset.hasHolding ? "｜加碼" : "｜新買"}
          </div>;
        })}
      </div>
    </> : <div style={{ textAlign: "center", padding: "12px 0 14px" }}>
      <div style={{ fontSize: 30, fontWeight: 1000, color: "#f8fafc", lineHeight: 1.1 }}>暫無買點</div>
      <div style={{ marginTop: 8, color: "#94a3b8", fontWeight: 850 }}>等待下一層</div>
    </div>}
  </section>;
}

function FooterStatus({ source, marketOnline, walletOnline, walletLoading, walletSummary }) {
  return <section style={{ margin: "18px 0 8px", padding: 12, background: "#020617", borderRadius: 14, border: "1px solid rgba(148,163,184,.22)", color: "#94a3b8", fontSize: 12, fontWeight: 850 }}>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      <span style={{ color: marketOnline ? "#4ade80" : "#f87171" }}>● Market API {marketOnline ? "LIVE" : "異常"}</span>
      <span style={{ color: walletOnline ? "#4ade80" : walletLoading ? "#f59e0b" : "#94a3b8" }}>● Wallet {walletOnline ? "鏈上同步" : walletLoading ? "同步中" : "待同步"}</span>
    </div>
    <div style={{ marginTop: 8 }}>行情資料源：{source || "讀取中"}</div>
    {walletSummary?.debugCounts && <div style={{ marginTop: 6 }}>
      Transfers {walletSummary.debugCounts.totalTransfers}｜Ledger {walletSummary.debugCounts.buyRecordsCount}｜Holdings {walletSummary.debugCounts.holdingsCount}
    </div>}
  </section>;
}

function WalletSyncSection({ walletSummary, walletLoading, walletError, onSync }) {
  const pnlColor = walletSummary && walletSummary.portfolioUnrealizedPnL >= 0 ? "#4ade80" : "#f87171";
  const tokenSources = walletSummary?.debugCounts?.tokenPriceSources || [];
  const referenceSources = walletSummary?.debugCounts?.referencePriceSources || [];

  return <section style={{ margin: "12px 0 16px", padding: 12, background: "#020617", borderRadius: 16, border: "1px solid rgba(34,197,94,.75)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
      <h2 style={{ fontSize: 19, fontWeight: 950, color: "#4ade80", margin: 0 }}>鏈上持倉</h2>
      <button onClick={onSync} disabled={walletLoading} style={{ padding: "8px 11px", borderRadius: 10, border: 0, background: walletLoading ? "#334155" : "#2563eb", color: "white", fontWeight: 950 }}>{walletLoading ? "同步中…" : "重新同步"}</button>
    </div>
    {walletError && <div style={{ marginTop: 10, padding: 10, background: "rgba(239,68,68,.18)", color: "#fecaca", borderRadius: 10, fontWeight: 900 }}>⚠️ {walletError}</div>}
    {walletSummary && <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
        <WalletMetric label="總投入" value={`$${formatNumber(walletSummary.actualTotalInvested)}`} />
        <WalletMetric label="目前市值" value={`$${formatNumber(walletSummary.portfolioMarketValue)}`} />
        <WalletMetric label="未實現損益" value={formatCurrency(walletSummary.portfolioUnrealizedPnL)} color={pnlColor} />
        <WalletMetric label="報酬率" value={formatPct(walletSummary.portfolioPnLPct)} color={pnlColor} />
      </div>
      <details style={{ marginTop: 10 }}>
        <summary style={{ color: "#cbd5e1", fontWeight: 950, cursor: "pointer" }}>同步資料與持倉明細（{walletSummary.holdings?.length || 0}）</summary>
        <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: "#0f172a", color: "#94a3b8", fontSize: 12, fontWeight: 850 }}>
          PnL價格源：{tokenSources.join("、") || walletSummary.priceSource || "讀取中"}<br />
          Reference價格源：{referenceSources.join("、") || walletSummary.referencePriceSource || "讀取中"}<br />
          最後同步：{formatTime(walletSummary.lastSyncTime || walletSummary.checkedAt)}
        </div>
        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          {(walletSummary.holdings || []).map((holding) => <WalletHoldingCard key={holding.symbol} holding={holding} />)}
        </div>
      </details>
    </>}
  </section>;
}

function WalletMetric({ label, value, color }) {
  return <div style={{ padding: 10, background: "#0f172a", borderRadius: 12 }}>
    <span style={{ color: "#94a3b8", fontWeight: 900, fontSize: 12 }}>{label}</span>
    <strong className={valueClass(value)} style={{ display: "block", color: color || undefined, marginTop: 4, fontSize: 16 }}>{value}</strong>
  </div>;
}

function WalletHoldingCard({ holding }) {
  const pnlColor = holding.unrealizedPnL >= 0 ? "#4ade80" : "#f87171";
  const warning = holding.excludeFromPortfolioPnL ? "價格資料缺失，未納入總損益" : holding.priceWarning;

  return <div style={{ padding: 12, background: "#0f172a", borderRadius: 12, border: "1px solid rgba(148,163,184,.22)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 8 }}>
      <strong style={{ color: "#f8fafc", fontSize: 18 }}>{holding.symbol}</strong>
      <strong className={holding.unrealizedPnL >= 0 ? "pnl-value positive" : "pnl-value negative"} style={{ color: pnlColor }}>{formatCurrency(holding.unrealizedPnL)}｜{formatPct(holding.pnlPct, 1)}</strong>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, color: "#cbd5e1", fontSize: 13, fontWeight: 850 }}>
      <div>數量<br /><strong style={{ color: "#f8fafc" }}>{formatNumber(holding.quantity, 6)}</strong></div>
      <div>成本<br /><strong style={{ color: "#f8fafc" }}>${formatNumber(holding.totalCost)}</strong></div>
      <div>均價<br /><strong style={{ color: "#f8fafc" }}>${formatNumber(holding.averageCost)}</strong></div>
      <div>現價<br /><strong style={{ color: "#f8fafc" }}>${formatNumber(holding.tokenPrice)}</strong></div>
      <div>市值<br /><strong style={{ color: "#f8fafc" }}>${formatNumber(holding.currentValue)}</strong></div>
      <div>損益<br /><strong className={holding.unrealizedPnL >= 0 ? "pnl-value positive" : "pnl-value negative"} style={{ color: pnlColor }}>{formatCurrency(holding.unrealizedPnL)}</strong></div>
    </div>
    {warning && <div style={{ marginTop: 10, padding: 8, background: "rgba(250,204,21,.14)", color: "#fde68a", borderRadius: 8, fontWeight: 850 }}>⚠️ {warning}</div>}
  </div>;
}

function ProgressBar({ nextBuy }) {
  const pct = Math.min(100, Math.max(0, Number(nextBuy.progress || 0)));
  return <div>
    <div style={{ fontWeight: 900, color: "#e2e8f0", marginBottom: 8 }}>下一層</div>
    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 13, fontWeight: 900, color: "#cbd5e1" }}>{nextBuy.currentAmount}</span>
      <div style={{ height: 10, width: "100%", background: "rgba(148,163,184,.22)", borderRadius: 999, overflow: "hidden" }}><div style={{ width: `${pct}%`, height: "100%", background: "#22c55e", borderRadius: 999 }} /></div>
      <span style={{ fontSize: 13, fontWeight: 900, color: "#cbd5e1" }}>{nextBuy.targetAmount}</span>
    </div>
    <div style={{ marginTop: 8, textAlign: "center", fontWeight: 950, color: "#e2e8f0" }}>{pct.toFixed(0)}%</div>
  </div>;
}

function AssetCard({ asset }) {
  const level = asset.signalLevel || asset.signal?.level || 0;
  const completedLevel = asset.completedLevel || 0;
  const actionAmount = asset.actionAmount ?? getActionAmount(asset, completedLevel);
  const nextBuy = getNextBuyPoint(asset, completedLevel);
  const ruleRows = getRuleRows(asset);
  const held = asset.hasHolding;
  const depthText = Math.abs(parsePercentValue(asset.discount));
  const signalText = level > 0
    ? actionAmount > 0
      ? `${ruleColors[level - 1]} ${levelNames[level]}｜${held ? "加碼" : "建議"} ${actionAmount}U`
      : `✅ 鏈上已持有｜等待下一層`
    : held
      ? `✅ 鏈上已持有｜觀察中`
      : "尚未到買點";

  return <div className={`card ${level > 0 ? "active" : "idle"}`}>
    <div className="cardTop"><div className="titleRow"><div className="logoText">{asset.symbol.slice(0, 2)}</div><div><h2>{asset.symbol}</h2><p>{asset.name}</p><p className="desc">{asset.grade}級 ｜ {asset.description}</p></div></div><div className="badge">{asset.grade}級</div></div>
    <div className="signal">{signalText}</div>
    <div className="dataGrid"><div><span>{asset.highType || "52週高點"}</span><strong>{formatNumber(asset.high)}</strong></div><div><span>Binance現價</span><strong>{formatNumber(asset.price)}</strong></div><div><span>回撤</span><strong>{asset.discount ?? "--"}%</strong></div><div><span>本層建議</span><strong>{actionAmount}U</strong></div></div>
    <details style={{ marginTop: 10, padding: "8px 10px", borderRadius: 10, background: "rgba(15,23,42,.72)", border: "1px solid rgba(251,191,36,.22)", color: "#fef3c7", fontSize: 11, fontWeight: 850, lineHeight: 1.55 }}>
      <summary style={{ cursor: "pointer", fontWeight: 950 }}>買點規則 ▼</summary>
      <div style={{ display: "grid", gap: 4, marginTop: 8 }}>
        {ruleRows.map((row) => <div key={`${asset.symbol}-${row.levelName}`}>{row.color} {row.levelName} {row.discountText}｜{row.amountText}</div>)}
      </div>
    </details>
    {asset.holding && <div style={{ marginTop: 10, padding: 10, background: "#020617", borderRadius: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, color: "#cbd5e1", fontSize: 12, fontWeight: 850 }}>
      <div>鏈上數量<br /><strong style={{ color: "#f8fafc" }}>{formatNumber(asset.holding.quantity, 6)}</strong></div>
      <div>持倉損益<br /><strong className={asset.holding.unrealizedPnL >= 0 ? "pnl-value positive" : "pnl-value negative"} style={{ color: asset.holding.unrealizedPnL >= 0 ? "#4ade80" : "#f87171" }}>{formatCurrency(asset.holding.unrealizedPnL)}</strong></div>
    </div>}
    <div className="nextBuyBox">
      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6, fontWeight: 850 }}>
        深度 {Number.isFinite(depthText) ? `${depthText.toFixed(1)}%` : "--"}｜進度 {Number(nextBuy.progress || 0).toFixed(0)}%
      </div>
      <ProgressBar nextBuy={nextBuy} />
    </div>
  </div>;
}
