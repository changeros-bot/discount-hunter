import { useEffect, useMemo, useState } from "react";

const MODEL_VERSION = "15.1-env-wallet-sync";
const REFRESH_MS = 5000;
const CONFIRMED_HELD_SYMBOLS = (process.env.NEXT_PUBLIC_HELD_SYMBOLS || "GOOGLon,NVDAon,QQQon,TSMon,SPCXon,AMDon,MRVLon,RKLBon,AVGOon")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const ruleColors = ["🟢", "🟡", "🟠", "🔴"];
const levelNames = ["", "第一層", "第二層", "第三層", "第四層"];

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
  const sign = number > 0 ? "+" : number < 0 ? "-" : "";
  return `${sign}$${Math.abs(number).toLocaleString(undefined, { maximumFractionDigits: digits })}`;
}

function formatPct(value, digits = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  const pct = number * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(digits)}%`;
}

function formatTime(isoString) {
  if (!isoString) return "讀取中";
  const d = new Date(isoString);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

function isHeld(symbol) {
  return CONFIRMED_HELD_SYMBOLS.includes(symbol);
}

function getCurrentSignalLevel(asset) {
  return asset.signal?.level || 0;
}

function getCompletedLevel(asset) {
  return isHeld(asset.symbol) ? 1 : 0;
}

function getActionAmount(asset, completedLevel) {
  const level = getCurrentSignalLevel(asset);
  if (level <= completedLevel) return 0;
  const amounts = asset.amounts || [];
  return Number(amounts[level - 1] || parseAmount(asset.signal?.amount) || 0);
}

function getNextBuyPoint(asset, completedLevel = 0) {
  const discount = Number(asset.discount);
  const rules = asset.rules || [];
  const amounts = asset.amounts || [];
  if (!Number.isFinite(discount) || rules.length === 0) return { currentAmount: "0U", targetAmount: "0U", progress: 0 };

  const nextIndex = rules.findIndex((rule, index) => index >= completedLevel && discount > rule);
  if (nextIndex === -1) {
    const targetIndex = Math.min(completedLevel, rules.length - 1);
    const nextRule = rules[targetIndex];
    const prevRule = targetIndex === 0 ? 0 : Number(rules[targetIndex - 1]);
    const range = Math.abs(Number(nextRule) - prevRule) || 1;
    const progress = Math.min(100, Math.max(0, ((prevRule - discount) / range) * 100));
    return {
      currentAmount: `${completedLevel === 0 ? 0 : amounts[completedLevel - 1] || 0}U`,
      targetAmount: `${amounts[targetIndex] || 0}U`,
      progress
    };
  }

  const target = Number(rules[nextIndex]);
  const previous = nextIndex === 0 ? 0 : Number(rules[nextIndex - 1]);
  const range = Math.abs(target - previous) || 1;
  const progress = Math.min(100, Math.max(0, ((previous - discount) / range) * 100));
  return { currentAmount: `${nextIndex === 0 ? 0 : amounts[nextIndex - 1] || 0}U`, targetAmount: `${amounts[nextIndex] || 0}U`, progress };
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

  useEffect(() => {
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
        setError(err.message || "資料讀取失敗");
      } finally {
        setRefreshing(false);
      }
    }

    loadPrices();
    const priceTimer = setInterval(loadPrices, REFRESH_MS);
    return () => clearInterval(priceTimer);
  }, []);

  async function handleWalletSync() {
    setWalletLoading(true);
    setWalletError("");
    try {
      const res = await fetch("/api/sync-wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
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

  const enhancedAssets = useMemo(() => assets.map((asset) => {
    const completedLevel = getCompletedLevel(asset);
    const signalLevel = getCurrentSignalLevel(asset);
    const actionAmount = getActionAmount(asset, completedLevel);
    const held = isHeld(asset.symbol);
    return {
      ...asset,
      completedLevel,
      signalLevel,
      actionAmount,
      hasHolding: held,
      isActionable: signalLevel > completedLevel && actionAmount > 0
    };
  }), [assets]);

  const sortedAssets = useMemo(() => [...enhancedAssets].sort((a, b) => {
    if (a.isActionable !== b.isActionable) return a.isActionable ? -1 : 1;
    if (a.hasHolding !== b.hasHolding) return a.hasHolding ? -1 : 1;
    if ((a.signalLevel || 0) !== (b.signalLevel || 0)) return (b.signalLevel || 0) - (a.signalLevel || 0);
    return Math.abs(Number(b.discount || 0)) - Math.abs(Number(a.discount || 0));
  }), [enhancedAssets]);

  const actionList = sortedAssets.filter((asset) => asset.isActionable);
  const heldList = sortedAssets.filter((asset) => asset.hasHolding);
  const buyPointHeldList = sortedAssets.filter((asset) => asset.signalLevel > 0 && asset.hasHolding && !asset.isActionable);
  const watchList = sortedAssets.filter((asset) => asset.signalLevel === 0);
  const totalAmount = actionList.reduce((sum, asset) => sum + Number(asset.actionAmount || 0), 0);
  const marketOnline = assets.length > 0 && !error;

  return <main className="page">
    <section className="hero compactHero">
      <h1 style={{ fontSize: 34, fontWeight: 950, margin: "6px 0 4px" }}>美股DCA折價追蹤</h1>
      <div className="versionPill">V15.1 Wallet Sync</div>
      <h2 style={{ fontSize: 17, margin: "12px 0 6px", color: "#cbd5e1" }}>Binance xStocks 戰情室</h2>
      <p>V15.1 改為後台讀取錢包地址，不需要在首頁輸入。首頁只負責同步與顯示結果。</p>
      <div className="update">更新：{formatTime(updatedAt)}</div>
      <div className="syncPill syncLive">{refreshing ? "自動更新中…" : "LIVE｜每5秒自動更新"}</div>
      {source && <div className="sourcePill">行情資料源：{source}</div>}
      {error && <div className="dataGuard">{error}</div>}
    </section>

    <section className="warRoom">
      <div className="warRoomHeader" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><span>已確認持有</span><strong>{heldList.length}檔</strong></div>
        <div><span>行情狀態</span><strong>{marketOnline ? "LIVE" : "異常"}</strong></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
        <div style={{ padding: 12, background: "#0f172a", borderRadius: 12 }}><span style={{ color: "#94a3b8", fontWeight: 900 }}>Market API</span><strong style={{ display: "block", color: marketOnline ? "#4ade80" : "#f87171", marginTop: 4 }}>{marketOnline ? "🟢 Online" : "🔴 Offline"}</strong></div>
        <div style={{ padding: 12, background: "#0f172a", borderRadius: 12 }}><span style={{ color: "#94a3b8", fontWeight: 900 }}>Position Source</span><strong style={{ display: "block", color: walletSummary ? "#4ade80" : "#f59e0b", marginTop: 4 }}>{walletSummary ? "🟢 Auto Sync" : "🟡 待同步"}</strong></div>
      </div>
      <div style={{ color: "#cbd5e1", fontWeight: 900, textAlign: "center", marginTop: 12 }}>成本 / 損益 / 總投入：V15 Wallet Sync 已接入</div>
    </section>

    <WalletSyncSection
      walletSummary={walletSummary}
      walletLoading={walletLoading}
      walletError={walletError}
      onSync={handleWalletSync}
    />

    <section style={{ margin: "16px 0", padding: 16, background: "#1e293b", borderRadius: 16, border: "2px solid #f59e0b" }}>
      <h2 style={{ fontSize: 20, fontWeight: 900, color: "#f59e0b", margin: "0 0 12px" }}>⚠️ 注意</h2>
      {actionList.length > 0 ? <>
        <div style={{ display: "grid", gap: 8, color: "#e2e8f0", fontSize: 16, fontWeight: 900, marginBottom: 12 }}>
          <div>可執行買點：{actionList.length}檔</div>
          <div>建議投入：<span style={{ color: "#4ade80" }}>{totalAmount}U</span></div>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {actionList.map((asset) => {
            const level = asset.signalLevel || 0;
            return <div key={asset.symbol} style={{ padding: "10px 12px", background: "#0f172a", borderRadius: 10, fontWeight: 900, color: "#f8fafc" }}>
              {ruleColors[level - 1]} {asset.symbol} {levelNames[level]}（{asset.actionAmount}U）{asset.hasHolding ? "｜加碼" : "｜新買"}
            </div>;
          })}
        </div>
      </> : <div style={{ color: "#94a3b8", textAlign: "center", fontWeight: 900 }}>目前沒有新的可執行買點。已持有第一層不重複提醒。</div>}
      {buyPointHeldList.length > 0 && <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(148,163,184,.25)", color: "#cbd5e1", fontWeight: 900 }}>
        已達買點但第一層已完成：{buyPointHeldList.map((a) => a.symbol).join("、")}
      </div>}
    </section>

    <section style={{ margin: "16px 0", padding: 16, background: "#0f172a", borderRadius: 16, border: "1px solid rgba(148,163,184,.25)" }}>
      <h2 style={{ fontSize: 20, fontWeight: 950, color: "#f8fafc", margin: "0 0 10px" }}>我的持倉</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {heldList.map((asset) => <span key={asset.symbol} style={{ padding: "8px 10px", borderRadius: 999, background: "#1e293b", color: "#e2e8f0", fontWeight: 900 }}>✓ {asset.symbol}</span>)}
      </div>
    </section>

    <section className="sectionTitle"><h2>監控清單</h2><p>可執行買點優先；已持有標的顯示第一層完成。</p></section>
    {actionList.length > 0 && <section className="list">
      <h3 style={{ color: "#f8fafc", margin: "0 0 10px" }}>🔥 可執行買點（{actionList.length}）</h3>
      {actionList.map((asset) => <AssetCard key={asset.symbol} asset={asset} />)}
    </section>}

    {buyPointHeldList.length > 0 && <section className="list" style={{ marginTop: 16 }}>
      <h3 style={{ color: "#f8fafc", margin: "0 0 10px" }}>✅ 已持有買點區（{buyPointHeldList.length}）</h3>
      {buyPointHeldList.map((asset) => <AssetCard key={asset.symbol} asset={asset} />)}
    </section>}

    <details className="idleGroup" style={{ marginTop: 16 }}>
      <summary>📋 觀察區（{watchList.length}）｜展開未到買點標的</summary>
      <section className="list" style={{ marginTop: 12 }}>
        {watchList.map((asset) => <AssetCard key={asset.symbol} asset={asset} />)}
      </section>
    </details>

    <BuyPointGuide assets={sortedAssets} />

    <section className="infoFooter"><h2>V15.1 Wallet Sync 說明</h2><p>V15.1 使用後台環境變數讀取錢包地址。首頁只按同步，不再輸入錢包地址。</p></section>
  </main>;
}

function WalletSyncSection({ walletSummary, walletLoading, walletError, onSync }) {
  const pnlColor = walletSummary && walletSummary.portfolioUnrealizedPnL >= 0 ? "#4ade80" : "#f87171";

  return <section style={{ margin: "16px 0", padding: 16, background: "#020617", borderRadius: 16, border: "2px solid #22c55e" }}>
    <h2 style={{ fontSize: 22, fontWeight: 950, color: "#4ade80", margin: "0 0 8px" }}>V15 後台錢包同步</h2>
    <p style={{ color: "#cbd5e1", fontWeight: 800, margin: "0 0 12px" }}>系統會自動讀取 Vercel 的 WALLET_ADDRESS，從 BscScan 抓取 xStocks transfer，計算真實投入、成本與未實現損益。</p>
    <button
      onClick={onSync}
      disabled={walletLoading}
      style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: 0, background: walletLoading ? "#334155" : "#2563eb", color: "white", fontWeight: 950, fontSize: 16 }}
    >{walletLoading ? "同步中…" : "後台同步錢包持倉"}</button>
    {walletError && <div style={{ marginTop: 10, padding: 10, background: "rgba(239,68,68,.18)", color: "#fecaca", borderRadius: 10, fontWeight: 900 }}>⚠️ {walletError}</div>}

    {walletSummary && <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
        <WalletMetric label="實際投入" value={`$${formatNumber(walletSummary.actualTotalInvested)}`} />
        <WalletMetric label="已定價成本" value={`$${formatNumber(walletSummary.portfolioTotalCost)}`} />
        <WalletMetric label="目前市值" value={`$${formatNumber(walletSummary.portfolioMarketValue)}`} />
        <WalletMetric label="未實現損益" value={formatCurrency(walletSummary.portfolioUnrealizedPnL)} color={pnlColor} />
        <WalletMetric label="報酬率" value={formatPct(walletSummary.portfolioPnLPct)} color={pnlColor} />
        <WalletMetric label="未定價成本" value={`$${formatNumber(walletSummary.unpricedCost)}`} color={walletSummary.unpricedCost > 0 ? "#facc15" : "#e2e8f0"} />
      </div>
      {walletSummary.unpricedHoldingsCount > 0 && <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: "rgba(250,204,21,.14)", color: "#fde68a", fontWeight: 900 }}>⚠️ {walletSummary.unpricedHoldingsCount} 檔缺少 token 價格，未納入總損益。</div>}
      <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 800, marginTop: 10 }}>最後同步：{formatTime(walletSummary.lastSyncTime || walletSummary.checkedAt)}</div>
      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        {(walletSummary.holdings || []).map((holding) => <WalletHoldingCard key={holding.symbol} holding={holding} />)}
      </div>
    </>}
  </section>;
}

function WalletMetric({ label, value, color }) {
  return <div style={{ padding: 12, background: "#0f172a", borderRadius: 12 }}>
    <span style={{ color: "#94a3b8", fontWeight: 900, fontSize: 12 }}>{label}</span>
    <strong style={{ display: "block", color: color || "#f8fafc", marginTop: 4, fontSize: 17 }}>{value}</strong>
  </div>;
}

function WalletHoldingCard({ holding }) {
  const pnlColor = holding.unrealizedPnL >= 0 ? "#4ade80" : "#f87171";
  const warning = holding.excludeFromPortfolioPnL ? "價格資料缺失，未納入總損益" : holding.priceWarning;

  return <div style={{ padding: 12, background: "#0f172a", borderRadius: 12, border: "1px solid rgba(148,163,184,.22)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 8 }}>
      <strong style={{ color: "#f8fafc", fontSize: 18 }}>{holding.symbol}</strong>
      <strong style={{ color: pnlColor }}>{formatPct(holding.pnlPct, 1)}</strong>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, color: "#cbd5e1", fontSize: 13, fontWeight: 850 }}>
      <div>持有數量<br /><strong style={{ color: "#f8fafc" }}>{formatNumber(holding.quantity, 6)}</strong></div>
      <div>總成本<br /><strong style={{ color: "#f8fafc" }}>${formatNumber(holding.totalCost)}</strong></div>
      <div>平均成本<br /><strong style={{ color: "#f8fafc" }}>${formatNumber(holding.averageCost)}</strong></div>
      <div>Token 現價<br /><strong style={{ color: "#f8fafc" }}>${formatNumber(holding.tokenPrice)}</strong></div>
      <div>目前市值<br /><strong style={{ color: "#f8fafc" }}>${formatNumber(holding.currentValue)}</strong></div>
      <div>未實現損益<br /><strong style={{ color: pnlColor }}>{formatCurrency(holding.unrealizedPnL)}</strong></div>
      <div>溢價/折價<br /><strong style={{ color: holding.premiumDiscountPct >= 0 ? "#60a5fa" : "#fb923c" }}>{formatPct(holding.premiumDiscountPct)}</strong></div>
      <div>買入次數<br /><strong style={{ color: "#f8fafc" }}>{holding.buyCount || 0}</strong></div>
    </div>
    {warning && <div style={{ marginTop: 10, padding: 8, background: "rgba(250,204,21,.14)", color: "#fde68a", borderRadius: 8, fontWeight: 850 }}>⚠️ {warning}</div>}
  </div>;
}

function ProgressBar({ nextBuy }) {
  const pct = Math.min(100, Math.max(0, Number(nextBuy.progress || 0)));
  return <div>
    <div style={{ fontWeight: 900, color: "#e2e8f0", marginBottom: 8 }}>下一層加碼</div>
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
  const completedLevel = asset.completedLevel || getCompletedLevel(asset);
  const actionAmount = asset.actionAmount ?? getActionAmount(asset, completedLevel);
  const nextBuy = getNextBuyPoint(asset, completedLevel);
  const held = asset.hasHolding || isHeld(asset.symbol);
  const signalText = level > 0
    ? actionAmount > 0
      ? `${ruleColors[level - 1]} ${levelNames[level]}｜${held ? "加碼" : "建議"} ${actionAmount}U`
      : `✅ 第一層已持有｜等待下一層`
    : held
      ? `✅ 第一層已持有｜尚未到下一層`
      : "尚未到買點";

  return <div className={`card ${level > 0 ? "active" : "idle"}`}>
    <div className="cardTop"><div className="titleRow"><div className="logoText">{asset.symbol.slice(0, 2)}</div><div><h2>{asset.symbol}</h2><p>{asset.name}</p><p className="desc">{asset.grade}級 ｜ {asset.description}</p></div></div><div className="badge">{asset.grade}級</div></div>
    <div className="signal">{signalText}</div>
    <div className="dataGrid"><div><span>{asset.highType || "52週高點"}</span><strong>{formatNumber(asset.high)}</strong></div><div><span>Binance現價</span><strong>{formatNumber(asset.price)}</strong></div><div><span>回撤</span><strong>{asset.discount ?? "--"}%</strong></div><div><span>本層建議</span><strong>{actionAmount}U</strong></div></div>
    <div className="nextBuyBox"><ProgressBar nextBuy={nextBuy} /></div>
    <div style={{ marginTop: 8, padding: "6px 10px", background: "#1e293b", borderRadius: 6, fontSize: 12, color: "#cbd5e1", borderLeft: "3px solid #3b82f6" }}>V15：上方 Wallet Sync 顯示真實成本 / 損益；此卡片維持買點監控。</div>
  </div>;
}

function BuyPointGuide({ assets }) {
  return <section className="infoFooter" style={{ marginTop: 18 }}>
    <h2>個股買點說明</h2>
    <p>以下買點以「距離52週高點回撤」判斷；SpaceX 若未滿52週，依上市以來高點計算。已持有第一層者，V14不再重複提醒第一層。</p>
    <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
      {assets.map((asset) => <div key={asset.symbol} style={{ padding: 12, background: "#0f172a", borderRadius: 12, border: "1px solid rgba(148,163,184,.2)" }}>
        <div style={{ fontWeight: 950, color: "#f8fafc", marginBottom: 6 }}>{asset.symbol}｜{asset.name}</div>
        <div style={{ display: "grid", gap: 4, color: "#cbd5e1", fontWeight: 850, fontSize: 13 }}>
          {(asset.rules || []).map((rule, index) => <div key={index}>{ruleColors[index]} {levelNames[index + 1]}：回撤達 {Math.abs(Number(rule))}%｜建議 {asset.amounts?.[index] || 0}U</div>)}
        </div>
      </div>)}
    </div>
  </section>;
}
