import { useEffect, useMemo, useState } from "react";

const MODEL_VERSION = "14.0";
const REFRESH_MS = 5000;
const ruleColors = ["🟢", "🟡", "🟠", "🔴"];
const levelNames = ["", "第一層", "第二層", "第三層", "第四層"];

const DEFAULT_HOLDINGS = {
  AMDon: { balance: "0.0091571", amount: "4.99", cost: "545.0006", buyDate: "2026/06/16", note: "V13.8 snapshot" },
  MRVLon: { balance: "0.016591", amount: "4.99", cost: "300.7655", buyDate: "2026/06/16", note: "V13.8 snapshot" },
  RKLBon: { balance: "0.046432", amount: "4.99", cost: "107.4686", buyDate: "2026/06/16", note: "V13.8 snapshot" },
  AVGOon: { balance: "0.012659", amount: "4.99", cost: "394.1860", buyDate: "2026/06/16", note: "V13.8 snapshot" },
  TSMon: { balance: "0.011408", amount: "4.99", cost: "437.4123", buyDate: "2026/06/16", note: "V13.8 snapshot" },
  SPCXon: { balance: "0.023336", amount: "4.99", cost: "213.8336", buyDate: "2026/06/16", note: "V13.8 snapshot" },
  NVDAon: { balance: "0.02387", amount: "4.99", cost: "209.0490", buyDate: "2026/06/16", note: "V13.8 snapshot" }
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

function isWalletAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value || "").trim());
}

