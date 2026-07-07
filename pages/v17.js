import { useEffect, useMemo, useState } from "react";
import { classifyUniverse } from "../lib/v17-state-classifier";
import { AssetCard, fmtAmount, PageShell, Section, TierProgress } from "../components/v17-dashboard-ui";

const REFRESH_MS = 60000;
const CACHE_KEY = "v17-fast-open-cache";

const CATEGORY_BY_SYMBOL = {
  BTC: "比特幣引擎",
  QQQ: "核心 ETF",
  QQQM: "核心 ETF",
  QQQON: "核心 ETF",
  NVDA: "AI 基礎建設",
  NVDAON: "AI 基礎建設",
  TSM: "AI 基礎建設",
  TSMON: "AI 基礎建設",
  AVGO: "AI 基礎建設",
  AVGOON: "AI 基礎建設",
  AMD: "AI 基礎建設",
  AMDON: "AI 基礎建設",
  MRVL: "AI 基礎建設",
  MRVLON: "AI 基礎建設",
  GOOGL: "平台型公司",
  GOOGLON: "平台型公司",
  RKLB: "高成長深折扣",
  RKLBon: "高成長深折扣",
  RKLBON: "高成長深折扣",
  SPCX: "高成長深折扣",
  SPCXON: "高成長深折扣",
};

function symbolKey(symbol) {
  return String(symbol || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function categoryFor(row) {
  const key = symbolKey(row?.symbol);
  return CATEGORY_BY_SYMBOL[key] || (key.endsWith("ON") ? "代幣化美股" : "觀察資產");
}

function referenceModelFor(row) {
  const key = symbolKey(row?.symbol);
  return key === "BTC" ? "Cycle High 回撤" : "52週高點回撤";
}

async function jsonFetch(url, options = {}) {
  const res = await fetch(url, { cache: "no-store", ...options });
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.ok === false) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
  return data;
}

function readFastCache() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeFastCache(payload) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({ ...payload, cachedAt: new Date().toISOString() }));
  } catch {}
}

function marketMapFromRows(rows = []) {
  return Object.fromEntries((rows || []).map((row) => [row.symbol, {
    symbol: row.symbol,
    price: row.price,
    high: row.high,
    high52w: row.high52w,
    cycleHigh: row.high || row.cycleHigh || row.high52w,
    discount: row.discount,
  }]));
}

function btcPriceFromRows(rows = []) {
  const btc = (rows || []).find((row) => String(row.symbol || "").toUpperCase() === "BTC");
  return Number(btc?.price || 0);
}

function holdingValue(holding) {
  return Number(holding?.currentValue || holding?.marketValue || holding?.positionValue || holding?.rawCurrentValue || 0);
}

function hasChainVerifiableCost(holding) {
  const cost = Number(holding?.totalCost || 0);
  if (!(cost > 0)) return false;
  if (holding?.costBasisMissing) return false;
  const source = String(holding?.costBasisSource || "");
  return source.includes("transfer_history")
    || source.includes("binance_myTrades")
    || source.includes("verified_tx_hash_receipt");
}

function mergeHoldingsBySymbol(...groups) {
  const map = new Map();
  for (const group of groups || []) {
    for (const holding of group || []) {
      const symbol = String(holding?.symbol || "").toUpperCase();
      if (symbol && Number(holding.quantity || 0) > 0) map.set(symbol, holding);
    }
  }
  return [...map.values()];
}

function withStrictRealPositions({ walletData, exchangeData }) {
  const base = walletData || { ok: true, holdings: [] };
  const walletHoldings = Array.isArray(base.holdings) ? base.holdings : [];
  const exchangeHoldings = Array.isArray(exchangeData?.holdings) ? exchangeData.holdings : [];
  return {
    ...base,
    holdings: mergeHoldingsBySymbol(walletHoldings, exchangeHoldings),
    btcPositionSource: exchangeHoldings.some((h) => String(h.symbol || "").toUpperCase() === "BTC" && Number(h.quantity) > 0)
      ? "binance_exchange_readonly"
      : "not_available_no_manual_fallback",
    binanceExchange: exchangeData || { ok: false, configured: false },
    strictRealPositionMode: true,
  };
}

