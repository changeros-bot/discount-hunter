import { useEffect, useMemo, useRef, useState } from "react";

const ruleColors = ["🟢", "🟡", "🟠", "🔴"];
const levelNames = ["", "第一層", "第二層", "第三層", "第四層"];
const levelClasses = ["idle", "level1", "level2", "level3", "level4"];
const REFRESH_MS = 5000;
const REALTIME_LIMIT_SEC = 8;
const DELAYED_LIMIT_SEC = 20;
const PRICE_MOVE_EPSILON = 0.005;

function parseAmount(value) {
  const number = Number(String(value || "0").replace(/[^0-9.]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  return number.toLocaleString(undefined, { maximumFractionDigits: 2 });
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
  const monthlyDcaSymbols = ["QQQon", "NVDAon", "TSMon", "SPCXon", "GOOGLon", "AMDon", "MRVLon"];
  return monthlyDcaSymbols.includes(symbol) ? "monthlyDca" : "dipBuy";
}

function getNextBuyPoint(asset) {
  const discount = Number(asset.discount);
  const rules = asset.rules || [];
  const amounts = asset.amounts || [];
  if (!Number.isFinite(discount) || rules.length === 0) return { label: "下一買點", text: "資料未就緒", amount: "0U", progress: 0, gapToNextLevel: null, nextAmount: "0" };
  const nextIndex = rules.findIndex((rule) => discount > rule);
  if (nextIndex === -1) return { label: "下一買點", text: "已達最深層", amount: "完成", progress: 100, gapToNextLevel: null, nextAmount: "0" };
  const target = rules[nextIndex];
  const gap = Math.max(0, discount - target);
  const previous = nextIndex === 0 ? 0 : rules[nextIndex - 1];
  const range = Math.abs(target - previous) || 1;
  const progress = Math.min(100, Math.max(0, ((previous - discount) / range) * 100));
  return { label: `${levelNames[nextIndex + 1]}買點`, text: `還差 ${gap.toFixed(1)}% 到 ${target}%`, amount: `${amounts[nextIndex]}U`, progress, gapToNextLevel: gap, nextAmount: amounts[nextIndex] || "0" };
}

function getHoldingStats(asset, holding) {
  const qty = Number(holding?.qty || 0);
  const cost = Number(holding?.cost || 0);
  const price = Number(asset?.price || 0);
  const invested = qty * cost;
  const value = qty * price;
  const pnl = value - invested;
  const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
  return { qty, cost, invested, value, pnl, pnlPct, hasPosition: qty > 0 && cost > 0 && price > 0 };
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
  const [isManageMode, setIsManageMode] = useState(false);
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
    const symbol = asset.symbol;
    const h = holdings[symbol] || { type: getDefaultType(symbol), executedLevels: [], qty: "", cost: "", note: "" };
    const duplicated = tradeHistory.some((t) => t.date === todayText() && t.symbol === symbol && Number(t.level) === Number(level));
    if (duplicated && !confirm(`${symbol} 今天已記錄過第${level}層，仍要新增？`)) return;
    const nextLevels = Array.from(new Set([...(h.executedLevels || []), level])).sort();
    const record = { id: `${Date.now()}-${symbol}-${level}`, date: todayText(), symbol, level, levelName: levelNames[level], amount: parseAmount(asset.amounts?.[level - 1] || asset.signal?.amount || 0), price: Number(asset.price || 0), note: h.note || "" };
    saveHoldings({ ...holdings, [symbol]: { ...h, executedLevels: nextLevels } });
    saveHistory([record, ...tradeHistory]);
  }
  function deleteTrade(id) { saveHistory(tradeHistory.filter((t) => t.id !== id)); }
  function exportBackup() {
    const payload = { version: "15.2", exportDate: new Date().toISOString(), holdings, tradeHistory };
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
      } catch { alert("匯入失敗：JSON 格式錯誤"); }
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
        assetsRef.current = nextAssets;
        setAssets(nextAssets);
        setUpdatedAt(data.updatedAt || "");
        setSource(data.source || "");
        setWarning(data.warning || "");
        setError(data.error || "");
      } catch (err) { setError(err.message || "資料讀取失敗"); }
      finally { setRefreshing(false); }
    }
    async function loadHealth() {
      try { const res = await fetch(`/api/binance-health?t=${Date.now()}`, { cache: "no-store" }); setHealth(await res.json()); }
      catch { setHealth({ ok: false, status: "down", label: "🔴 Binance API檢查失敗", symbolsFound: 0, symbolsExpected: 9 }); }
    }
    loadPrices(); loadHealth();
    const priceTimer = setInterval(loadPrices, REFRESH_MS);
    const healthTimer = setInterval(loadHealth, 30000);
    return () => { clearInterval(priceTimer); clearInterval(healthTimer); };
  }, []);

  const dataReady = !warning && !error && assets.length > 0;
  const age = secondsAgo(updatedAt);
  const syncLabel = age === null ? "自動同步中" : age <= REALTIME_LIMIT_SEC ? "🟢 LIVE" : age <= DELAYED_LIMIT_SEC ? "🟡 DELAY" : "🔴 STALE";
  const syncClass = age === null ? "syncPending" : age <= REALTIME_LIMIT_SEC ? "syncLive" : age <= DELAYED_LIMIT_SEC ? "syncLag" : "syncStale";

  const sortedAssets = useMemo(() => [...assets].sort((a, b) => {
    const aStats = getHoldingStats(a, holdings[a.symbol]);
    const bStats = getHoldingStats(b, holdings[b.symbol]);
    const aScore = (aStats.hasPosition ? 1000 : 0) + ((a.signal?.level || 0) > 0 ? 500 : 0) + (a.signal?.level || 0);
    const bScore = (bStats.hasPosition ? 1000 : 0) + ((b.signal?.level || 0) > 0 ? 500 : 0) + (b.signal?.level || 0);
    return bScore - aScore;
  }), [assets, holdings]);

  const buyList = dataReady ? sortedAssets.filter((a) => a.signal?.level > 0) : [];
  const idleList = dataReady ? sortedAssets.filter((a) => !a.signal?.level && !getHoldingStats(a, holdings[a.symbol]).hasPosition) : [];
  const dcaHoldingList = dataReady ? sortedAssets.filter((a) => getHoldingStats(a, holdings[a.symbol]).hasPosition && (holdings[a.symbol]?.type || getDefaultType(a.symbol)) === "monthlyDca") : [];
  const dipHoldingList = dataReady ? sortedAssets.filter((a) => getHoldingStats(a, holdings[a.symbol]).hasPosition && (holdings[a.symbol]?.type || getDefaultType(a.symbol)) === "dipBuy") : [];
  const buyWithoutHolding = buyList.filter((a) => !getHoldingStats(a, holdings[a.symbol]).hasPosition);
  const totalAmount = buyList.reduce((sum, asset) => sum + parseAmount(asset.signal?.amount), 0);
  const portfolio = assets.reduce((sum, asset) => {
    const stats = getHoldingStats(asset, holdings[asset.symbol]);
    return { invested: sum.invested + stats.invested, value: sum.value + stats.value, pnl: sum.pnl + stats.pnl };
  }, { invested: 0, value: 0, pnl: 0 });
  const portfolioPct = portfolio.invested > 0 ? (portfolio.pnl / portfolio.invested) * 100 : 0;

  return (
    <main className="page">
      <section className="hero compactHero">
        <h1 style={{ fontSize: "34px", fontWeight: 950, margin: "6px 0 4px" }}>美股DCA折價獵人</h1>
        <div className="versionPill">V15.2 測試版</div>
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
        <button onClick={() => setIsManageMode(!isManageMode)} style={{ width: "100%", marginTop: 14, padding: "12px", background: isManageMode ? "#ef4444" : "#2563eb", color: "#fff", border: "none", borderRadius: 12, fontSize: 16, fontWeight: 900 }}>{isManageMode ? "❌ 關閉持倉管理" : "⚙️ 開啟持倉管理控制台"}</button>
      </section>

      {isManageMode && <HoldingsManager assets={assets} holdings={holdings} updateHoldingField={updateHoldingField} toggleExecutedLevel={toggleExecutedLevel} addTrade={addTrade} exportBackup={exportBackup} importBackup={importBackup} />}
      {!dataReady && <section className="dataGuard"><strong>資料源未就緒</strong><p>{error || "等待 Binance xStocks 真實行情資料。"}</p><span>保護規則：沒有真實 Binance xStocks 資料，就不顯示訊號。</span></section>}

      <section className="warRoom">
        <div className="warRoomHeader" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div><span>持倉市值</span><strong>{formatNumber(portfolio.value)}U</strong></div>
          <div><span>未實現損益</span><strong style={{ color: portfolio.pnl >= 0 ? "#22c55e" : "#ef4444" }}>{formatNumber(portfolio.pnl)}U</strong></div>
        </div>
        {portfolio.invested > 0 && <div style={{ color: portfolio.pnl >= 0 ? "#bbf7d0" : "#fecaca", fontWeight: 900, textAlign: "center", marginTop: 12 }}>總投入 {formatNumber(portfolio.invested)}U｜報酬 {portfolioPct.toFixed(2)}%</div>}
      </section>

      <TradeJournal tradeHistory={tradeHistory} deleteTrade={deleteTrade} />
      <section className="quickRule"><div><span>🟢 第一層</span><strong>5U</strong></div><div><span>🟡 第二層</span><strong>10U</strong></div><div><span>🟠 第三層</span><strong>15U</strong></div><div><span>🔴 第四層</span><strong>20U</strong></div></section>

      {dataReady && <><section className="sectionTitle"><h2>監控清單</h2><p>V15.2：今日買點移到最下方，避免干擾持倉檢查。</p></section><section className="list">
        <SectionHeader color="#4ade80" title="📅 本月DCA" count={dcaHoldingList.length} subtitle="例行投入" />
        {dcaHoldingList.length > 0 ? dcaHoldingList.map((a) => <AssetCard asset={a} holding={holdings[a.symbol]} directionInfo={priceDirections[a.symbol]} key={a.symbol} />) : <EmptyBlock text="尚無 monthlyDca 現有持倉。" />}
        <SectionHeader color="#3b82f6" title="⚡ 折價加碼" count={dipHoldingList.length} subtitle="低點獵人" />
        {dipHoldingList.length > 0 ? dipHoldingList.map((a) => <AssetCard asset={a} holding={holdings[a.symbol]} directionInfo={priceDirections[a.symbol]} key={a.symbol} />) : <EmptyBlock text="尚無 dipBuy 現有持倉。" />}
        {idleList.length > 0 && <details className="idleGroup" style={{ marginTop: 16 }}><summary>尚未到買點｜{idleList.length} 檔</summary><div className="idleList">{idleList.map((a) => <AssetCard asset={a} holding={holdings[a.symbol]} directionInfo={priceDirections[a.symbol]} key={a.symbol} />)}</div></details>}
        {buyWithoutHolding.length > 0 && <><div style={{ fontWeight: 900, color: "#fde68a", margin: "18px 0 6px", fontSize: 16 }}>🎯 今日觸發買點（尚未建倉）</div>{buyWithoutHolding.map((a) => <AssetCard asset={a} holding={holdings[a.symbol]} directionInfo={priceDirections[a.symbol]} key={a.symbol} />)}</>}
      </section></>}

      {dataReady && <TodayAction buyList={buyList} totalAmount={totalAmount} />}
      <section className="infoFooter"><h2>V15.2 產品原則</h2><p>本頁為測試版：只處理 Binance xStocks 折價獵人，不混入其他專案。</p><h2>資料說明</h2><p>持倉與交易日誌存在本機瀏覽器，可用 JSON 匯出/匯入備份。</p></section>
    </main>
  );
}

