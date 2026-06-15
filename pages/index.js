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
    return { label: "下一買點", text: "資料未就緒", amount: "0U", progress: 0 };
  }

  const nextIndex = rules.findIndex((rule) => discount > rule);

  if (nextIndex === -1) {
    return { label: "下一買點", text: "已達最深層", amount: "完成", progress: 100 };
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
    progress
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
  const [tick, setTick] = useState(0);
  const [holdings, setHoldings] = useState({});

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("discountHunterHoldings") || "{}");
      setHoldings(saved);
    } catch {
      setHoldings({});
    }
  }, []);

  function updateHolding(symbol, field, value) {
    const next = {
      ...holdings,
      [symbol]: {
        ...(holdings[symbol] || {}),
        [field]: value
      }
    };
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

    loadPrices();
    const timer = setInterval(loadPrices, REFRESH_MS);
    const clock = setInterval(() => setTick((value) => value + 1), 1000);

    return () => {
      clearInterval(timer);
      clearInterval(clock);
    };
  }, []);

  const dataReady = !warning && !error && assets.length > 0;
  const age = secondsAgo(updatedAt);
  const syncLabel = age === null
    ? "自動同步中"
    : age <= REALTIME_LIMIT_SEC
      ? "實時同步"
      : age <= DELAYED_LIMIT_SEC
        ? "同步延遲"
        : "資料逾時";
  const syncClass = age === null
    ? "syncPending"
    : age <= REALTIME_LIMIT_SEC
      ? "syncLive"
      : age <= DELAYED_LIMIT_SEC
        ? "syncLag"
        : "syncStale";

  const sortedAssets = useMemo(() => {
    return [...assets].sort((a, b) => {
      const getLevel = (x) => x.signal?.level || 99;
      return getLevel(a) - getLevel(b);
    });
  }, [assets]);

  const buyList = dataReady ? sortedAssets.filter((a) => a.signal?.level > 0) : [];
  const idleList = dataReady ? sortedAssets.filter((a) => !a.signal?.level) : [];
  const totalAmount = buyList.reduce((sum, asset) => sum + parseAmount(asset.signal?.amount), 0);
  const portfolio = assets.reduce((sum, asset) => {
    const stats = getHoldingStats(asset, holdings[asset.symbol]);
    return {
      invested: sum.invested + stats.invested,
      value: sum.value + stats.value,
      pnl: sum.pnl + stats.pnl
    };
  }, { invested: 0, value: 0, pnl: 0 });
  const portfolioPct = portfolio.invested > 0 ? (portfolio.pnl / portfolio.invested) * 100 : 0;

  return (
    <main className="page">
      <section className="hero compactHero">
        <div className="versionPill">DCA 折價獵人 V11</div>
        <h1>今日戰情室</h1>
        <p>真實資料源：Binance xStocks Public API｜以 Binance 52週高點計算回撤。</p>
        <div className="update">
          更新：{updatedAt ? new Date(updatedAt).toLocaleString() : "讀取中"}
        </div>
        <div className={`syncPill ${syncClass}`}>
          {refreshing ? "自動更新中…" : syncLabel}{age !== null ? `｜${age}秒前｜每5秒自動更新` : ""}
        </div>
        {source && <div className="sourcePill">資料源：{source}</div>}
      </section>

      {!dataReady && (
        <section className="dataGuard">
          <strong>資料源未就緒</strong>
          <p>{error || "等待 Binance xStocks 真實行情資料。"}</p>
          <span>保護規則：沒有真實 Binance xStocks 資料，就不顯示訊號。</span>
        </section>
      )}

      <section className="warRoom">
        <div className="warRoomHeader">
          <div>
            <span>今日訊號</span>
            <strong>{buyList.length} 檔</strong>
          </div>
          <div>
            <span>建議總投入</span>
            <strong>{totalAmount}U</strong>
          </div>
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
          <div style={{ color: portfolio.pnl >= 0 ? "#bbf7d0" : "#fecaca", fontWeight: 800, textAlign: "center", marginBottom: 12 }}>
            總投入 {formatNumber(portfolio.invested)}U｜報酬 {portfolioPct.toFixed(2)}%
          </div>
        )}

        {buyList.length > 0 ? (
          <div className="missionList">
            {buyList.map((asset) => {
              const level = asset.signal?.level || 0;
              const amount = parseAmount(asset.signal?.amount);
              return (
                <div className={`missionItem ${levelClasses[level] || "idle"}`} key={asset.symbol}>
                  <div className="missionLeft">
                    <span className="signalDot">{ruleColors[level - 1]}</span>
                    <div>
                      <strong>{asset.symbol}</strong>
                      <p>{levelNames[level]}｜回撤 {asset.discount}%</p>
                    </div>
                  </div>
                  <div className="missionAmount">{amount}U</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="emptyMission">
            <strong>{dataReady ? "今天沒有任務" : "等待真實數據"}</strong>
            <p>{dataReady ? "沒有標的達到買點，保持現金，關掉 App。" : "資料完成前，不顯示投入金額。"}</p>
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
            <h2>全部監控</h2>
            <p>已達買點自動置頂；未達買點收在下方。持倉資料存在本機瀏覽器。</p>
          </section>

          <section className="list">
            {buyList.map((a) => <AssetCard asset={a} holding={holdings[a.symbol]} onUpdateHolding={updateHolding} key={a.symbol} />)}
            {idleList.length > 0 && (
              <details className="idleGroup">
                <summary>尚未到買點｜{idleList.length} 檔</summary>
                <div className="idleList">
                  {idleList.map((a) => <AssetCard asset={a} holding={holdings[a.symbol]} onUpdateHolding={updateHolding} key={a.symbol} />)}
                </div>
              </details>
            )}
          </section>
        </>
      )}

      <section className="infoFooter">
        <h3>V11 產品原則</h3>
        <p>首頁回答五件事：是否同步、今天要不要買、買多少、離下一層差多遠、目前持倉賺虧多少。</p>
        <h3>資料說明</h3>
        <p>現價、52週高點、52週低點、市值與成交量改由 Binance xStocks Public API 提供；持倉資料先存在本機瀏覽器，之後再做 Binance 持倉同步。</p>
      </section>
    </main>
  );
}

function AssetCard({ asset, holding, onUpdateHolding }) {
  const level = asset.signal?.level || 0;
  const levelClass = levelClasses[level] || "idle";
  const nextBuy = getNextBuyPoint(asset);
  const stats = getHoldingStats(asset, holding);

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

      <div className="dataGrid">
        <div>
          <span>{asset.highType || "52週高點"}</span>
          <strong>{formatNumber(asset.high)}</strong>
        </div>
        <div>
          <span>現價</span>
          <strong>{formatNumber(asset.price)}</strong>
        </div>
        <div>
          <span>回撤</span>
          <strong>{asset.discount ?? "--"}%</strong>
        </div>
        <div>
          <span>建議投入</span>
          <strong>{parseAmount(asset.signal?.amount)}U</strong>
        </div>
      </div>

      <div className="nextBuyBox">
        <div className="nextBuyTop">
          <span>{nextBuy.label}</span>
          <strong>{nextBuy.amount}</strong>
        </div>
        <p>{nextBuy.text}</p>
        <div className="nextBuyTrack">
          <div style={{ width: `${nextBuy.progress}%` }} />
        </div>
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
