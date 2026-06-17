import { useEffect, useMemo, useState } from "react";

const ruleColors = ["🟢", "🟡", "🟠", "🔴"];
const levelNames = ["", "第一層", "第二層", "第三層", "第四層"];
const levelClasses = ["idle", "level1", "level2", "level3", "level4"];
const REFRESH_MS = 5000;
const REALTIME_LIMIT_SEC = 8;
const DELAYED_LIMIT_SEC = 20;

function parseAmount(value) {
  const number = Number(String(value || "0").replace(/[^0-9.]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  return number.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function secondsAgo(isoString) {
  if (!isoString) return null;
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  return Number.isFinite(diff) ? Math.max(diff, 0) : null;
}

function getNextBuyPoint(asset) {
  const discount = Number(asset.discount);
  const rules = asset.rules || [];
  const amounts = asset.amounts || [];

  if (!Number.isFinite(discount) || rules.length === 0) {
    return { label: "下一買點", text: "資料未就緒", amount: "0U", progress: 0, gapToNextLevel: null, nextAmount: "0" };
  }

  const nextIndex = rules.findIndex((rule) => discount > rule);
  if (nextIndex === -1) {
    return { label: "下一買點", text: "已達最深層", amount: "完成", progress: 100, gapToNextLevel: null, nextAmount: "0" };
  }

  const target = rules[nextIndex];
  const gap = Math.max(0, discount - target);
  const previous = nextIndex === 0 ? 0 : rules[nextIndex - 1];
  const range = Math.abs(target - previous) || 1;
  const progress = Math.min(100, Math.max(0, ((previous - discount) / range) * 100));

  return {
    label: `${levelNames[nextIndex + 1]}買點`,
    text: `還差 ${gap.toFixed(1)}% 到 ${target}%`,
    amount: `${amounts[nextIndex]}U`,
    progress,
    gapToNextLevel: gap,
    nextAmount: amounts[nextIndex] || "0"
  };
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

export default function Home() {
  const [assets, setAssets] = useState([]);
  const [updatedAt, setUpdatedAt] = useState("");
  const [source, setSource] = useState("");
  const [warning, setWarning] = useState("");
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [holdings, setHoldings] = useState({});
  const [health, setHealth] = useState(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("discountHunterHoldings") || "{}");
      setHoldings(saved);
    } catch {
      setHoldings({});
    }
  }, []);

  function updateHolding(symbol, field, value) {
    const next = { ...holdings, [symbol]: { ...(holdings[symbol] || {}), [field]: value } };
    setHoldings(next);
    localStorage.setItem("discountHunterHoldings", JSON.stringify(next));
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
      } catch (err) {
        setError(err.message || "資料讀取失敗");
      } finally {
        setRefreshing(false);
      }
    }

    async function loadHealth() {
      try {
        const res = await fetch(`/api/binance-health?t=${Date.now()}`, { cache: "no-store" });
        const data = await res.json();
        setHealth(data);
      } catch {
        setHealth({
          ok: false,
          status: "down",
          label: "🔴 Binance API檢查失敗",
          symbolsFound: 0,
          symbolsExpected: 9
        });
      }
    }

    loadPrices();
    loadHealth();
    const priceTimer = setInterval(loadPrices, REFRESH_MS);
    const healthTimer = setInterval(loadHealth, 30000);

    return () => {
      clearInterval(priceTimer);
      clearInterval(healthTimer);
    };
  }, []);

  const dataReady = !warning && !error && assets.length > 0;
  const age = secondsAgo(updatedAt);

  const syncLabel = age === null ? "自動同步中" : age <= REALTIME_LIMIT_SEC ? "實時同步" : age <= DELAYED_LIMIT_SEC ? "同步延遲" : "資料逾時";
  const syncClass = age === null ? "syncPending" : age <= REALTIME_LIMIT_SEC ? "syncLive" : age <= DELAYED_LIMIT_SEC ? "syncLag" : "syncStale";

  const sortedAssets = useMemo(() => {
    return [...assets].sort((a, b) => {
      const aStats = getHoldingStats(a, holdings[a.symbol]);
      const bStats = getHoldingStats(b, holdings[b.symbol]);
      const aHolding = aStats.hasPosition ? 1 : 0;
      const bHolding = bStats.hasPosition ? 1 : 0;
      const aSignal = a.signal?.level || 0;
      const bSignal = b.signal?.level || 0;
      const aScore = (aHolding ? 1000 : 0) + (aSignal > 0 ? 500 : 0) + aSignal;
      const bScore = (bHolding ? 1000 : 0) + (bSignal > 0 ? 500 : 0) + bSignal;
      return bScore - aScore;
    });
  }, [assets, holdings]);

  const buyList = dataReady ? sortedAssets.filter((a) => a.signal?.level > 0) : [];
  const holdingList = dataReady ? sortedAssets.filter((a) => getHoldingStats(a, holdings[a.symbol]).hasPosition) : [];
  const idleList = dataReady ? sortedAssets.filter((a) => !a.signal?.level && !getHoldingStats(a, holdings[a.symbol]).hasPosition) : [];

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
        <div className="versionPill">V13.1</div>
        <h2 style={{ fontSize: "17px", margin: "12px 0 6px", color: "#cbd5e1" }}>Binance xStocks 戰情室</h2>
        <p>真實資料源：Binance xStocks Public API｜以 Binance 52週高點計算回撤。</p>
        <div className="update">更新：{updatedAt ? new Date(updatedAt).toLocaleString() : "讀取中"}</div>
        <div className={`syncPill ${syncClass}`}>
          {refreshing ? "自動更新中…" : syncLabel}
          {age !== null ? `｜${age}秒前｜每5秒自動更新` : ""}
        </div>
        {source && <div className="sourcePill">資料源：{source}</div>}

        <section style={{ marginTop: 12, padding: 12, borderRadius: 14, background: "#0f172a", border: "1px solid #1e293b", textAlign: "left" }}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>{health?.label || "🟡 Binance API檢查中"}</div>
          <div style={{ fontSize: 13, color: "#cbd5e1" }}>標的在線：{health?.symbolsFound ?? "--"}/{health?.symbolsExpected ?? 9}</div>
          <div style={{ fontSize: 13, color: "#cbd5e1" }}>API延遲：{health?.latencyMs ? `${health.latencyMs}ms` : "--"}</div>
          <div style={{ fontSize: 13, color: "#cbd5e1" }}>系統狀態：Price Engine / Signal Engine / Auto Refresh</div>
        </section>
      </section>

      {!dataReady && (
        <section className="dataGuard">
          <strong>資料源未就緒</strong>
          <p>{error || "等待 Binance xStocks 真實行情資料。"}</p>
          <span>保護規則：沒有真實 Binance xStocks 資料，就不顯示訊號。</span>
        </section>
      )}

      {dataReady && (
        <section style={{ margin: "16px 0", padding: "16px", background: "#1e293b", borderRadius: "16px", border: "2px solid #3b82f6", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#3b82f6", margin: "0 0 12px 0", display: "flex", alignItems: "center", gap: "8px" }}>⚡ 注意名單</h2>
          {buyList.length > 0 ? (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "0 8px 8px 8px", borderBottom: "1px solid #334155", color: "#94a3b8", fontSize: "13px", fontWeight: 700 }}>
                <div>標的 (Symbol)</div>
                <div style={{ textAlign: "center" }}>買點層級</div>
                <div style={{ textAlign: "right" }}>建議投入</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
                {buyList.map((asset) => {
                  const level = asset.signal?.level || 0;
                  const amount = parseAmount(asset.signal?.amount);
                  return (
                    <div key={`today-exec-${asset.symbol}`} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "10px 8px", background: "#0f172a", borderRadius: "10px", alignItems: "center", fontSize: "15px" }}>
                      <div style={{ fontWeight: 800, color: "#ffffff" }}>{asset.symbol}</div>
                      <div style={{ textAlign: "center", color: "#fcd34d", fontWeight: 700 }}>{ruleColors[level - 1]} {levelNames[level]}</div>
                      <div style={{ textAlign: "right", fontWeight: 900, color: "#4ade80" }}>{amount}U</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #334155", display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 900, fontSize: "16px", color: "#ffffff" }}>
                <span>{portfolio.invested > 0 ? "已投入" : "需投入"}</span>
<span style={{ color: "#4ade80", fontSize: "20px" }}>
  {portfolio.invested > 0 ? `${formatNumber(portfolio.invested)}U` : `${totalAmount}U`}
</span>
              </div>
            </div>
          ) : (
            <div style={{ padding: "16px 0", textAlign: "center", color: "#94a3b8", fontSize: "14px" }}>今天無任何標的觸發買點。</div>
          )}
        </section>
      )}

      <section className="warRoom">
        <div className="warRoomHeader" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div>
            <span>持倉市值</span>
            <strong>{formatNumber(portfolio.value)}U</strong>
          </div>
          <div>
            <span>未實現損益</span>
            <strong style={{ color: portfolio.pnl >= 0 ? "#22c55e" : "#ef4444" }}>{formatNumber(portfolio.pnl)}U</strong>
          </div>
        </div>
        {portfolio.invested > 0 && (
          <div style={{ color: portfolio.pnl >= 0 ? "#bbf7d0" : "#fecaca", fontWeight: 800, textAlign: "center", marginTop: 12, marginBottom: 4 }}>
            總投入 {formatNumber(portfolio.invested)}U｜報酬 {portfolioPct.toFixed(2)}%
          </div>
        )}
      </section>

      <section className="quickRule">
        <div><span>🟢 第一層</span><strong>5U</strong></div>
        <div><span>🟡 第二層</span><strong>10U</strong></div>
        <div><span>🟠 第三層</span><strong>15U</strong></div>
        <div><span>🔴 第四層</span><strong>20U</strong></div>
      </section>

      {dataReady && (
        <>
          <section className="sectionTitle">
            <h2>監控清單</h2>
            <p>排序：已持倉優先，其次是今日買點，其餘收在下方。</p>
          </section>

          <section className="list">
            {holdingList.length > 0 && (
              <>
                <div style={{ fontWeight: 900, color: "#bbf7d0", margin: "4px 0" }}>我的持倉</div>
                {holdingList.map((a) => (
                  <AssetCard asset={a} holding={holdings[a.symbol]} onUpdateHolding={updateHolding} key={a.symbol} />
                ))}
              </>
            )}

            {buyList.filter((a) => !getHoldingStats(a, holdings[a.symbol]).hasPosition).length > 0 && (
              <>
                <div style={{ fontWeight: 900, color: "#fde68a", margin: "4px 0" }}>今日買點</div>
                {buyList.filter((a) => !getHoldingStats(a, holdings[a.symbol]).hasPosition).map((a) => (
                  <AssetCard asset={a} holding={holdings[a.symbol]} onUpdateHolding={updateHolding} key={a.symbol} />
                ))}
              </>
            )}

            {idleList.length > 0 && (
              <details className="idleGroup">
                <summary>尚未到買點｜{idleList.length} 檔</summary>
                <div className="idleList">
                  {idleList.map((a) => (
                    <AssetCard asset={a} holding={holdings[a.symbol]} onUpdateHolding={updateHolding} key={a.symbol} />
                  ))}
                </div>
              </details>
            )}
          </section>
        </>
      )}

      <section className="infoFooter">
        <h2>V13 產品原則</h2>
        <p>折價獵人只處理 Binance xStocks 折價買點，不與富邦長期DCA、妖股幣追蹤混在同一專案。</p>
        <h2>資料說明</h2>
        <p>現價、52週高點、52週低點、市值與成交量由 Binance xStocks Public API 提供；持倉資料存在本機瀏覽器。</p>
      </section>
    </main>
  );
}

