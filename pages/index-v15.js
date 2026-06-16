import { useEffect, useMemo, useRef, useState } from "react";

const ruleColors = ["🟢", "🟡", "🟠", "🔴"];
const levelNames = ["", "第一層", "第二層", "第三層", "第四層"];
const REFRESH_MS = 5000;
const REALTIME_LIMIT_SEC = 8;
const PRICE_MOVE_EPSILON = 0.005;

const SNAPSHOT = {
  RKLBon: { value: 5.11802, price: 110.22, type: "dipBuy", levels: [1], label: "第一買點" },
  AVGOon: { value: 4.96575, price: 393.84, type: "dipBuy", levels: [1], label: "第一買點" },
  MRVLon: { value: 5.08161, price: 306.68, type: "monthlyDca", levels: [], label: "DCA" },
  NVDAon: { value: 5.0423, price: 211.43, type: "monthlyDca", levels: [], label: "DCA" },
  TSMon: { value: 4.99885, price: 441.19, type: "monthlyDca", levels: [], label: "DCA" },
  AMDon: { value: 5.02267, price: 548.49, type: "monthlyDca", levels: [], label: "DCA" },
  QQQon: { value: 5.01754, price: 745.9, type: "monthlyDca", levels: [], label: "DCA" },
  GOOGLon: { value: 4.96886, price: 367.97, type: "monthlyDca", levels: [], label: "DCA" },
  SPCXon: { value: 4.90445, price: 212.62, type: "monthlyDca", levels: [], label: "DCA" }
};