function TodayAction({ buyList, totalAmount }) {
  return <section style={{ margin: "16px 0", padding: 16, background: "#1e293b", borderRadius: 16, border: "2px solid #3b82f6" }}><h2 style={{ fontSize: 20, fontWeight: 900, color: "#3b82f6", margin: "0 0 12px" }}>⚡ 今日到買點</h2>{buyList.length > 0 ? <div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "0 8px 8px", borderBottom: "1px solid #334155", color: "#94a3b8", fontSize: 13, fontWeight: 700 }}><div>標的</div><div style={{ textAlign: "center" }}>買點層級</div><div style={{ textAlign: "right" }}>建議投入</div></div><div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>{buyList.map((asset) => { const level = asset.signal?.level || 0; return <div key={`today-${asset.symbol}`} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "10px 8px", background: "#0f172a", borderRadius: 10, alignItems: "center", fontSize: 15 }}><div style={{ fontWeight: 900 }}>{asset.symbol}</div><div style={{ textAlign: "center", color: "#fcd34d", fontWeight: 800 }}>{ruleColors[level - 1]} {levelNames[level]}</div><div style={{ textAlign: "right", fontWeight: 900, color: "#4ade80" }}>{parseAmount(asset.signal?.amount)}U</div></div>; })}</div><div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #334155", display: "flex", justifyContent: "space-between", fontWeight: 900, color: "#fff" }}><span>今日總投入</span><span style={{ color: "#4ade80", fontSize: 20 }}>{totalAmount}U</span></div></div> : <div style={{ padding: "16px 0", textAlign: "center", color: "#94a3b8", fontSize: 14 }}>今天無任何標的觸發買點。</div>}</section>;
}