function usd(value) {
  if (value === null || value === undefined) return "N/A";
  const n = Number(value || 0);
  return `$${n.toFixed(2)}`;
}
function signedUsd(value) {
  if (value === null || value === undefined) return "N/A";
  const n = Number(value || 0);
  return `${n > 0 ? "+" : n < 0 ? "-" : ""}$${Math.abs(n).toFixed(2)}`;
}
function signedPct(value) {
  if (value === null || value === undefined) return "N/A";
  const n = Number(value || 0) * 100;
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
}
function signedColor(value) {
  if (value === null || value === undefined) return "#e2e8f0";
  const n = Number(value || 0);
  if (n > 0) return "#4ade80";
  if (n < 0) return "#fb7185";
  return "#e2e8f0";
}

function walletSummary(holdings = []) {
  const live = (holdings || []).filter((h) => Number(h.quantity) > 0);
  const known = live.filter(hasChainVerifiableCost);
  const missing = live.filter((h) => !hasChainVerifiableCost(h));
  const knownCost = known.reduce((s, h) => s + Number(h.totalCost || 0), 0);
  const totalValue = live.reduce((s, h) => s + holdingValue(h), 0);
  const missingValue = missing.reduce((s, h) => s + holdingValue(h), 0);
  const totalCostReady = live.length > 0 && missing.length === 0;
  const totalCost = totalCostReady ? knownCost : null;
  const totalPnl = totalCostReady ? totalValue - knownCost : null;
  const totalPnlPct = totalCostReady && knownCost > 0 ? totalPnl / knownCost : null;
  return {
    count: live.length,
    knownCount: known.length,
    totalValue,
    missingValue,
    totalCostReady,
    totalCost,
    totalPnl,
    totalPnlPct,
    costMissingCount: missing.length,
    missingSymbols: missing.map((h) => String(h.symbol || "").toUpperCase()).filter(Boolean),
  };
}

function Pill({ children, tone = "blue" }) {
  const map = {
    green: ["#bbf7d0", "rgba(34,197,94,.14)", "rgba(34,197,94,.26)"],
    yellow: ["#fde68a", "rgba(245,158,11,.14)", "rgba(245,158,11,.26)"],
    red: ["#fecaca", "rgba(248,113,113,.14)", "rgba(248,113,113,.26)"],
    blue: ["#bae6fd", "rgba(14,165,233,.13)", "rgba(14,165,233,.22)"],
  };
  const [color, bg, border] = map[tone] || map.blue;
  return <span style={{ color, background: bg, border: `1px solid ${border}`, borderRadius: 999, padding: "5px 8px", fontSize: 11, fontWeight: 1000 }}>{children}</span>;
}