function AssetCard({ asset, holding, onUpdateHolding }) {
  const level = asset.signal?.level || 0;
  const levelClass = levelClasses[level] || "idle";
  const nextBuy = getNextBuyPoint(asset);
  const stats = getHoldingStats(asset, holding);
  const isCloseToNextLevel = nextBuy.gapToNextLevel !== null && nextBuy.gapToNextLevel <= 5;

  return (
    <div className={`card ${level > 0 ? "active" : "idle"} ${levelClass}`}>
      <div className="cardTop">
        <div className="titleRow">
          <div className="logoText">{asset.symbol.slice(0, 2)}</div>
          <div>
            <h2>{asset.symbol}</h2>
            <p>{asset.name}</p>
            <p className="desc">{asset.grade}級 ｜ {asset.description}</p>
          </div>
        </div>
        <div className="badge">{asset.grade}級</div>
      </div>

      <div className={`signal ${levelClass}`}>
        {level > 0 ? `${ruleColors[level - 1]} ${levelNames[level]}｜建議 ${parseAmount(asset.signal?.amount)}U` : "尚未到買點"}
      </div>

      {isCloseToNextLevel && (
        <div style={{ margin: "8px 0", padding: "10px", background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: "8px", color: "#78350f", fontSize: "13px", fontWeight: 700, lineHeight: "1.4" }}>
          <div style={{ fontSize: "14px", fontWeight: 900, display: "flex", alignItems: "center", gap: "4px", color: "#d97706" }}>🟡 接近下一層</div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
            <span>剩 {nextBuy.gapToNextLevel.toFixed(1)}%</span>
            <span>下一層投入 {nextBuy.nextAmount}U</span>
          </div>
        </div>
      )}

      <div className="dataGrid">
        <div><span>{asset.highType || "52週高點"}</span><strong>{formatNumber(asset.high)}</strong></div>
        <div><span>現價</span><strong>{formatNumber(asset.price)}</strong></div>
        <div><span>回撤</span><strong>{asset.discount ?? "--"}%</strong></div>
        <div><span>建議投入</span><strong>{parseAmount(asset.signal?.amount)}U</strong></div>
      </div>

      <div className="nextBuyBox">
        <div className="nextBuyTop"><span>{nextBuy.label}</span><strong>{nextBuy.amount}</strong></div>
        <p>{nextBuy.text}</p>
        <div className="nextBuyTrack"><div style={{ width: `${nextBuy.progress}%` }} /></div>
      </div>

      <details className="nextBuyBox">
        <summary style={{ cursor: "pointer", fontWeight: 900 }}>我的持倉 / 未實現損益</summary>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
          <label>
            <span style={{ display: "block", color: "#94a3b8", fontSize: 12, marginBottom: 4 }}>持有數量</span>
            <input value={holding?.qty || ""} onChange={(e) => onUpdateHolding(asset.symbol, "qty", e.target.value)} placeholder="例 0.12" inputMode="decimal" style={{ width: "100%", borderRadius: 10, border: "1px solid #334155", background: "#0f172a", color: "white", padding: 10 }} />
          </label>
          <label>
            <span style={{ display: "block", color: "#94a3b8", fontSize: 12, marginBottom: 4 }}>平均成本</span>
            <input value={holding?.cost || ""} onChange={(e) => onUpdateHolding(asset.symbol, "cost", e.target.value)} placeholder="例 396.3" inputMode="decimal" style={{ width: "100%", borderRadius: 10, border: "1px solid #334155", background: "#0f172a", color: "white", padding: 10 }} />
          </label>
        </div>
        <div className="dataGrid">
          <div><span>投入成本</span><strong>{formatNumber(stats.invested)}U</strong></div>
          <div><span>目前市值</span><strong>{formatNumber(stats.value)}U</strong></div>
          <div><span>未實現損益</span><strong style={{ color: stats.pnl >= 0 ? "#22c55e" : "#ef4444" }}>{formatNumber(stats.pnl)}U</strong></div>
          <div><span>報酬率</span><strong style={{ color: stats.pnl >= 0 ? "#22c55e" : "#ef4444" }}>{stats.hasPosition ? stats.pnlPct.toFixed(2) : "0.00"}%</strong></div>
        </div>
      </details>

      <div className="ruleBox">
        <h4>買點規則</h4>
        {asset.rules?.map((rule, idx) => (
          <div key={idx} className={level === idx + 1 ? "rule activeRule" : "rule"}>
            <span>{ruleColors[idx]} 第{idx + 1}層</span>
            <strong>{rule}% → {asset.amounts?.[idx]}U</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