function TradeJournal({ tradeHistory, deleteTrade }) {
  const grouped = tradeHistory.reduce((acc, t) => { acc[t.date] = acc[t.date] || []; acc[t.date].push(t); return acc; }, {});
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
  return <section style={{ margin: "16px 0", padding: 16, background: "#1e293b", borderRadius: 16, border: "1px solid #334155" }}><h2 style={{ margin: "0 0 10px", color: "#e2e8f0", fontSize: 20 }}>📜 交易日誌</h2>{dates.length === 0 ? <div style={{ color: "#94a3b8", fontSize: 14 }}>尚無交易紀錄。到持倉管理控制台按「記錄買入」後，會依日期顯示在這裡。</div> : dates.slice(0, 8).map((date) => <div key={date} style={{ marginTop: 10 }}><div style={{ color: "#facc15", fontWeight: 900, marginBottom: 6 }}>{date}</div>{grouped[date].map((t) => <div key={t.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center", background: "#0f172a", padding: "8px 10px", borderRadius: 10, marginBottom: 6 }}><div><strong>{t.symbol}</strong>｜{t.levelName || levelNames[t.level]}｜{t.amount}U<span style={{ color: "#94a3b8", fontSize: 12 }}>｜價 {formatNumber(t.price)}</span></div><button onClick={() => deleteTrade(t.id)} style={{ background: "#334155", color: "#cbd5e1", border: "none", borderRadius: 8, padding: "4px 8px" }}>刪</button></div>)}</div>)}</section>;
}

function HoldingsManager({ assets, holdings, updateHoldingField, toggleExecutedLevel, addTrade, exportBackup, importBackup }) {
  return <section style={{ margin: "16px 0", padding: 16, background: "#1e293b", borderRadius: 16, border: "2px solid #a855f7" }}><h2 style={{ fontSize: 20, fontWeight: 900, color: "#c084fc", margin: "0 0 4px" }}>💼 持倉管理</h2><p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 12 }}>集中輸入持有數量、平均成本、買入類型；也可以按日期記錄買入。</p><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}><button onClick={exportBackup} style={managerButton(true, "#16a34a")}>⬇️ 匯出JSON</button><label style={{ ...managerButton(true, "#7c3aed"), textAlign: "center" }}>⬆️ 匯入JSON<input type="file" accept="application/json" onChange={importBackup} style={{ display: "none" }} /></label></div><div style={{ display: "flex", flexDirection: "column", gap: 16 }}>{assets.map((asset) => { const h = holdings[asset.symbol] || { qty: "", cost: "", type: getDefaultType(asset.symbol), note: "", executedLevels: [] }; const currentLevels = h.executedLevels || []; return <div key={`manage-${asset.symbol}`} style={{ background: "#0f172a", padding: 14, borderRadius: 12, border: "1px solid #334155" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, borderBottom: "1px solid #1e293b", paddingBottom: 6 }}><span style={{ fontWeight: 900, fontSize: 18, color: "#fff" }}>{asset.symbol}</span><span style={{ fontSize: 12, color: "#64748b" }}>{asset.name}</span></div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}><label><span style={managerLabel}>持有數量 qty</span><input type="text" inputMode="decimal" value={h.qty || ""} onChange={(e) => updateHoldingField(asset.symbol, "qty", e.target.value)} placeholder="例 0.012659" style={managerInput} /></label><label><span style={managerLabel}>平均成本 cost</span><input type="text" inputMode="decimal" value={h.cost || ""} onChange={(e) => updateHoldingField(asset.symbol, "cost", e.target.value)} placeholder="例 392.69" style={managerInput} /></label></div><div style={{ marginBottom: 10 }}><span style={managerLabel}>策略配置類型</span><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><button onClick={() => updateHoldingField(asset.symbol, "type", "monthlyDca")} style={managerButton(h.type === "monthlyDca", "#22c55e")}>📅 DCA</button><button onClick={() => updateHoldingField(asset.symbol, "type", "dipBuy")} style={managerButton(h.type === "dipBuy", "#3b82f6")}>⚡ 折價</button></div></div><div style={{ marginBottom: 10 }}><span style={managerLabel}>已執行層數 / 日期紀錄</span><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>{[1, 2, 3, 4].map((lvl) => <div key={lvl} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}><button onClick={() => toggleExecutedLevel(asset.symbol, lvl)} style={managerButton(currentLevels.includes(lvl), "#e11d48")}>{currentLevels.includes(lvl) ? "✅" : "⬜"} 第{lvl}層</button><button onClick={() => addTrade(asset, lvl)} style={managerButton(true, "#0ea5e9")}>記錄{lvl}</button></div>)}</div></div><div><span style={managerLabel}>備註 note</span><input type="text" value={h.note || ""} onChange={(e) => updateHoldingField(asset.symbol, "note", e.target.value)} placeholder="輸入交易備忘錄..." style={managerInput} /></div></div>; })}</div></section>;
}

