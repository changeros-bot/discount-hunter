import { useEffect, useMemo, useState } from "react";

const ruleColors = ["🟢", "🟡", "🟠", "🔴"];
const levelNames = ["", "第一層", "第二層", "第三層", "第四層"];
const levelClasses = ["idle", "level1", "level2", "level3", "level4"];
const REFRESH_MS = 5000;
const REALTIME_LIMIT_SEC = 8;
const DELAYED_LIMIT_SEC = 20;
const MODEL_VERSION = "13.7";

const SNAPSHOT = {
  AMDon: { quantity: 0.0091571, amount: 4.99, buyDate: "2026/06/16", layer: 0 },
  MRVLon: { quantity: 0.016591, amount: 4.99, buyDate: "2026/06/16", layer: 0 },
  RKLBon: { quantity: 0.046432, amount: 4.99, buyDate: "2026/06/16", layer: 1 },
  AVGOon: { quantity: 0.012659, amount: 4.99, buyDate: "2026/06/16", layer: 1 },
  TSMon: { quantity: 0.011408, amount: 4.99, buyDate: "2026/06/16", layer: 0 },
  QQQon: { quantity: 0.0067441, amount: 4.99, buyDate: "2026/06/16", layer: 0 },
  GOOGLon: { quantity: 0.01353, amount: 4.99, buyDate: "2026/06/16", layer: 0 },
  SPCXon: { quantity: 0.023336, amount: 4.99, buyDate: "2026/06/16", layer: 0 },
  NVDAon: { quantity: 0.02387, amount: 4.99, buyDate: "2026/06/16", layer: 0 }
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
function todayText() {
  const d = new Date();
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}
function secondsAgo(isoString) {
  if (!isoString) return null;
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  return Number.isFinite(diff) ? Math.max(diff, 0) : null;
}
function formatUpdateTime(isoString) {
  if (!isoString) return "讀取中";
  const d = new Date(isoString);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}
function buildDefaultHoldings() {
  return Object.fromEntries(Object.keys(SNAPSHOT).map((symbol) => [symbol, getDefaultHolding(symbol)]));
}
function getDefaultHolding(symbol) {
  const s = SNAPSHOT[symbol];
  if (!s) return { quantity: "", balance: "", cost: "", amount: "", buyDate: "", layer: 0, executedLevels: [], note: "" };
  const cost = s.quantity > 0 ? s.amount / s.quantity : 0;
  return {
    quantity: String(s.quantity),
    balance: String(s.quantity),
    cost: String(Number(cost.toFixed(6))),
    amount: String(s.amount),
    buyDate: s.buyDate,
    layer: s.layer,
    executedLevels: s.layer > 0 ? [s.layer] : [],
    note: s.layer > 0 ? "第一買點｜依 Binance 錢包餘額同步" : "DCA｜依 Binance 錢包餘額同步"
  };
}
function getNextBuyPoint(asset) {
  const discount = Number(asset.discount);
  const rules = asset.rules || [];
  const amounts = asset.amounts || [];
  if (!Number.isFinite(discount) || rules.length === 0) {
    return { label: "下一買點", text: "資料未就緒", amount: "0U", progress: 0, progressText: "區間完成度 0%", gapToNextLevel: null };
  }
  const nextIndex = rules.findIndex((rule) => discount > rule);
  if (nextIndex === -1) {
    return { label: "下一買點", text: "已達最深層", amount: "完成", progress: 100, progressText: "區間完成度 100%", gapToNextLevel: null };
  }
  const target = Number(rules[nextIndex]);
  const previous = nextIndex === 0 ? 0 : Number(rules[nextIndex - 1]);
  const gap = Math.max(0, discount - target);
  const range = Math.abs(target - previous) || 1;
  const rawProgress = ((previous - discount) / range) * 100;
  const progress = Math.min(100, Math.max(0, rawProgress));
  return {
    label: `${levelNames[nextIndex + 1]}買點`,
    text: `距${levelNames[nextIndex + 1]}買點 ${gap.toFixed(1)}%`,
    amount: `${amounts[nextIndex]}U`,
    progress,
    progressText: `區間完成度 ${progress.toFixed(1)}%`,
    gapToNextLevel: gap
  };
}
function getHoldingStats(asset, holding) {
  const quantity = Number(holding?.balance || holding?.quantity || holding?.qty || 0);
  const cost = Number(holding?.cost || 0);
  const price = Number(asset?.price || 0);
  const invested = Number(holding?.amount || 0) > 0 ? Number(holding.amount) : quantity * cost;
  const value = quantity * price;
  const pnl = value - invested;
  const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
  return { quantity, cost, invested, value, pnl, pnlPct, hasPosition: quantity > 0 && invested > 0 && price > 0 };
}

export default function IndexV15() {
  const [assets, setAssets] = useState([]);
  const [updatedAt, setUpdatedAt] = useState("");
  const [source, setSource] = useState("");
  const [warning, setWarning] = useState("");
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [holdings, setHoldings] = useState({});
  const [tradeHistory, setTradeHistory] = useState([]);
  const [health, setHealth] = useState(null);

  useEffect(() => {
    try {
      const storedVersion = localStorage.getItem("discountHunterModelVersion");
      if (storedVersion !== MODEL_VERSION) {
        const defaults = buildDefaultHoldings();
        setHoldings(defaults);
        localStorage.setItem("discountHunterHoldings", JSON.stringify(defaults));
        localStorage.setItem("discountHunterModelVersion", MODEL_VERSION);
      } else {
        setHoldings(JSON.parse(localStorage.getItem("discountHunterHoldings") || "{}"));
      }
    } catch { setHoldings(buildDefaultHoldings()); }
    try { setTradeHistory(JSON.parse(localStorage.getItem("discountHunterTradeHistory") || "[]")); } catch { setTradeHistory([]); }
  }, []);

  function saveHoldings(next) {
    setHoldings(next);
    localStorage.setItem("discountHunterHoldings", JSON.stringify(next));
    localStorage.setItem("discountHunterModelVersion", MODEL_VERSION);
  }
  function saveHistory(next) {
    setTradeHistory(next);
    localStorage.setItem("discountHunterTradeHistory", JSON.stringify(next));
  }
  function getEffectiveHolding(symbol) {
    return { ...getDefaultHolding(symbol), ...(holdings[symbol] || {}) };
  }
  function updateHoldingField(symbol, field, value) {
    saveHoldings({ ...holdings, [symbol]: { ...getEffectiveHolding(symbol), [field]: value } });
  }
  function toggleExecutedLevel(symbol, level) {
    const h = getEffectiveHolding(symbol);
    const current = h.executedLevels || [];
    const nextLevels = current.includes(level) ? current.filter((l) => l !== level) : [...current, level].sort();
    saveHoldings({ ...holdings, [symbol]: { ...h, executedLevels: nextLevels, layer: nextLevels[nextLevels.length - 1] || 0 } });
  }
  function recordTrade(asset, level) {
    const h = getEffectiveHolding(asset.symbol);
    const amount = parseAmount(asset.amounts?.[level - 1] || asset.signal?.amount || 0);
    const record = { id: `${Date.now()}-${asset.symbol}-${level}`, date: todayText(), symbol: asset.symbol, level, levelName: levelNames[level] || "DCA", amount, price: Number(asset.price || 0), note: h.note || "" };
    const nextLevels = level > 0 ? Array.from(new Set([...(h.executedLevels || []), level])).sort() : (h.executedLevels || []);
    saveHoldings({ ...holdings, [asset.symbol]: { ...h, layer: level || h.layer || 0, executedLevels: nextLevels, buyDate: h.buyDate || todayText() } });
    saveHistory([record, ...tradeHistory]);
  }
  function deleteTrade(id) { saveHistory(tradeHistory.filter((t) => t.id !== id)); }
  function syncSnapshot() {
    const nextHoldings = buildDefaultHoldings();
    const newHistory = tradeHistory.filter((t) => t.note !== "依 Binance 錢包餘額同步");
    Object.entries(SNAPSHOT).forEach(([symbol, s], index) => {
      newHistory.unshift({ id: `snapshot-${MODEL_VERSION}-${index}-${symbol}`, date: s.buyDate, symbol, level: s.layer, levelName: s.layer > 0 ? levelNames[s.layer] : "DCA", amount: s.amount, price: s.quantity > 0 ? s.amount / s.quantity : 0, note: "依 Binance 錢包餘額同步" });
    });
    saveHoldings(nextHoldings);
    saveHistory(newHistory);
    alert("已同步目前 9 檔 Binance 錢包餘額資料。之後鏈上同步會覆蓋這裡。");
  }
  function exportBackup() {
    const payload = { version: MODEL_VERSION, exportDate: new Date().toISOString(), holdings, tradeHistory };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `discount-hunter-backup-${todayText().replaceAll("/", "")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function importBackup(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result || "{}"));
        if (data.holdings && typeof data.holdings === "object") saveHoldings(data.holdings);
        if (Array.isArray(data.tradeHistory)) saveHistory(data.tradeHistory);
        alert("匯入完成");
      } catch { alert("匯入失敗：JSON格式錯誤"); }
    };
    reader.readAsText(file);
    e.target.value = "";
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
        setWarning(data.warning || "");
        setError(data.error || "");
      } catch (err) { setError(err.message || "資料讀取失敗"); }
      finally { setRefreshing(false); }
    }
    async function loadHealth() {
      try {
        const res = await fetch(`/api/binance-health?t=${Date.now()}`, { cache: "no-store" });
        setHealth(await res.json());
      } catch { setHealth({ ok: false, label: "🔴 Binance API檢查失敗", symbolsFound: 0, symbolsExpected: 9 }); }
    }
    loadPrices(); loadHealth();
    const priceTimer = setInterval(loadPrices, REFRESH_MS);
    const healthTimer = setInterval(loadHealth, 30000);
    return () => { clearInterval(priceTimer); clearInterval(healthTimer); };
  }, []);

  const dataReady = !warning && !error && assets.length > 0;
  const age = secondsAgo(updatedAt);
  const syncLabel = age === null ? "自動同步中" : age <= REALTIME_LIMIT_SEC ? "實時同步" : age <= DELAYED_LIMIT_SEC ? "同步延遲" : "資料逾時";
  const syncClass = age === null ? "syncPending" : age <= REALTIME_LIMIT_SEC ? "syncLive" : age <= DELAYED_LIMIT_SEC ? "syncLag" : "syncStale";
  const sortedAssets = useMemo(() => [...assets].sort((a, b) => {
    const aSignal = a.signal?.level || 0;
    const bSignal = b.signal?.level || 0;
    const aScore = (aSignal > 0 ? 1000 : 0) + aSignal + Math.abs(Number(a.discount || 0)) / 100;
    const bScore = (bSignal > 0 ? 1000 : 0) + bSignal + Math.abs(Number(b.discount || 0)) / 100;
    return bScore - aScore;
  }), [assets]);
  const buyList = dataReady ? sortedAssets.filter((a) => a.signal?.level > 0) : [];
  const idleList = dataReady ? sortedAssets.filter((a) => !a.signal?.level) : [];
  const totalAmount = buyList.reduce((sum, asset) => sum + parseAmount(asset.signal?.amount), 0);
  const portfolio = assets.reduce((sum, asset) => {
    const stats = getHoldingStats(asset, getEffectiveHolding(asset.symbol));
    return { invested: sum.invested + stats.invested, value: sum.value + stats.value, pnl: sum.pnl + stats.pnl, count: sum.count + (stats.hasPosition ? 1 : 0) };
  }, { invested: 0, value: 0, pnl: 0, count: 0 });
  const portfolioPct = portfolio.invested > 0 ? (portfolio.pnl / portfolio.invested) * 100 : 0;

  return <main className="page">
    <section className="hero compactHero">
      <h1 style={{ fontSize: "34px", fontWeight: 950, margin: "6px 0 4px" }}>美股DCA折價獵人</h1>
      <div className="versionPill">V13.7 測試版</div>
      <h2 style={{ fontSize: "17px", margin: "12px 0 6px", color: "#cbd5e1" }}>Binance xStocks 戰情室</h2>
      <p>真實資料源：Binance xStocks Public API｜以 Binance 52週高點計算回撤。</p>
      <div className="update">更新：{formatUpdateTime(updatedAt)}</div>
      <div className={`syncPill ${syncClass}`}>{refreshing ? "自動更新中…" : syncLabel}{age !== null ? `｜${age}秒前｜每5秒自動更新` : ""}</div>
      {source && <div className="sourcePill">資料源：{source}</div>}
      <section style={{ marginTop: 12, padding: 12, borderRadius: 14, background: "#0f172a", border: "1px solid #1e293b", textAlign: "left" }}>
        <div style={{ fontWeight: 900, marginBottom: 6 }}>{health?.label || "🟡 Binance API檢查中"}</div>
        <div style={{ fontSize: 13, color: "#cbd5e1" }}>標的在線：{health?.symbolsFound ?? "--"}/{health?.symbolsExpected ?? 9}</div>
        <div style={{ fontSize: 13, color: "#cbd5e1" }}>API延遲：{health?.latencyMs ? `${health.latencyMs}ms` : "--"}</div>
        <div style={{ fontSize: 13, color: "#cbd5e1" }}>系統狀態：Price Engine / Signal Engine / Auto Refresh</div>
      </section>
    </section>
    {!dataReady && <section className="dataGuard"><strong>資料源未就緒</strong><p>{error || "等待 Binance xStocks 真實行情資料。"}</p><span>保護規則：沒有真實 Binance xStocks 資料，就不顯示訊號。</span></section>}
    {dataReady && <TodayExecution buyList={buyList} totalAmount={totalAmount} />}
    <section className="warRoom"><div className="warRoomHeader" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}><div><span>持倉市值</span><strong>{formatNumber(portfolio.value)}U</strong></div><div><span>未實現損益</span><strong style={{ color: portfolio.pnl >= 0 ? "#22c55e" : "#ef4444" }}>{formatNumber(portfolio.pnl)}U</strong></div></div>{portfolio.invested > 0 && <div style={{ color: portfolio.pnl >= 0 ? "#bbf7d0" : "#fecaca", fontWeight: 900, textAlign: "center", marginTop: 12 }}>總投入 {formatNumber(portfolio.invested)}U｜報酬 {portfolioPct.toFixed(2)}%｜持倉 {portfolio.count} 檔</div>}</section>
    <section className="quickRule"><div><span>🟢 第一層</span><strong>5U</strong></div><div><span>🟡 第二層</span><strong>10U</strong></div><div><span>🟠 第三層</span><strong>15U</strong></div><div><span>🔴 第四層</span><strong>20U</strong></div></section>
    {dataReady && <section className="sectionTitle"><h2>監控清單</h2><p>沿用 V13 版型；進度條顯示可驗算的區間完成度。</p></section>}
    {dataReady && <section className="list">{buyList.map((asset) => <AssetCard asset={asset} holding={getEffectiveHolding(asset.symbol)} key={asset.symbol} />)}{idleList.length > 0 && <details className="idleGroup" style={{ marginTop: 16 }}><summary>尚未到買點｜{idleList.length} 檔</summary><div className="idleList">{idleList.map((asset) => <AssetCard asset={asset} holding={getEffectiveHolding(asset.symbol)} key={asset.symbol} />)}</div></details>}</section>}
    <details className="idleGroup" style={{ marginTop: 16 }}><summary>持倉管理控制台</summary><HoldingsManager assets={assets} getEffectiveHolding={getEffectiveHolding} updateHoldingField={updateHoldingField} toggleExecutedLevel={toggleExecutedLevel} recordTrade={recordTrade} syncSnapshot={syncSnapshot} exportBackup={exportBackup} importBackup={importBackup} /></details>
    <details className="idleGroup" style={{ marginTop: 16 }}><summary>交易日誌｜{tradeHistory.length} 筆</summary><TradeJournal tradeHistory={tradeHistory} deleteTrade={deleteTrade} /></details>
    <section className="infoFooter"><h2>V13.7 產品原則</h2><p>進度條 = 區間完成度。AVGO 約84%、RKLB 約36.7% 才算合理。</p></section>
  </main>;
}

function TodayExecution({ buyList, totalAmount }) {
  return <section style={{ margin: "16px 0", padding: "16px", background: "#1e293b", borderRadius: "16px", border: "2px solid #3b82f6" }}><h2 style={{ fontSize: "20px", fontWeight: 800, color: "#3b82f6", margin: "0 0 12px 0" }}>⚡ 今日執行</h2>{buyList.length > 0 ? <div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "0 8px 8px 8px", borderBottom: "1px solid #334155", color: "#94a3b8", fontSize: 13, fontWeight: 700 }}><div>標的</div><div style={{ textAlign: "center" }}>買點層級</div><div style={{ textAlign: "right" }}>建議投入</div></div><div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>{buyList.map((asset) => { const level = asset.signal?.level || 0; return <div key={asset.symbol} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "10px 8px", background: "#0f172a", borderRadius: 10, alignItems: "center", fontSize: 15 }}><div style={{ fontWeight: 900 }}>{asset.symbol}</div><div style={{ textAlign: "center", color: "#fcd34d", fontWeight: 800 }}>{ruleColors[level - 1]} {levelNames[level]}</div><div style={{ textAlign: "right", fontWeight: 900, color: "#4ade80" }}>{parseAmount(asset.signal?.amount)}U</div></div>; })}</div><div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #334155", display: "flex", justifyContent: "space-between", fontWeight: 900, color: "#fff" }}><span>今日總投入</span><span style={{ color: "#4ade80", fontSize: 20 }}>{totalAmount}U</span></div></div> : <div style={{ padding: "16px 0", textAlign: "center", color: "#94a3b8", fontSize: 14 }}>今天無任何標的觸發買點。</div>}</section>;
}
function ProgressBar({ nextBuy }) {
  const pct = Math.min(100, Math.max(0, Number(nextBuy.progress || 0)));
  return <div><div style={{ display: "flex", justifyContent: "space-between", gap: 8, margin: "6px 0 8px", fontSize: 12, color: "#cbd5e1", fontWeight: 900 }}><span>{nextBuy.progressText}</span><span>{pct.toFixed(1)}%</span></div><div style={{ height: 10, width: "100%", background: "rgba(148,163,184,.22)", borderRadius: 999, overflow: "hidden" }}><div style={{ width: `${pct}%`, height: "100%", background: "#22c55e", borderRadius: 999 }} /></div></div>;
}
function AssetCard({ asset, holding }) {
  const level = asset.signal?.level || 0;
  const levelClass = levelClasses[level] || "idle";
  const nextBuy = getNextBuyPoint(asset);
  const stats = getHoldingStats(asset, holding);
  const executedLevels = holding?.executedLevels || [];
  return <div className={`card ${level > 0 ? "active" : "idle"} ${levelClass}`}><div className="cardTop"><div className="titleRow"><div className="logoText">{asset.symbol.slice(0, 2)}</div><div><h2>{asset.symbol}</h2><p>{asset.name}</p><p className="desc">{asset.grade}級 ｜ {asset.description}</p></div></div><div className="badge">{asset.grade}級</div></div><div className={`signal ${levelClass}`}>{level > 0 ? `${ruleColors[level - 1]} ${levelNames[level]}｜建議 ${parseAmount(asset.signal?.amount)}U` : "尚未到買點"}</div><div className="dataGrid"><div><span>{asset.highType || "52週高點"}</span><strong>{formatNumber(asset.high)}</strong></div><div><span>現價</span><strong>{formatNumber(asset.price)}</strong></div><div><span>回撤</span><strong>{asset.discount ?? "--"}%</strong></div><div><span>建議投入</span><strong>{parseAmount(asset.signal?.amount)}U</strong></div></div><div className="nextBuyBox"><div className="nextBuyTop"><span>{nextBuy.label}</span><strong>{nextBuy.amount}</strong></div><p>{nextBuy.text}</p><ProgressBar nextBuy={nextBuy} /></div><details className="nextBuyBox"><summary style={{ cursor: "pointer", fontWeight: 900 }}>我的持倉 / 未實現損益</summary><div className="dataGrid" style={{ marginTop: 12 }}><div><span>持有數量</span><strong>{formatNumber(stats.quantity, 8)}</strong></div><div><span>平均成本</span><strong>{formatNumber(stats.cost)}</strong></div><div><span>投入成本</span><strong>{formatNumber(stats.invested)}U</strong></div><div><span>市值</span><strong>{formatNumber(stats.value)}U</strong></div><div><span>損益</span><strong style={{ color: stats.pnl >= 0 ? "#22c55e" : "#ef4444" }}>{formatNumber(stats.pnl)}U</strong></div><div><span>報酬</span><strong style={{ color: stats.pnl >= 0 ? "#22c55e" : "#ef4444" }}>{stats.hasPosition ? stats.pnlPct.toFixed(2) : "0.00"}%</strong></div></div>{holding?.buyDate && <div style={{ marginTop: 8, padding: "6px 10px", background: "#1e293b", borderRadius: 6, fontSize: 12, color: "#cbd5e1", borderLeft: "3px solid #3b82f6" }}>📅 買入日期：{holding.buyDate}</div>}{executedLevels.length > 0 && <div style={{ marginTop: 8, fontSize: 12, color: "#cbd5e1" }}>已執行：{executedLevels.map((l) => `${ruleColors[l - 1]}${levelNames[l]}`).join("、")}</div>}{holding?.note && <div style={{ marginTop: 8, padding: "6px 10px", background: "#1e293b", borderRadius: 6, fontSize: 12, color: "#cbd5e1", borderLeft: "3px solid #3b82f6" }}>✏️ 備註：{holding.note}</div>}</details><div className="ruleBox"><h4>買點規則</h4>{asset.rules?.map((rule, idx) => <div key={idx} className={level === idx + 1 ? "rule activeRule" : "rule"}><span>{ruleColors[idx]} 第{idx + 1}層</span><strong>{rule}% → {asset.amounts?.[idx]}U</strong></div>)}</div></div>;
}
function HoldingsManager({ assets, getEffectiveHolding, updateHoldingField, toggleExecutedLevel, recordTrade, syncSnapshot, exportBackup, importBackup }) {
  return <section style={{ marginTop: 12 }}><button onClick={syncSnapshot} style={managerButton("#f59e0b", true)}>📥 同步目前9檔錢包餘額</button><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: "10px 0" }}><button onClick={exportBackup} style={managerButton("#16a34a", true)}>⬇️ 匯出JSON</button><label style={{ ...managerButton("#7c3aed", true), textAlign: "center" }}>⬆️ 匯入JSON<input type="file" accept="application/json" onChange={importBackup} style={{ display: "none" }} /></label></div>{assets.map((asset) => { const h = getEffectiveHolding(asset.symbol); return <div key={asset.symbol} style={{ background: "#0f172a", padding: 12, borderRadius: 12, border: "1px solid #334155", marginBottom: 12 }}><div style={{ fontWeight: 900, marginBottom: 8 }}>{asset.symbol}</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><input value={h.balance || h.quantity || ""} onChange={(e) => updateHoldingField(asset.symbol, "balance", e.target.value)} placeholder="balance 餘額/持有數量" style={managerInput} /><input value={h.amount || ""} onChange={(e) => updateHoldingField(asset.symbol, "amount", e.target.value)} placeholder="amount 投入成本U" style={managerInput} /><input value={h.cost || ""} onChange={(e) => updateHoldingField(asset.symbol, "cost", e.target.value)} placeholder="cost 平均成本" style={managerInput} /><input value={h.buyDate || ""} onChange={(e) => updateHoldingField(asset.symbol, "buyDate", e.target.value)} placeholder="buyDate 2026/06/16" style={managerInput} /></div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, marginTop: 8 }}>{[1, 2, 3, 4].map((lvl) => <button key={lvl} onClick={() => toggleExecutedLevel(asset.symbol, lvl)} style={managerButton(h.executedLevels?.includes(lvl) ? "#2563eb" : "#1e293b", true)}>{h.executedLevels?.includes(lvl) ? "✅" : "⬜"} {lvl}</button>)}</div><button onClick={() => recordTrade(asset, asset.signal?.level || 1)} style={{ ...managerButton("#0ea5e9", true), marginTop: 8 }}>記錄目前買點</button></div>; })}</section>;
}
function TradeJournal({ tradeHistory, deleteTrade }) {
  const grouped = tradeHistory.reduce((acc, t) => { acc[t.date] = acc[t.date] || []; acc[t.date].push(t); return acc; }, {});
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
  return <section style={{ marginTop: 12 }}>{dates.length === 0 ? <div style={{ color: "#94a3b8", fontSize: 14 }}>尚無交易紀錄。</div> : dates.map((date) => <div key={date} style={{ marginTop: 10 }}><div style={{ color: "#facc15", fontWeight: 900, marginBottom: 6 }}>{date}</div>{grouped[date].map((t) => <div key={t.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center", background: "#0f172a", padding: "8px 10px", borderRadius: 10, marginBottom: 6 }}><div><strong>{t.symbol}</strong>｜{t.levelName}｜{formatNumber(t.amount)}U<span style={{ color: "#94a3b8", fontSize: 12 }}>｜價 {formatNumber(t.price)}</span></div><button onClick={() => deleteTrade(t.id)} style={{ background: "#334155", color: "#cbd5e1", border: "none", borderRadius: 8, padding: "4px 8px" }}>刪</button></div>)}</div>)}</section>;
}
const managerInput = { width: "100%", borderRadius: 8, border: "1px solid #334155", background: "#1e293b", color: "white", padding: 8 };
const managerButton = (color, full = false) => ({ width: full ? "100%" : undefined, padding: "8px", borderRadius: 8, border: "1px solid #334155", background: color, color: "white", fontWeight: 800, cursor: "pointer", fontSize: 12 });