function V18GovernanceCard() {
  return <section style={{ margin: "12px 0 16px", padding: 14, borderRadius: 18, background: "linear-gradient(135deg, rgba(8,47,73,.72), rgba(15,23,42,.96))", border: "1px solid rgba(56,189,248,.28)", boxShadow: "0 14px 36px rgba(14,165,233,.12)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 1000, color: "#e0f2fe" }}>Discount Hunter</h2>
        <div style={{ marginTop: 5, color: "#94a3b8", fontSize: 12, fontWeight: 850 }}>App V17.1｜Playbook Josh Portfolio V18.0｜Status Ready for Review</div>
      </div>
      <Pill tone="blue">V17.2 準備中</Pill>
    </div>
    <div style={{ marginTop: 12, display: "grid", gap: 8, color: "#cbd5e1", fontSize: 12, fontWeight: 850, lineHeight: 1.55 }}>
      <div>決策語意：買點只是「允許買入」，不是「必須買」。</div>
      <div>自動交易進度：Phase 1 訊號只讀；後續逐版推進 Telegram 確認、下單草稿、有限半自動。</div>
      <div>Quality：半自動開始，財務數字自動抓，質化條件由 Josh 最終確認。</div>
    </div>
  </section>;
}

function AssetMeta({ row }) {
  return <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
    <Pill tone="blue">{categoryFor(row)}</Pill>
    <Pill tone={symbolKey(row?.symbol) === "BTC" ? "yellow" : "green"}>{referenceModelFor(row)}</Pill>
    <Pill tone="yellow">Quality：未檢查</Pill>
  </div>;
}

function decisionFramework(row, walletSummaryData) {
  if (walletSummaryData.costMissingCount > 0) {
    return { label: "等待確認", tone: "yellow", reason: `成本資料缺 ${walletSummaryData.costMissingCount} 檔，先不升級為允許買入` };
  }
  return { label: "等待確認", tone: "yellow", reason: "價格到位；Quality / 部位 / 預算需人工確認後才可買" };
}

function DecisionStatusBox({ row, walletSummaryData }) {
  const status = decisionFramework(row, walletSummaryData);
  return <div style={{ marginTop: 10, padding: 10, borderRadius: 12, fontWeight: 900, background: "rgba(245,158,11,.12)", color: "#fde68a", border: "1px solid rgba(245,158,11,.24)", lineHeight: 1.5 }}>
    <div>決策狀態：{status.label}</div>
    <div style={{ marginTop: 3, fontSize: 12, color: "#fef3c7" }}>{status.reason}</div>
    <div style={{ marginTop: 3, fontSize: 12, color: "#fef3c7" }}>訊號金額：{row.decision?.amountText || fmtAmount(row.decision?.amount)}｜不是強制買入</div>
  </div>;
}

function QualityPreviewCard() {
  return <details style={{ marginTop: 16, padding: 12, borderRadius: 16, background: "linear-gradient(135deg, rgba(30,41,59,.88), rgba(15,23,42,.94))", border: "1px solid rgba(56,189,248,.25)" }}>
    <summary style={{ color: "#bae6fd", fontWeight: 1000, fontSize: 16 }}>中文 Quality Checklist｜半自動範圍</summary>
    <div style={{ marginTop: 10, display: "grid", gap: 8, color: "#cbd5e1", fontWeight: 850, fontSize: 12, lineHeight: 1.6 }}>
      <div>客觀條件：營收成長、自由現金流、毛利率、資產負債表、資本支出趨勢。</div>
      <div>質化條件：產業領導地位、護城河、管理層品質、投資假設是否成立。</div>
      <div>狀態：通過 / 觀察 / 失敗 / 未檢查。</div>
      <div>V17.2 先顯示框架；V17.3 做手動狀態保存；V17.4 接客觀財務資料。</div>
    </div>
  </details>;
}

function PortfolioSummaryCard({ summary, updatedAt }) {
  const healthy = summary.count > 0 && summary.costMissingCount === 0;
  return <section style={{ margin: "12px 0 16px", padding: 12, background: "linear-gradient(135deg, rgba(2,6,23,.96), rgba(15,23,42,.92))", borderRadius: 16, border: `1px solid ${healthy ? "rgba(34,197,94,.55)" : "rgba(245,158,11,.35)"}` }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 1000, color: healthy ? "#4ade80" : "#fde68a", margin: 0 }}>真實持倉</h2>
        <div style={{ marginTop: 4, color: "#94a3b8", fontSize: 11, fontWeight: 850 }}>折價獵人全部持倉，不分 BTC / xStocks 顯示</div>
      </div>
      <div style={{ color: healthy ? "#bbf7d0" : "#fde68a", fontSize: 12, fontWeight: 1000, padding: "6px 9px", borderRadius: 999, background: healthy ? "rgba(34,197,94,.12)" : "rgba(245,158,11,.12)", border: `1px solid ${healthy ? "rgba(34,197,94,.24)" : "rgba(245,158,11,.24)"}` }}>{healthy ? "PASS" : "CHECK"}</div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
      <div><div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 850 }}>總投入</div><div style={{ color: "#f8fafc", fontSize: 18, fontWeight: 1000, marginTop: 3 }}>{usd(summary.totalCost)}</div></div>
      <div><div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 850 }}>目前市值</div><div style={{ color: "#f8fafc", fontSize: 18, fontWeight: 1000, marginTop: 3 }}>{usd(summary.totalValue)}</div></div>
      <div><div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 850 }}>未實現損益</div><div style={{ color: signedColor(summary.totalPnl), fontSize: 18, fontWeight: 1000, marginTop: 3 }}>{signedUsd(summary.totalPnl)}</div></div>
      <div><div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 850 }}>報酬率</div><div style={{ color: signedColor(summary.totalPnlPct), fontSize: 18, fontWeight: 1000, marginTop: 3 }}>{signedPct(summary.totalPnlPct)}</div></div>
    </div>
    {summary.costMissingCount > 0 ? <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: "rgba(245,158,11,.10)", border: "1px solid rgba(245,158,11,.25)", color: "#fde68a", fontSize: 12, fontWeight: 850, lineHeight: 1.5 }}>
      目前有 {summary.costMissingCount} 筆缺成本，缺成本市值 {usd(summary.missingValue)}，所以總投入 / 未實現損益 / 報酬率暫不可計算。市值仍可顯示。
    </div> : null}
    <details style={{ marginTop: 8, color: "#94a3b8", fontSize: 11, fontWeight: 800 }}>
      <summary>資料來源 / 成本細節</summary>
      <div style={{ marginTop: 6, lineHeight: 1.55 }}>
        持倉數：{summary.count}｜已取得成本：{summary.knownCount}｜缺成本：{summary.costMissingCount}<br />
        成本公式：折價獵人全部持倉成本加總。成本來源需可驗證，不用人工猜值。<br />
        缺成本：{summary.missingSymbols?.join("、") || "none"}<br />
        Last Sync：{updatedAt || "background refresh"}
      </div>
    </details>
  </section>;
}