function getStats(asset, holding) {
  const quantity = Number(holding?.balance || holding?.quantity || 0);
  const price = Number(asset?.price || 0);
  const cost = Number(holding?.cost || 0);
  const invested = Number(holding?.amount || 0) > 0 ? Number(holding.amount) : quantity * cost;
  const value = quantity * price;
  const pnl = value - invested;
  const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
  return { quantity, price, cost, invested, value, pnl, pnlPct, hasPosition: quantity > 0 && price > 0 };
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

const inputStyle = { width: "100%", borderRadius: 10, border: "1px solid #334155", background: "#0f172a", color: "white", padding: 10, boxSizing: "border-box" };
const buttonStyle = { width: "100%", borderRadius: 10, border: "1px solid #334155", background: "#2563eb", color: "white", padding: 10, fontWeight: 900 };

export default function Home() {
  const [assets, setAssets] = useState([]);
  const [updatedAt, setUpdatedAt] = useState("");
  const [source, setSource] = useState("");
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [holdings, setHoldings] = useState({});
  const [walletAddress, setWalletAddress] = useState("");
  const [walletStatus, setWalletStatus] = useState("");
  const [syncingWallet, setSyncingWallet] = useState(false);

  useEffect(() => {
    try {
      const storedVersion = localStorage.getItem("discountHunterModelVersion");
      const stored = JSON.parse(localStorage.getItem("discountHunterHoldings") || "{}");
      setHoldings(storedVersion ? stored : DEFAULT_HOLDINGS);
      if (!storedVersion) localStorage.setItem("discountHunterHoldings", JSON.stringify(DEFAULT_HOLDINGS));
      localStorage.setItem("discountHunterModelVersion", MODEL_VERSION);
      setWalletAddress(localStorage.getItem("discountHunterWalletAddress") || "");
    } catch {
      setHoldings(DEFAULT_HOLDINGS);
    }
  }, []);

  function saveHoldings(next) {
    setHoldings(next);
    localStorage.setItem("discountHunterHoldings", JSON.stringify(next));
    localStorage.setItem("discountHunterModelVersion", MODEL_VERSION);
  }

  function getHolding(symbol) {
    return { ...(DEFAULT_HOLDINGS[symbol] || {}), ...(holdings[symbol] || {}) };
  }

  function updateHolding(symbol, field, value) {
    saveHoldings({ ...holdings, [symbol]: { ...getHolding(symbol), [field]: value } });
  }

  async function syncWalletHoldings() {
    const address = walletAddress.trim();
    if (!isWalletAddress(address)) {
      setWalletStatus("請輸入正確的 0x 錢包地址");
      return;
    }
    setSyncingWallet(true);
    setWalletStatus("同步中...");
    try {
      const res = await fetch(`/api/wallet-holdings?address=${encodeURIComponent(address)}&t=${Date.now()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || data.error || "wallet sync failed");
      const next = { ...holdings };
      (data.holdings || []).forEach((item) => {
        const qty = Number(item.quantity || item.balance || 0);
        if (item.symbol && qty > 0) {
          const old = getHolding(item.symbol);
          next[item.symbol] = {
            ...old,
            balance: String(item.balance || item.quantity),
            quantity: String(item.quantity || item.balance),
            note: `鏈上同步｜${item.status}｜chain ${item.chainId}`,
            walletAddress: address,
            contractAddress: item.contractAddress,
            chainId: item.chainId,
            syncedAt: data.updatedAt
          };
        }
      });
      saveHoldings(next);
      localStorage.setItem("discountHunterWalletAddress", address);
      setWalletStatus(`同步完成：找到 ${data.activeCount || 0} 檔持倉`);
    } catch (err) {
      setWalletStatus(`同步失敗：${err.message}`);
    } finally {
      setSyncingWallet(false);
    }
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
  const totalAmount = buyList.reduce((sum, asset) => sum + parseAmount(asset.signal?.amount), 0);
  const portfolio = assets.reduce((sum, asset) => {
    const stats = getStats(asset, getHolding(asset.symbol));
    return { value: sum.value + stats.value, invested: sum.invested + stats.invested, pnl: sum.pnl + stats.pnl, count: sum.count + (stats.hasPosition ? 1 : 0) };
  }, { value: 0, invested: 0, pnl: 0, count: 0 });
  const portfolioPct = portfolio.invested > 0 ? (portfolio.pnl / portfolio.invested) * 100 : 0;

  return <main className="page">
    <section className="hero compactHero">
      <h1 style={{ fontSize: 34, fontWeight: 950, margin: "6px 0 4px" }}>DCA折價獵人</h1>
      <div className="versionPill">V14 Wallet Sync Beta</div>
      <h2 style={{ fontSize: 17, margin: "12px 0 6px", color: "#cbd5e1" }}>Binance xStocks 戰情室</h2>
      <p>真實資料源：Binance xStocks Public API｜Wallet 讀取：BSC balanceOf。</p>
      <div className="update">更新：{formatTime(updatedAt)}</div>
      <div className="syncPill syncLive">{refreshing ? "自動更新中…" : "LIVE｜每5秒自動更新"}</div>
      {source && <div className="sourcePill">資料源：{source}</div>}
      {error && <div className="dataGuard">{error}</div>}
    </section>

    <section className="warRoom">
      <div className="warRoomHeader" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><span>持倉市值</span><strong>{formatNumber(portfolio.value)}U</strong></div>
        <div><span>未實現損益</span><strong style={{ color: portfolio.pnl >= 0 ? "#22c55e" : "#ef4444" }}>{formatNumber(portfolio.pnl)}U</strong></div>
      </div>
      <div style={{ color: portfolio.pnl >= 0 ? "#bbf7d0" : "#fecaca", fontWeight: 900, textAlign: "center", marginTop: 12 }}>
        總投入 {formatNumber(portfolio.invested)}U｜報酬 {portfolioPct.toFixed(2)}%｜持倉 {portfolio.count} 檔
      </div>
    </section>

    <section style={{ margin: "16px 0", padding: 16, background: "#1e293b", borderRadius: 16, border: "2px solid #f59e0b" }}>
      <h2 style={{ fontSize: 20, fontWeight: 900, color: "#f59e0b", margin: "0 0 12px" }}>⚠️ 注意</h2>
      {buyList.length > 0 ? <>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", color: "#94a3b8", fontSize: 13, fontWeight: 800, paddingBottom: 8, borderBottom: "1px solid #334155" }}>
          <div>標的</div><div style={{ textAlign: "center" }}>買點層級</div><div style={{ textAlign: "right" }}>建議投入</div>
        </div>
        {buyList.map((asset) => {
          const level = asset.signal?.level || 0;
          return <div key={asset.symbol} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "10px 8px", background: "#0f172a", borderRadius: 10, marginTop: 8 }}>
            <div style={{ fontWeight: 900 }}>{asset.symbol}</div>
            <div style={{ textAlign: "center", color: "#fcd34d", fontWeight: 900 }}>{ruleColors[level - 1]} {levelNames[level]}</div>
            <div style={{ textAlign: "right", color: "#4ade80", fontWeight: 900 }}>{parseAmount(asset.signal?.amount)}U</div>
          </div>;
        })}
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #334155", display: "flex", justifyContent: "space-between", fontWeight: 900 }}><span>今日總投入</span><span style={{ color: "#4ade80" }}>{totalAmount}U</span></div>
      </> : <div style={{ color: "#94a3b8", textAlign: "center" }}>今天無任何標的觸發買點。</div>}
    </section>

    <details className="idleGroup" open style={{ marginTop: 16 }}>
      <summary>V14 錢包同步</summary>
      <section style={{ marginTop: 12, display: "grid", gap: 8 }}>
        <input value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)} placeholder="貼上 Binance Wallet / BSC 0x 地址" style={inputStyle} />
        <button onClick={syncWalletHoldings} disabled={syncingWallet} style={buttonStyle}>{syncingWallet ? "同步中..." : "同步鏈上持倉"}</button>
        <div style={{ color: "#cbd5e1", fontSize: 13 }}>{walletStatus || "只讀取公開鏈上餘額，不需要 API Key，不會交易。"}</div>
      </section>
    </details>

    <section className="sectionTitle"><h2>監控清單</h2><p>排序：買點層級優先，其次依回撤幅度。</p></section>
    <section className="list">
      {sortedAssets.map((asset) => <AssetCard key={asset.symbol} asset={asset} holding={getHolding(asset.symbol)} updateHolding={updateHolding} />)}
    </section>

    <section className="infoFooter"><h2>V14 產品原則</h2><p>Binance 提供行情與 token metadata；鏈上 balanceOf 讀取真實 wallet 持倉；成本價先保留手動紀錄。</p></section>
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

function AssetCard({ asset, holding, updateHolding }) {
  const level = asset.signal?.level || 0;
  const stats = getStats(asset, holding);
  const nextBuy = getNextBuyPoint(asset);
  return <div className={`card ${level > 0 ? "active" : "idle"}`}>
    <div className="cardTop"><div className="titleRow"><div className="logoText">{asset.symbol.slice(0, 2)}</div><div><h2>{asset.symbol}</h2><p>{asset.name}</p><p className="desc">{asset.grade}級 ｜ {asset.description}</p></div></div><div className="badge">{asset.grade}級</div></div>
    <div className="signal">{level > 0 ? `${ruleColors[level - 1]} ${levelNames[level]}｜建議 ${parseAmount(asset.signal?.amount)}U` : "尚未到買點"}</div>
    <div className="dataGrid"><div><span>{asset.highType || "52週高點"}</span><strong>{formatNumber(asset.high)}</strong></div><div><span>現價</span><strong>{formatNumber(asset.price)}</strong></div><div><span>回撤</span><strong>{asset.discount ?? "--"}%</strong></div><div><span>建議投入</span><strong>{parseAmount(asset.signal?.amount)}U</strong></div></div>
    <div className="nextBuyBox"><ProgressBar nextBuy={nextBuy} /></div>
    <details className="nextBuyBox"><summary style={{ cursor: "pointer", fontWeight: 900 }}>我的持倉 / 未實現損益</summary>
      <div className="dataGrid" style={{ marginTop: 12 }}><div><span>持有數量</span><strong>{formatNumber(stats.quantity, 8)}</strong></div><div><span>平均成本</span><strong>{formatNumber(stats.cost)}</strong></div><div><span>投入成本</span><strong>{formatNumber(stats.invested)}U</strong></div><div><span>市值</span><strong>{formatNumber(stats.value)}U</strong></div><div><span>損益</span><strong style={{ color: stats.pnl >= 0 ? "#22c55e" : "#ef4444" }}>{formatNumber(stats.pnl)}U</strong></div><div><span>報酬</span><strong style={{ color: stats.pnl >= 0 ? "#22c55e" : "#ef4444" }}>{stats.hasPosition ? stats.pnlPct.toFixed(2) : "0.00"}%</strong></div></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}><input value={holding?.balance || ""} onChange={(e) => updateHolding(asset.symbol, "balance", e.target.value)} placeholder="持有數量" style={inputStyle} /><input value={holding?.amount || ""} onChange={(e) => updateHolding(asset.symbol, "amount", e.target.value)} placeholder="投入成本U" style={inputStyle} /><input value={holding?.cost || ""} onChange={(e) => updateHolding(asset.symbol, "cost", e.target.value)} placeholder="平均成本" style={inputStyle} /><input value={holding?.buyDate || ""} onChange={(e) => updateHolding(asset.symbol, "buyDate", e.target.value)} placeholder="買入日期" style={inputStyle} /></div>
      {holding?.note && <div style={{ marginTop: 8, padding: "6px 10px", background: "#1e293b", borderRadius: 6, fontSize: 12, color: "#cbd5e1", borderLeft: "3px solid #3b82f6" }}>✏️ {holding.note}</div>}
    </details>
  </div>;
}