const managerLabel = { display: "block", color: "#94a3b8", fontSize: 12, marginBottom: 4 };
const managerInput = { width: "100%", borderRadius: 8, border: "1px solid #334155", background: "#1e293b", color: "white", padding: 8 };
const managerButton = (active, color) => ({ padding: "8px 4px", borderRadius: 8, border: "1px solid #334155", background: active ? color : "#1e293b", color: "white", fontWeight: 800, cursor: "pointer", fontSize: 12 });
function SectionHeader({ title, subtitle, count, color }) { return <div style={{ fontWeight: 950, color, margin: "18px 0 6px", fontSize: 18, display: "flex", alignItems: "center", gap: 6 }}><span>{title}</span><span style={{ fontSize: 12, background: "rgba(148,163,184,0.15)", padding: "2px 8px", borderRadius: 20 }}>{subtitle} ({count})</span></div>; }
function EmptyBlock({ text }) { return <div style={{ padding: 12, background: "#1e293b", borderRadius: 12, color: "#64748b", fontSize: 13, textAlign: "center" }}>{text}</div>; }

function AssetCard({ asset, holding, directionInfo }) {
  const level = asset.signal?.level || 0;
  const levelClass = levelClasses[level] || "idle";
  const nextBuy = getNextBuyPoint(asset);
  const stats = getHoldingStats(asset, holding);
  const isCloseToNextLevel = nextBuy.gapToNextLevel !== null && nextBuy.gapToNextLevel <= 1.5;
  const executedLevels = holding?.executedLevels || [];
  const type = holding?.type || getDefaultType(asset.symbol);
  const typeLabel = type === "monthlyDca" ? "📅 DCA" : "⚡ 加碼";
  return <div className={`card ${level > 0 ? "active" : "idle"} ${levelClass}`}><div className="cardTop"><div className="titleRow"><div className="logoText">{asset.symbol.slice(0, 2)}</div><div><h2 style={{ display: "flex", alignItems: "center", gap: 6 }}>{asset.symbol}<span style={{ fontSize: 11, background: type === "monthlyDca" ? "#22c55e" : "#3b82f6", color: "white", padding: "1px 6px", borderRadius: 6, fontWeight: 700 }}>{typeLabel}</span></h2><p>{asset.name}</p><p className="desc">{asset.grade}級 ｜ {asset.description}</p></div></div><div className="badge">{asset.grade}級</div></div><div className={`signal ${levelClass}`}>{level > 0 ? `${ruleColors[level - 1]} ${levelNames[level]}｜建議 ${parseAmount(asset.signal?.amount)}U` : "尚未到買點"}</div>{isCloseToNextLevel && <div style={{ margin: "8px 0", padding: 10, background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 8, color: "#78350f", fontSize: 13, fontWeight: 700 }}><div style={{ fontSize: 14, fontWeight: 900, color: "#d97706" }}>🟡 接近下一層</div><div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}><span>剩 {nextBuy.gapToNextLevel.toFixed(1)}%</span><span>下一層投入 {nextBuy.nextAmount}U</span></div></div>}<div style={{ background: "rgba(15,23,42,0.6)", padding: 10, borderRadius: 10, margin: "8px 0", border: "1px solid #1e293b" }}><div style={{ fontSize: 12, fontWeight: 800, color: "#94a3b8", marginBottom: 6 }}>🎯 四層加碼投放進度</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>{[1, 2, 3, 4].map((lvl) => <div key={lvl} style={{ fontSize: 13, color: executedLevels.includes(lvl) ? "#4ade80" : "#64748b", fontWeight: executedLevels.includes(lvl) ? 800 : 500 }}>{executedLevels.includes(lvl) ? `✅ 第 ${lvl} 層已執行` : `⬜ 第 ${lvl} 層未執行`}</div>)}</div></div><div className="dataGrid"><div><span>{asset.highType || "52週高點"}</span><strong>{formatNumber(asset.high)}</strong></div><div><span>現價</span><strong style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>{formatNumber(asset.price)}{directionInfo && <span style={{ color: directionInfo.direction === "up" ? "#22c55e" : "#ef4444", fontSize: 13, fontWeight: 900, whiteSpace: "nowrap" }}>{directionInfo.direction === "up" ? "▲" : "▼"}{directionInfo.diff > 0 ? ` +${directionInfo.diff.toFixed(2)}` : ` ${directionInfo.diff.toFixed(2)}`}</span>}</strong></div><div><span>回撤</span><strong>{asset.discount ?? "--"}%</strong></div><div><span>建議投入</span><strong>{parseAmount(asset.signal?.amount)}U</strong></div></div><div className="nextBuyBox"><div className="nextBuyTop"><span>{nextBuy.label}</span><strong>{nextBuy.amount}</strong></div><p>{nextBuy.text}</p><div className="nextBuyTrack"><div style={{ width: `${nextBuy.progress}%` }} /></div></div><details className="nextBuyBox"><summary style={{ cursor: "pointer", fontWeight: 900 }}>我的持倉 / 未實現損益</summary><div className="dataGrid" style={{ marginTop: 12 }}><div><span>投入成本</span><strong>{formatNumber(stats.invested)}U</strong></div><div><span>目前市值</span><strong>{formatNumber(stats.value)}U</strong></div><div><span>未實現損益</span><strong style={{ color: stats.pnl >= 0 ? "#22c55e" : "#ef4444" }}>{formatNumber(stats.pnl)}U</strong></div><div><span>報酬率</span><strong style={{ color: stats.pnl >= 0 ? "#22c55e" : "#ef4444" }}>{stats.hasPosition ? stats.pnlPct.toFixed(2) : "0.00"}%</strong></div></div>{holding?.note && <div style={{ marginTop: 8, padding: "6px 10px", background: "#1e293b", borderRadius: 6, fontSize: 12, color: "#cbd5e1", borderLeft: "3px solid #3b82f6" }}>✏️ 備註：{holding.note}</div>}</details><div className="ruleBox"><h4>買點規則</h4>{asset.rules?.map((rule, idx) => <div key={idx} className={level === idx + 1 ? "rule activeRule" : "rule"}><span>{ruleColors[idx]} 第{idx + 1}層</span><strong>{rule}% → {asset.amounts?.[idx]}U</strong></div>)}</div></div>;
}