function tierStatusText(row) {
  if (row.skippedTiers?.includes(row.tier)) return `已略過：${row.tier}`;
  const done = row.ledgerDoneTiers?.length ? row.ledgerDoneTiers.join(" / ") : row.tier;
  return `已完成：${done}`;
}
function tierStatusStyle(row) {
  if (row.skippedTiers?.includes(row.tier)) return { background: "rgba(51,65,85,.55)", color: "#cbd5e1", border: "1px solid rgba(148,163,184,.24)" };
  return { background: "rgba(34,197,94,.10)", color: "#bbf7d0", border: "1px solid rgba(34,197,94,.12)" };
}
function watchStatusStyle() { return { background: "rgba(14,165,233,.10)", color: "#bae6fd", border: "1px solid rgba(14,165,233,.18)" }; }

function DecisionActions({ row, onAction, busy }) {
  const decision = row.decision || {};
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
    <button disabled={busy} onClick={() => onAction(row, "complete")} style={{ padding: "10px 8px", borderRadius: 12, border: "1px solid rgba(34,197,94,.45)", background: "rgba(34,197,94,.16)", color: "#bbf7d0", fontWeight: 1000 }}>已完成</button>
    <button disabled={busy} onClick={() => onAction(row, "skip")} style={{ padding: "10px 8px", borderRadius: 12, border: "1px solid rgba(250,204,21,.45)", background: "rgba(250,204,21,.13)", color: "#fde68a", fontWeight: 1000 }}>略過本層</button>
    <div style={{ gridColumn: "1 / -1", color: "#94a3b8", fontSize: 12, fontWeight: 850 }}>Action：{decision.tier || row.tier}｜{decision.amountText || fmtAmount(decision.amount)}</div>
  </div>;
}

function Collapsible({ title, count, rows, render, open = false }) {
  return <details style={{ marginTop: 16, padding: 14, borderRadius: 16, background: "linear-gradient(135deg, rgba(30,41,59,.92), rgba(15,23,42,.96))", border: "1px solid rgba(243,186,47,.22)" }} open={open}>
    <summary style={{ color: "#e2e8f0", fontWeight: 1000, fontSize: 19 }}>{title}（{count}）</summary>
    <section style={{ marginTop: 12, display: "grid", gap: 12 }}>{rows.map(render)}</section>
  </details>;
}