function parseAmount(value) {
  const n = Number(String(value || "0").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function fmt(value, digits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "--";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
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
function getDefaultType(symbol) {
  return SNAPSHOT[symbol]?.type || "dipBuy";
}
function getNextBuyPoint(asset) {
  const discount = Number(asset.discount);
  const rules = asset.rules || [];
  const amounts = asset.amounts || [];
  if (!Number.isFinite(discount) || !rules.length) return { nextIndex: 0, label: "下一買點", text: "資料未就緒", amount: "0U", progress: 0, gap: null, target: null };
  const nextIndex = rules.findIndex((rule) => discount > rule);
  if (nextIndex === -1) return { nextIndex: rules.length, label: "已達最深層", text: "已達最深層", amount: "完成", progress: 100, gap: null, target: null };
  const target = rules[nextIndex];
  const previous = nextIndex === 0 ? 0 : rules[nextIndex - 1];
  const gap = Math.max(0, discount - target);
  const range = Math.abs(target - previous) || 1;
  const progress = Math.min(100, Math.max(0, ((previous - discount) / range) * 100));
  return { nextIndex, label: `${levelNames[nextIndex + 1]}買點`, text: `還差 ${gap.toFixed(1)}% 到 ${target}%`, amount: `${amounts[nextIndex]}U`, progress, gap, target };
}
function getHoldingStats(asset, holding) {
  const qty = Number(holding?.qty || 0);
  const cost = Number(holding?.cost || 0);
  const price = Number(asset?.price || holding?.lastPrice || 0);
  const invested = qty * cost;
  const value = qty * price;
  const pnl = value - invested;
  const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
  return { qty, cost, invested, value, pnl, pnlPct, hasPosition: qty > 0 && cost > 0 && price > 0 };
}
function buildTrade(symbol, level, amount, price, note) {
  return { id: `${Date.now()}-${Math.random().toString(16).slice(2)}-${symbol}-${level}`, date: todayText(), symbol, level, levelName: level ? levelNames[level] : "DCA", amount, price: Number(price || 0), note: note || "" };
}
function applyBuy(holding, asset, level, amount) {
  const price = Number(asset.price || 0);
  const oldQty = Number(holding?.qty || 0);
  const oldCost = Number(holding?.cost || 0);
  const buyQty = price > 0 ? amount / price : 0;
  const newQty = oldQty + buyQty;
  const newCost = newQty > 0 ? ((oldQty * oldCost) + amount) / newQty : price;
  const levels = level > 0 ? Array.from(new Set([...(holding?.executedLevels || []), level])).sort() : (holding?.executedLevels || []);
  return { ...(holding || {}), type: holding?.type || getDefaultType(asset.symbol), qty: String(Number(newQty.toFixed(10))), cost: String(Number(newCost.toFixed(6))), lastPrice: price, executedLevels: levels, note: holding?.note || "" };
}

export default function IndexV15() {
  const [assets, setAssets] = useState([]);
  const [priceDirections, setPriceDirections] = useState({});
  const [updatedAt, setUpdatedAt] = useState("");
  const [source, setSource] = useState("");
  const [warning, setWarning] = useState("");
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [holdings, setHoldings] = useState({});
  const [tradeHistory, setTradeHistory] = useState([]);
  const [health, setHealth] = useState(null);
  const assetsRef = useRef([]);

  useEffect(() => {
    try { setHoldings(JSON.parse(localStorage.getItem("discountHunterHoldings") || "{}")); } catch { setHoldings({}); }
    try { setTradeHistory(JSON.parse(localStorage.getItem("discountHunterTradeHistory") || "[]")); } catch { setTradeHistory([]); }
  }, []);

  function saveHoldings(next) { setHoldings(next); localStorage.setItem("discountHunterHoldings", JSON.stringify(next)); }
  function saveHistory(next) { setTradeHistory(next); localStorage.setItem("discountHunterTradeHistory", JSON.stringify(next)); }
  function updateHoldingField(symbol, field, value) {
    const next = { ...holdings, [symbol]: { ...(holdings[symbol] || { type: getDefaultType(symbol), executedLevels: [], qty: "", cost: "", note: "" }), [field]: value } };
    saveHoldings(next);
  }
  function toggleExecutedLevel(symbol, level) {
    const h = holdings[symbol] || { type: getDefaultType(symbol), executedLevels: [], qty: "", cost: "", note: "" };
    const current = h.executedLevels || [];
    updateHoldingField(symbol, "executedLevels", current.includes(level) ? current.filter((l) => l !== level) : [...current, level].sort());
  }
  function addTrade(asset, level) {
    const amount = parseAmount(asset.amounts?.[level - 1] || asset.signal?.amount || 0);
    const duplicate = tradeHistory.some((t) => t.date === todayText() && t.symbol === asset.symbol && Number(t.level) === Number(level));
    if (duplicate && !confirm(`${asset.symbol} 今天已記錄過${levelNames[level]}，仍要新增？`)) return;
    const h = holdings[asset.symbol] || { type: getDefaultType(asset.symbol), executedLevels: [], qty: "", cost: "", note: "" };
    saveHoldings({ ...holdings, [asset.symbol]: applyBuy(h, asset, level, amount) });
    saveHistory([buildTrade(asset.symbol, level, amount, asset.price, h.note), ...tradeHistory]);
  }
  function deleteTrade(id) { saveHistory(tradeHistory.filter((t) => t.id !== id)); }
  function syncSnapshot() {
    const assetMap = Object.fromEntries(assets.map((a) => [a.symbol, a]));
    const nextHoldings = { ...holdings };
    const filteredHistory = tradeHistory.filter((t) => t.note !== "依 Binance 錢包截圖同步");
    const newTrades = [];
    Object.entries(SNAPSHOT).forEach(([symbol, item]) => {
      const liveAsset = assetMap[symbol] || { symbol, price: item.price };
      const price = Number(liveAsset.price || item.price);
      const qty = price > 0 ? item.value / price : 0;
      nextHoldings[symbol] = { ...(nextHoldings[symbol] || {}), qty: String(Number(qty.toFixed(10))), cost: String(Number(price.toFixed(6))), lastPrice: price, type: item.type, executedLevels: item.levels, note: `${item.label}｜依 Binance 錢包截圖同步` };
      newTrades.push(buildTrade(symbol, item.levels[0] || 0, item.value, price, "依 Binance 錢包截圖同步"));
    });
    saveHoldings(nextHoldings);
    saveHistory([...newTrades, ...filteredHistory]);
    alert("已同步 9 檔持倉紀錄。");
  }
  function exportBackup() {
    const payload = { version: "15", exportDate: new Date().toISOString(), holdings, tradeHistory };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `discount-hunter-backup-${todayText().replaceAll("/", "")}.json`;
    a.click(); URL.revokeObjectURL(url);
  }
  function importBackup(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try { const data = JSON.parse(String(reader.result || "{}")); if (data.holdings) saveHoldings(data.holdings); if (Array.isArray(data.tradeHistory)) saveHistory(data.tradeHistory); alert("匯入完成"); }
      catch { alert("匯入失敗：JSON 格式錯誤"); }
    };
    reader.readAsText(file); e.target.value = "";
  }

  useEffect(() => {
    async function loadPrices() {
      setRefreshing(true);
      try {
        const res = await fetch(`/api/prices?t=${Date.now()}`, { cache: "no-store" });
        const data = await res.json();
        const nextAssets = data.data || [];
        const oldAssets = assetsRef.current;
        setPriceDirections((prev) => {
          const out = {};
          nextAssets.forEach((n) => {
            const old = oldAssets.find((a) => a.symbol === n.symbol);
            const oldPrice = old ? Number(old.price) : null;
            const nextPrice = Number(n.price);
            if (oldPrice !== null && Number.isFinite(oldPrice) && Number.isFinite(nextPrice)) {
              const diff = nextPrice - oldPrice;
              out[n.symbol] = Math.abs(diff) < PRICE_MOVE_EPSILON ? prev[n.symbol] || null : { direction: diff > 0 ? "up" : "down", diff };
            } else out[n.symbol] = prev[n.symbol] || null;
          });
          return out;
        });
        assetsRef.current = nextAssets; setAssets(nextAssets); setUpdatedAt(data.updatedAt || ""); setSource(data.source || ""); setWarning(data.warning || ""); setError(data.error || "");
      } catch (err) { setError(err.message || "資料讀取失敗"); }
      finally { setRefreshing(false); }
    }
    async function loadHealth() { try { const res = await fetch(`/api/binance-health?t=${Date.now()}`, { cache: "no-store" }); setHealth(await res.json()); } catch { setHealth({ ok: false, label: "🔴 Binance API檢查失敗", symbolsFound: 0, symbolsExpected: 9 }); } }
    loadPrices(); loadHealth();
    const priceTimer = setInterval(loadPrices, REFRESH_MS);
    const healthTimer = setInterval(loadHealth, 30000);
    return () => { clearInterval(priceTimer); clearInterval(healthTimer); };
  }, []);

  const dataReady = !warning && !error && assets.length > 0;
  const age = secondsAgo(updatedAt);
  const syncLabel = age === null ? "讀取中" : age <= REALTIME_LIMIT_SEC ? "🟢 LIVE" : "🟡 DELAY";
  const sortedAssets = useMemo(() => [...assets].sort((a, b) => {
    const aStats = getHoldingStats(a, holdings[a.symbol]);
    const bStats = getHoldingStats(b, holdings[b.symbol]);
    const aScore = (aStats.hasPosition ? 1000 : 0) + ((a.signal?.level || 0) > 0 ? 500 : 0) + Math.abs(Number(a.discount || 0));
    const bScore = (bStats.hasPosition ? 1000 : 0) + ((b.signal?.level || 0) > 0 ? 500 : 0) + Math.abs(Number(b.discount || 0));
    return bScore - aScore;
  }), [assets, holdings]);
  const buyList = dataReady ? sortedAssets.filter((a) => a.signal?.level > 0) : [];
  const dipList = dataReady ? sortedAssets.filter((a) => Number(a.signal?.level || 0) >= 1) : [];
  const idleList = dataReady ? sortedAssets.filter((a) => !a.signal?.level) : [];
  const portfolio = assets.reduce((sum, asset) => { const s = getHoldingStats(asset, holdings[asset.symbol]); return { invested: sum.invested + s.invested, value: sum.value + s.value, pnl: sum.pnl + s.pnl, count: sum.count + (s.hasPosition ? 1 : 0) }; }, { invested: 0, value: 0, pnl: 0, count: 0 });
  const portfolioPct = portfolio.invested > 0 ? (portfolio.pnl / portfolio.invested) * 100 : 0;
  const totalAmount = buyList.reduce((sum, a) => sum + parseAmount(a.signal?.amount), 0);

  return <main className="page">
    <section className="hero compactHero">
      <h1 style={{ fontSize: 34, fontWeight: 950, margin: "6px 0 4px" }}>🎯 折扣獵人 V15</h1>
      <div className="versionPill">測試版</div>
      <h2 style={{ fontSize: 17, margin: "12px 0 6px", color: "#cbd5e1" }}>Binance xStocks</h2>
      <div className="update">更新：{formatUpdateTime(updatedAt)}</div>
      <div className="syncPill syncLive">{refreshing ? "自動更新中…" : syncLabel}{age !== null ? `｜${age}秒前｜每5秒自動更新` : ""}</div>
      <div className="sourcePill">資料源：{source || "Binance xStocks public API"}</div>
      <section style={boxStyle("#0f172a", "#1e293b")}><div style={{ fontWeight: 900 }}>{health?.label || "🟢 Binance API正常"}</div><div style={muted}>標的在線：{health?.symbolsFound ?? "--"}/{health?.symbolsExpected ?? 9}</div><div style={muted}>API延遲：{health?.latencyMs ? `${health.latencyMs}ms` : "--"}</div></section>
    </section>

    {!dataReady && <section className="dataGuard"><strong>資料源未就緒</strong><p>{error || "等待 Binance xStocks 真實行情資料。"}</p></section>}

    <section className="warRoom"><div className="warRoomHeader" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}><div><span>持倉市值</span><strong>{fmt(portfolio.value)}U</strong></div><div><span>未實現損益</span><strong style={{ color: portfolio.pnl >= 0 ? "#22c55e" : "#ef4444" }}>{fmt(portfolio.pnl)}U</strong></div></div><div style={{ color: portfolio.pnl >= 0 ? "#bbf7d0" : "#fecaca", fontWeight: 900, textAlign: "center", marginTop: 12 }}>總投入 {fmt(portfolio.invested)}U｜報酬 {portfolioPct.toFixed(2)}%｜持倉 {portfolio.count} 檔</div></section>

    {dataReady && <TodayBuyPanel buyList={buyList} totalAmount={totalAmount} addTrade={addTrade} />}
    {dataReady && <DipPanel assets={dipList} holdings={holdings} priceDirections={priceDirections} />}

    <details style={collapseStyle("#0284c7")}><summary>▶ 尚未到買點（{idleList.length}）<span>點擊展開</span></summary><div style={{ marginTop: 12 }}>{idleList.map((a) => <AssetCard key={a.symbol} asset={a} holding={holdings[a.symbol]} directionInfo={priceDirections[a.symbol]} />)}</div></details>
    <details style={collapseStyle("#a855f7")}><summary>▶ 開啟持倉管理控制台<span>點擊展開</span></summary><HoldingsManager assets={assets} holdings={holdings} updateHoldingField={updateHoldingField} toggleExecutedLevel={toggleExecutedLevel} addTrade={addTrade} exportBackup={exportBackup} importBackup={importBackup} syncSnapshot={syncSnapshot} /></details>
    <details style={collapseStyle("#f97316")}><summary>▶ 交易日誌（{tradeHistory.length} 筆）<span>點擊展開</span></summary><TradeJournal tradeHistory={tradeHistory} deleteTrade={deleteTrade} /></details>
    <section className="infoFooter"><p>買點規則：依標的類型設定不同折價層級與金額；進度條沿用 V13，只表示距離下一層。</p></section>
  </main>;
}

const muted = { fontSize: 13, color: "#cbd5e1" };
const boxStyle = (bg, border) => ({ marginTop: 12, padding: 12, borderRadius: 14, background: bg, border: `1px solid ${border}`, textAlign: "left" });
const collapseStyle = (color) => ({ margin: "12px 0", padding: "14px 16px", borderRadius: 14, border: `1px solid ${color}`, background: "#0f172a", color: "#e2e8f0", fontWeight: 900 });

function TodayBuyPanel({ buyList, totalAmount, addTrade }) {
  return <section style={{ margin: "16px 0", padding: 14, background: "linear-gradient(180deg,#3b2f05,#111827)", borderRadius: 16, border: "1px solid #facc15" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}><h2 style={{ margin: 0, color: "#facc15", fontSize: 22 }}>🎯 今日買點（{buyList.length}）</h2><span style={{ color: "#fde68a", fontSize: 13 }}>把握進場時機</span></div>{buyList.length === 0 ? <div style={{ color: "#94a3b8", textAlign: "center", padding: 16 }}>今天沒有新買點。</div> : <div style={{ background: "#fef3c7", color: "#111827", borderRadius: 12, overflow: "hidden" }}>{buyList.map((asset, idx) => <TodayBuyRow key={asset.symbol} asset={asset} addTrade={addTrade} isLast={idx === buyList.length - 1} />)}</div>}<div style={{ color: "#facc15", fontWeight: 950, textAlign: "center", marginTop: 10, fontSize: 18 }}>🛒 今日投入合計 {totalAmount}U</div></section>;
}
function TodayBuyRow({ asset, addTrade, isLast }) {
  const level = asset.signal?.level || 0;
  const next = getNextBuyPoint(asset);
  const amount = parseAmount(asset.signal?.amount);
  return <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.9fr 1.2fr", gap: 10, alignItems: "center", padding: "12px 10px", borderBottom: isLast ? "none" : "1px solid rgba(0,0,0,.15)" }}><div><div style={{ fontSize: 22, fontWeight: 950 }}>{asset.symbol}</div><div style={{ fontWeight: 800 }}>{ruleColors[level - 1]} {levelNames[level]}（{asset.rules?.[level - 1]}%）</div></div><div><div style={{ fontWeight: 800 }}>買點 {fmt(asset.price)}</div><button onClick={() => addTrade(asset, level)} style={{ background: "#16a34a", color: "white", border: 0, borderRadius: 8, padding: "7px 14px", fontWeight: 950, marginTop: 4 }}>已買入 {amount}U</button><div style={{ fontSize: 13, marginTop: 4 }}>📅 {todayText()}</div></div><ProgressBlock next={next} /></div>;
}
function ProgressBlock({ next }) {
  return <div><div style={{ fontWeight: 900 }}>{next.label}　{next.amount}</div><div style={{ fontWeight: 800, margin: "4px 0" }}>{next.text}</div><div style={{ height: 10, background: "rgba(15,23,42,.2)", borderRadius: 99, overflow: "hidden" }}><div style={{ width: `${next.progress}%`, height: "100%", borderRadius: 99, background: "linear-gradient(90deg,#22c55e,#facc15,#f97316)" }} /></div></div>;
}
function DipPanel({ assets, holdings, priceDirections }) {
  return <section style={{ margin: "16px 0", padding: 14, background: "linear-gradient(180deg,#052e1a,#03150f)", border: "1px solid #22c55e", borderRadius: 16 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}><h2 style={{ margin: 0, color: "#4ade80", fontSize: 22 }}>⚡ 逢低買進（{assets.length}）</h2><span style={{ color: "#86efac", fontSize: 13 }}>已進入第一層以上</span></div>{assets.map((asset) => <DipRow key={asset.symbol} asset={asset} holding={holdings[asset.symbol]} directionInfo={priceDirections[asset.symbol]} />)}</section>;
}
function DipRow({ asset, directionInfo }) {
  const level = asset.signal?.level || 0;
  const next = getNextBuyPoint(asset);
  return <div style={{ display: "grid", gridTemplateColumns: "1fr .8fr 1fr", gap: 8, alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,.08)" }}><div style={{ fontWeight: 950 }}>{asset.symbol}</div><div style={{ color: "#4ade80", fontWeight: 950 }}>{asset.discount}% {directionInfo && <span style={{ color: directionInfo.direction === "up" ? "#22c55e" : "#ef4444", fontSize: 12 }}>{directionInfo.direction === "up" ? "▲" : "▼"}</span>}</div><div><div style={{ fontSize: 13 }}>{ruleColors[Math.max(level - 1, 0)]} {levelNames[level] || "觀察"}｜下一層 {next.amount}</div><ProgressBlock next={next} /></div></div>;
}
function TradeJournal({ tradeHistory, deleteTrade }) {
  const grouped = tradeHistory.reduce((acc, t) => { acc[t.date] = acc[t.date] || []; acc[t.date].push(t); return acc; }, {});
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
  return <section style={{ marginTop: 12 }}>{dates.length === 0 ? <div style={{ color: "#94a3b8" }}>尚無交易紀錄。</div> : dates.slice(0, 8).map((date) => <div key={date} style={{ marginTop: 10 }}><div style={{ color: "#facc15", fontWeight: 900, marginBottom: 6 }}>{date}</div>{grouped[date].map((t) => <div key={t.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center", background: "#020617", padding: "8px 10px", borderRadius: 10, marginBottom: 6 }}><div><strong>{t.symbol}</strong>｜{t.levelName}｜{fmt(t.amount)}U<span style={{ color: "#94a3b8", fontSize: 12 }}>｜價 {fmt(t.price)}</span></div><button onClick={() => deleteTrade(t.id)} style={{ background: "#334155", color: "#cbd5e1", border: "none", borderRadius: 8, padding: "4px 8px" }}>刪</button></div>)}</div>)}</section>;
}
function HoldingsManager({ assets, holdings, updateHoldingField, toggleExecutedLevel, addTrade, exportBackup, importBackup, syncSnapshot }) {
  return <section style={{ marginTop: 12 }}><button onClick={syncSnapshot} style={{ ...managerButton(true, "#f59e0b"), width: "100%", fontSize: 15, marginBottom: 10 }}>📥 同步今日 Binance 截圖 9檔</button><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}><button onClick={exportBackup} style={managerButton(true, "#16a34a")}>⬇️ 匯出JSON</button><label style={{ ...managerButton(true, "#7c3aed"), textAlign: "center" }}>⬆️ 匯入JSON<input type="file" accept="application/json" onChange={importBackup} style={{ display: "none" }} /></label></div>{assets.map((asset) => { const h = holdings[asset.symbol] || { qty: "", cost: "", type: getDefaultType(asset.symbol), note: "", executedLevels: [] }; const currentLevels = h.executedLevels || []; return <div key={asset.symbol} style={{ background: "#020617", padding: 12, borderRadius: 12, marginBottom: 10 }}><strong>{asset.symbol}</strong><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}><input value={h.qty || ""} onChange={(e) => updateHoldingField(asset.symbol, "qty", e.target.value)} placeholder="qty" style={managerInput} /><input value={h.cost || ""} onChange={(e) => updateHoldingField(asset.symbol, "cost", e.target.value)} placeholder="cost" style={managerInput} /></div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 8 }}>{[1,2,3,4].map((lvl) => <button key={lvl} onClick={() => toggleExecutedLevel(asset.symbol, lvl)} style={managerButton(currentLevels.includes(lvl), "#2563eb")}>{currentLevels.includes(lvl) ? "✅" : "⬜"} 第{lvl}</button>)}</div><button onClick={() => addTrade(asset, asset.signal?.level || 1)} style={{ ...managerButton(true, "#0ea5e9"), width: "100%", marginTop: 8 }}>記錄目前買點</button></div>; })}</section>;
}
const managerInput = { width: "100%", borderRadius: 8, border: "1px solid #334155", background: "#1e293b", color: "white", padding: 8 };
const managerButton = (active, color) => ({ padding: "8px 4px", borderRadius: 8, border: "1px solid #334155", background: active ? color : "#1e293b", color: "white", fontWeight: 800, cursor: "pointer", fontSize: 12 });
function AssetCard({ asset, holding, directionInfo }) {
  const level = asset.signal?.level || 0;
  const next = getNextBuyPoint(asset);
  const stats = getHoldingStats(asset, holding);
  return <div className={`card ${level > 0 ? "active" : "idle"}`}><div className="cardTop"><div className="titleRow"><div className="logoText">{asset.symbol.slice(0,2)}</div><div><h2>{asset.symbol}</h2><p>{asset.name}</p><p className="desc">{asset.grade}級 ｜ {asset.description}</p></div></div><div className="badge">{asset.grade}級</div></div><div className="dataGrid"><div><span>52週高點</span><strong>{fmt(asset.high)}</strong></div><div><span>現價</span><strong>{fmt(asset.price)}{directionInfo && <span style={{ color: directionInfo.direction === "up" ? "#22c55e" : "#ef4444", fontSize: 13 }}>{directionInfo.direction === "up" ? " ▲" : " ▼"}</span>}</strong></div><div><span>回撤</span><strong>{asset.discount ?? "--"}%</strong></div><div><span>持倉市值</span><strong>{fmt(stats.value)}U</strong></div></div><div className="nextBuyBox"><div className="nextBuyTop"><span>{next.label}</span><strong>{next.amount}</strong></div><p>{next.text}</p><div className="nextBuyTrack"><div style={{ width: `${next.progress}%` }} /></div></div></div>;
}
