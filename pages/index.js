import { useEffect, useMemo, useState } from "react";

const MODEL_VERSION = "14.5-holding-hotfix";
const REFRESH_MS = 5000;
const ruleColors = ["🟢", "🟡", "🟠", "🔴"];
const levelNames = ["", "第一層", "第二層", "第三層", "第四層"];

const DEFAULT_HOLDINGS = {
  GOOGLon: { balance: "0.01353" },
  NVDAon: { balance: "0.02387" },
  QQQon: { balance: "0.0067441" },
  TSMon: { balance: "0.011408" },
  SPCXon: { balance: "0.023336" },
  AMDon: { balance: "0.0091571" },
  MRVLon: { balance: "0.016591" },
  RKLBon: { balance: "0.046432" },
  AVGOon: { balance: "0.012659" }
};

function parseAmount(value) {
  const number = Number(String(value || "0").replace(/[^0-9.]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value, digits = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  return number.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function formatTime(isoString) {
  if (!isoString) return "讀取中";
  const d = new Date(isoString);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

function getStats(asset, holding) {
  const quantity = Number(holding?.balance || holding?.quantity || 0);
  const price = Number(asset?.price || 0);
  const value = quantity * price;
  return { quantity, price, value, hasPosition: quantity > 0 && price > 0 };
}

function getNextBuyPoint(asset) {
  const discount = Number(asset.discount);
  const rules = asset.rules || [];
  const amounts = asset.amounts || [];
  if (!Number.isFinite(discount) || rules.length === 0) return { currentAmount: "0U", targetAmount: "0U", progress: 0 };
  const nextIndex = rules.findIndex((rule) => discount > rule);
  if (nextIndex === -1) return { currentAmount: `${amounts[amounts.length - 1] || 0}U`, targetAmount: "完成", progress: 100 };
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
  const [holdings, setHoldings] = useState({});

  useEffect(() => {
    try {
      const storedVersion = localStorage.getItem("discountHunterModelVersion");
      const stored = JSON.parse(localStorage.getItem("discountHunterHoldings") || "{}");
      const shouldReset = storedVersion !== MODEL_VERSION;
      setHoldings(shouldReset ? DEFAULT_HOLDINGS : stored);
      if (shouldReset) localStorage.setItem("discountHunterHoldings", JSON.stringify(DEFAULT_HOLDINGS));
      localStorage.setItem("discountHunterModelVersion", MODEL_VERSION);
    } catch {
      setHoldings(DEFAULT_HOLDINGS);
    }
  }, []);

  function getHolding(symbol) {
    return { ...(DEFAULT_HOLDINGS[symbol] || {}), ...(holdings[symbol] || {}) };
  }

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
    const timer = setInterval(loadPrices, REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  const sortedAssets = useMemo(() => [...assets].sort((a, b) => {
    const aLevel = a.signal?.level || 0;
    const bLevel = b.signal?.level || 0;
    if (aLevel !== bLevel) return bLevel - aLevel;
    return Math.abs(Number(b.discount || 0)) - Math.abs(Number(a.discount || 0));
  }), [assets]);

  const buyList = sortedAssets.filter((asset) => (asset.signal?.level || 0) > 0);
  const watchList = sortedAssets.filter((asset) => (asset.signal?.level || 0) === 0);
  const totalAmount = buyList.reduce((sum, asset) => sum + parseAmount(asset.signal?.amount), 0);
  const portfolio = assets.reduce((sum, asset) => {
    const stats = getStats(asset, getHolding(asset.symbol));
    return { value: sum.value + stats.value, count: sum.count + (stats.hasPosition ? 1 : 0) };
  }, { value: 0, count: 0 });

  return <main className="page">
    <section className="hero compactHero">
      <h1 style={{ fontSize: 34, fontWeight: 950, margin: "6px 0 4px" }}>美股DCA折價追蹤</h1>
      <div className="versionPill">V14.5 Holding Hotfix</div>
      <h2 style={{ fontSize: 17, margin: "12px 0 6px", color: "#cbd5e1" }}>Binance xStocks 戰情室</h2>
      <p>真實資料源：Binance xStocks Public API｜持倉數量規則：Balance 餘額。</p>
      <div className="update">更新：{formatTime(updatedAt)}</div>
      <div className="syncPill syncLive">{refreshing ? "自動更新中…" : "LIVE｜每5秒自動更新"}</div>
      {source && <div className="sourcePill">資料源：{source}</div>}
      {error && <div className="dataGuard">{error}</div>}
    </section>

    <section className="warRoom">
      <div className="warRoomHeader" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><span>持倉市值</span><strong>{formatNumber(portfolio.value)}U</strong></div>
        <div><span>成本/損益</span><strong style={{ color: "#facc15" }}>待接幣安</strong></div>
      </div>
      <div style={{ color: "#cbd5e1", fontWeight: 900, textAlign: "center", marginTop: 12 }}>
        持倉 {portfolio.count} 檔｜成本與損益將改接 Binance 真實資料
      </div>
    </section>

    <section style={{ margin: "16px 0", padding: 16, background: "#1e293b", borderRadius: 16, border: "2px solid #f59e0b" }}>
      <h2 style={{ fontSize: 20, fontWeight: 900, color: "#f59e0b", margin: "0 0 12px" }}>⚠️ 注意</h2>
      {buyList.length > 0 ? <>
        <div style={{ display: "grid", gap: 8, color: "#e2e8f0", fontSize: 16, fontWeight: 900, marginBottom: 12 }}>
          <div>符合買點：{buyList.length}檔</div>
          <div>建議投入：<span style={{ color: "#4ade80" }}>{totalAmount}U</span></div>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {buyList.map((asset) => {
            const level = asset.signal?.level || 0;
            return <div key={asset.symbol} style={{ padding: "10px 12px", background: "#0f172a", borderRadius: 10, fontWeight: 900, color: "#f8fafc" }}>
              {ruleColors[level - 1]} {asset.symbol} {levelNames[level]}（{parseAmount(asset.signal?.amount)}U）
            </div>;
          })}
        </div>
      </> : <div style={{ color: "#94a3b8", textAlign: "center" }}>今天無任何標的觸發買點。</div>}
    </section>

    <section className="sectionTitle"><h2>監控清單</h2><p>買點區預設展開；未到買點預設收合。</p></section>
    {buyList.length > 0 && <section className="list">
      <h3 style={{ color: "#f8fafc", margin: "0 0 10px" }}>🔥 買點區（{buyList.length}）</h3>
      {buyList.map((asset) => <AssetCard key={asset.symbol} asset={asset} holding={getHolding(asset.symbol)} />)}
    </section>}

    <details className="idleGroup" style={{ marginTop: 16 }}>
      <summary>📋 觀察區（{watchList.length}）｜展開未到買點標的</summary>
      <section className="list" style={{ marginTop: 12 }}>
        {watchList.map((asset) => <AssetCard key={asset.symbol} asset={asset} holding={getHolding(asset.symbol)} />)}
      </section>
    </details>

    <section className="infoFooter"><h2>V14.5 Hotfix</h2><p>已移除 snapshot、日期、手動投入成本顯示；成本與損益不再假裝完成，下一步接 Binance 真實成本來源。</p></section>
  </main>;
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

function AssetCard({ asset, holding }) {
  const level = asset.signal?.level || 0;
  const stats = getStats(asset, holding);
  const nextBuy = getNextBuyPoint(asset);
  return <div className={`card ${level > 0 ? "active" : "idle"}`}>
    <div className="cardTop"><div className="titleRow"><div className="logoText">{asset.symbol.slice(0, 2)}</div><div><h2>{asset.symbol}</h2><p>{asset.name}</p><p className="desc">{asset.grade}級 ｜ {asset.description}</p></div></div><div className="badge">{asset.grade}級</div></div>
    <div className="signal">{level > 0 ? `${ruleColors[level - 1]} ${levelNames[level]}｜建議 ${parseAmount(asset.signal?.amount)}U` : "尚未到買點"}</div>
    <div className="dataGrid"><div><span>{asset.highType || "52週高點"}</span><strong>{formatNumber(asset.high)}</strong></div><div><span>現價</span><strong>{formatNumber(asset.price)}</strong></div><div><span>回撤</span><strong>{asset.discount ?? "--"}%</strong></div><div><span>建議投入</span><strong>{parseAmount(asset.signal?.amount)}U</strong></div></div>
    <div className="nextBuyBox"><ProgressBar nextBuy={nextBuy} /></div>
    <details className="nextBuyBox"><summary style={{ cursor: "pointer", fontWeight: 900 }}>我的持倉</summary>
      <div className="dataGrid" style={{ marginTop: 12 }}>
        <div><span>持有數量</span><strong>{formatNumber(stats.quantity, 8)}</strong></div>
        <div><span>目前價值</span><strong>{formatNumber(stats.value)}U</strong></div>
        <div><span>成本來源</span><strong style={{ color: "#facc15" }}>待接幣安</strong></div>
        <div><span>損益來源</span><strong style={{ color: "#facc15" }}>待接幣安</strong></div>
      </div>
    </details>
  </div>;
}