function StateMachineCheck({ classified }) {
  const status = classified.ok ? "PASS" : "CHECK";
  const color = classified.ok ? "#22c55e" : "#f59e0b";
  return <details style={{ marginTop: 16, padding: 12, borderRadius: 16, background: "linear-gradient(135deg, rgba(30,41,59,.88), rgba(15,23,42,.94))", border: `1px solid ${color}` }}>
    <summary style={{ color, fontWeight: 1000, fontSize: 16 }}>📘 State Machine｜{status}｜U{classified.summary.universeCount} D{classified.summary.decisionCount} H{classified.summary.holdingCount} W{classified.summary.watchCount}</summary>
    <div style={{ marginTop: 8, display: "grid", gap: 6, color: "#cbd5e1", fontWeight: 850, fontSize: 12 }}><div>Missing：{classified.summary.missingSymbols.join(", ") || "none"}</div><div>Duplicate：{classified.summary.duplicateSymbols.join(", ") || "none"}</div></div>
  </details>;
}

export default function V17Dashboard() {
  const [assets, setAssets] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [decisionStates, setDecisionStates] = useState([]);
  const [ledger, setLedger] = useState({});
  const [wallet, setWallet] = useState(null);
  const [source, setSource] = useState("Binance xStocks public API");
  const [updatedAt, setUpdatedAt] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState("");
  const [hydratedFromCache, setHydratedFromCache] = useState(false);

  function applySnapshot(snapshot) {
    if (!snapshot) return;
    setAssets(snapshot.assets || []);
    setLedger(snapshot.ledger || {});
    setWallet(snapshot.wallet || null);
    setDecisions(snapshot.decisions || []);
    setDecisionStates(snapshot.decisionStates || []);
    setUpdatedAt(snapshot.updatedAt || snapshot.cachedAt || "");
    setSource(snapshot.source || "Binance xStocks public API");
  }

  async function load({ silent = false } = {}) {
    if (!silent) setLoading(true);
    try {
      const prices = await jsonFetch(`/api/prices?t=${Date.now()}`);
      const rows = Array.isArray(prices.data) ? prices.data : [];
      const [ledgerData, today] = await Promise.all([
        jsonFetch(`/api/buy-ledger?t=${Date.now()}`),
        jsonFetch(`/api/v17/ui-decisions?t=${Date.now()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ markets: marketMapFromRows(rows), persistState: true }) }),
      ]);

      setAssets(rows);
      setLedger(ledgerData.ledger || {});
      setDecisions(today.cards || []);
      setDecisionStates(today.states || []);
      setUpdatedAt(prices.updatedAt || today.updatedAt || new Date().toISOString());
      setSource(prices.source || "Binance xStocks public API");
      setError("");
      if (!silent) setLoading(false);

      const btcPrice = btcPriceFromRows(rows);
      const [walletRaw, exchangeData] = await Promise.all([
        jsonFetch(`/api/sync-wallet?t=${Date.now()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }).catch(() => null),
        jsonFetch(`/api/binance-exchange-position?btcPrice=${encodeURIComponent(btcPrice)}&t=${Date.now()}`).catch(() => null),
      ]);
      const walletData = withStrictRealPositions({ walletData: walletRaw, exchangeData });
      setWallet(walletData);

      writeFastCache({
        assets: rows,
        ledger: ledgerData.ledger || {},
        wallet: walletData,
        decisions: today.cards || [],
        decisionStates: today.states || [],
        updatedAt: prices.updatedAt || today.updatedAt || new Date().toISOString(),
        source: prices.source || "Binance xStocks public API",
      });
    } catch (err) {
      setError(err.message || "V17 讀取失敗");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function handleDecisionAction(row, action) {
    const decision = row.decision || {};
    const id = `${row.symbol}-${row.tier}-${action}`;
    setActionBusy(id);
    try {
      await jsonFetch("/api/v17/action-event", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, symbol: row.symbol, layer: decision.level || row.signalLevel, amount: decision.amount, price: row.price }) });
      await load();
    } catch (err) {
      setError(err.message || "Action failed");
    } finally {
      setActionBusy("");
    }
  }

  useEffect(() => {
    const cached = readFastCache();
    if (cached) {
      applySnapshot(cached);
      setHydratedFromCache(true);
      load({ silent: true });
    } else {
      load();
    }
    const timer = setInterval(() => load({ silent: true }), REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  const classified = useMemo(() => classifyUniverse({ assets, ledger, holdings: wallet?.holdings || [], decisions, states: decisionStates }), [assets, ledger, wallet, decisions, decisionStates]);
  const ws = walletSummary(wallet?.holdings || []);
  const ledgerStatus = classified.summary.duplicateSymbols.length || classified.summary.missingSymbols.length ? "CHECK" : "PASS";

  return <PageShell loading={loading && !hydratedFromCache} updatedAt={updatedAt} error={error}>
    <V18GovernanceCard />
    <Section title="今日決策" count={classified.decisionRows.length} rows={classified.decisionRows} empty="已略過目前所有可執行買點，等待下一層" render={(row) => <AssetCard key={`decision-${row.symbol}`} row={row}><AssetMeta row={row} /><DecisionStatusBox row={row} walletSummaryData={ws} /><TierProgress row={row} /><DecisionActions row={row} onAction={handleDecisionAction} busy={Boolean(actionBusy)} /></AssetCard>} />
    <PortfolioSummaryCard summary={ws} updatedAt={wallet?.lastSyncTime || updatedAt} />
    <Collapsible title="✅ 持倉區" count={classified.holdingRows.length} rows={classified.holdingRows} open render={(row) => <AssetCard key={`holding-${row.symbol}`} row={row}><AssetMeta row={row} /><div style={{ marginTop: 10, padding: 10, borderRadius: 12, fontWeight: 900, ...tierStatusStyle(row) }}>{tierStatusText(row)}</div><TierProgress row={row} /></AssetCard>} />
    <Collapsible title="👀 觀察區" count={classified.watchRows.length} rows={classified.watchRows} render={(row) => <AssetCard key={`watch-${row.symbol}`} row={row}><AssetMeta row={row} /><div style={{ marginTop: 10, padding: 10, borderRadius: 12, fontWeight: 900, ...watchStatusStyle() }}>觀察中：尚未到第一買點</div><TierProgress row={row} /></AssetCard>} />
    <QualityPreviewCard />
    <StateMachineCheck classified={classified} />
    <details style={{ marginTop: 14, padding: 12, borderRadius: 14, color: "#94a3b8", background: "rgba(15,23,42,.72)", border: "1px solid rgba(148,163,184,.16)" }}>
      <summary style={{ fontWeight: 1000 }}>系統資訊｜{source}｜Ledger {ledgerStatus}</summary>
      <div style={{ marginTop: 8, display: "grid", gap: 4, fontSize: 12 }}>
        <div>App：Discount Hunter V17.1｜Playbook：Josh Portfolio V18.0｜V19：Future Draft</div>
        <div>Universe：BTC + QQQon + NVDAon + TSMon + AVGOon + SPCXon + GOOGLon + AMDon + MRVLon + RKLBon</div>
        <div>Wallet Source：{wallet?.source || "cached / loading"}</div>
        <div>Wallet Sync：{wallet?.walletSyncSource || "background refresh"}</div>
        <div>成本政策：全部持倉合併計算，不在畫面上拆成 BTC / xStocks 兩套資產。</div>
        <div>Auto Trading：Phase 1 訊號只讀；後續版本逐步加入確認、草稿、限額與 Kill Switch</div>
        <div>Last Sync：{wallet?.lastSyncTime || updatedAt}</div>
      </div>
    </details>
  </PageShell>;
}
