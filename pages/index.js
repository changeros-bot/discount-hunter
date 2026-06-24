import { useEffect, useMemo, useState } from "react";

const REFRESH_MS = 5000;
const ruleColors = ["🟢", "🟡", "🟠", "🔴"];
const levelNames = ["", "D1", "D2", "D3", "D4"];

function n(value) { const x = Number(String(value ?? "").replace(/[^0-9.-]/g, "")); return Number.isFinite(x) ? x : 0; }
function pct(value) { const x = Number(value); return Number.isFinite(x) ? `${x.toFixed(1)}%` : "--"; }
function money(value) { const x = Number(value); return Number.isFinite(x) ? `${x.toFixed(2).replace(".00", "")}U` : "--"; }
function signedUsd(value) { const x = Number(value || 0); const sign = x > 0 ? "+" : x < 0 ? "-" : ""; return `${sign}$${Math.abs(x).toFixed(2)}`; }
function signedPct(value) { const x = Number(value || 0) * 100; return `${x > 0 ? "+" : ""}${x.toFixed(2)}%`; }
function signedColor(value) { const x = Number(value || 0); return x > 0 ? "#22c55e" : x < 0 ? "#ef4444" : "#f8fafc"; }
function normalizeSymbol(symbol) { return String(symbol || "").trim().toUpperCase(); }
function isLiveHolding(h) { return h && Number(h.quantity) > 0 && h.quantitySource === "bsc_rpc_balanceOf_live"; }
function formatTime(iso) { if (!iso) return "讀取中"; const d = new Date(iso); return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`; }

async function jsonFetch(url, options = {}) {
  const res = await fetch(url, { cache: "no-store", ...options });
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.ok === false) throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
  return data;
}

function getSignalLevel(asset) { return Number(asset?.signal?.level || 0); }
function getCompletedLevel(ledger, symbol) {
  const rows = ledger?.[symbol] || ledger?.[normalizeSymbol(symbol)] || {};
  for (let i = 4; i >= 1; i--) if (Array.isArray(rows[`D${i}`]) && rows[`D${i}`].length) return i;
  return 0;
}
function getLedgerText(ledger, symbol) {
  const rows = ledger?.[symbol] || ledger?.[normalizeSymbol(symbol)] || {};
  const done = [1, 2, 3, 4].filter((i) => Array.isArray(rows[`D${i}`]) && rows[`D${i}`].length).map((i) => `D${i}`);
  return done.length ? `已登帳：${done.join(" / ")}` : "尚未登帳折價買入";
}
function getProgress(asset) {
  const level = getSignalLevel(asset);
  const currentDepth = Math.abs(Number(asset.discount || 0));
  const rules = (asset.rules || []).map((r) => Math.abs(Number(r))).filter(Number.isFinite);
  const amounts = asset.amounts || [];
  if (!rules.length) return { fromText: "0U", toText: "0U", stageText: "資料未就緒", displayProgress: 0 };
  if (level <= 0) {
    const target = rules[0];
    const progress = target > 0 ? Math.min(99, Math.max(0, currentDepth / target * 100)) : 0;
    return { fromText: "0U", toText: `${amounts[0] || 0}U`, stageText: `尚未到買點 → D1`, displayProgress: Math.floor(progress) };
  }
  if (level >= rules.length) {
    return { fromText: `${amounts[level - 1] || 0}U`, toText: "最深層", stageText: `${levelNames[level]} → 最深層`, displayProgress: 99 };
  }
  const start = rules[level - 1];
  const target = rules[level];
  const progress = Math.min(99, Math.max(0, ((currentDepth - start) / Math.max(0.000001, target - start)) * 100));
  return { fromText: `${amounts[level - 1] || 0}U`, toText: `${amounts[level] || 0}U`, stageText: `${levelNames[level]} → ${levelNames[level + 1]}`, displayProgress: Math.floor(progress) };
}
function summarizeHoldings(holdings) {
  const live = (holdings || []).filter(isLiveHolding);
  const totalCost = live.reduce((s, h) => s + Number(h.totalCost || 0), 0);
  const marketValue = live.reduce((s, h) => s + Number(h.currentValue || 0), 0);
  const pnl = marketValue - totalCost;
  return { live, totalCost, marketValue, pnl, pnlPct: totalCost > 0 ? pnl / totalCost : 0 };
}

export default function Home() {
  const [assets, setAssets] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [ledger, setLedger] = useState({});
  const [updatedAt, setUpdatedAt] = useState("");
  const [source, setSource] = useState("");
  const [wallet, setWallet] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadAll() {
    setLoading(true);
    try {
      const prices = await jsonFetch(`/api/prices?t=${Date.now()}`);
      const assetRows = prices.data || [];
      const today = await jsonFetch(`/api/today-decisions?t=${Date.now()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assets: assetRows }) });
      const ledgerData = await jsonFetch(`/api/buy-ledger?t=${Date.now()}`);
      setAssets(assetRows);
      setDecisions(today.decisions || []);
      setLedger(ledgerData.ledger || {});
      setUpdatedAt(prices.updatedAt || today.updatedAt || "");
      setSource(prices.source || "");
      setError("");
    } catch (e) { setError(e.message || "讀取失敗"); }
    finally { setLoading(false); }
  }
  async function syncWallet() {
    try {
      const data = await jsonFetch(`/api/sync-wallet?t=${Date.now()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      setWallet(data);
    } catch {}
  }
  useEffect(() => { loadAll(); syncWallet(); const t = setInterval(loadAll, REFRESH_MS); const w = setInterval(syncWallet, 60000); return () => { clearInterval(t); clearInterval(w); }; }, []);

  const decisionKey = useMemo(() => new Set(decisions.map((d) => `${d.symbol}_${d.tier}`)), [decisions]);
  const decisionMap = useMemo(() => new Map(decisions.map((d) => [`${d.symbol}_${d.tier}`, d])), [decisions]);
  const enhancedAssets = useMemo(() => assets.map((asset) => {
    const level = getSignalLevel(asset);
    const tier = level > 0 ? `D${level}` : "";
    const decision = decisionMap.get(`${asset.symbol}_${tier}`);
    const completedLevel = getCompletedLevel(ledger, asset.symbol);
    return { ...asset, signalLevel: level, completedLevel, decision, isActionable: !!decision };
  }), [assets, ledger, decisionMap]);
  const sortedAssets = useMemo(() => [...enhancedAssets].sort((a, b) => {
    if (a.isActionable !== b.isActionable) return a.isActionable ? -1 : 1;
    if ((a.signalLevel || 0) !== (b.signalLevel || 0)) return (b.signalLevel || 0) - (a.signalLevel || 0);
    return Math.abs(Number(b.discount || 0)) - Math.abs(Number(a.discount || 0));
  }), [enhancedAssets]);
  const actionList = sortedAssets.filter((a) => a.isActionable);
  const watchList = sortedAssets.filter((a) => !a.isActionable);
  const totalAmount = decisions.reduce((s, d) => s + Number(d.amount || 0), 0);
  const walletSummary = summarizeHoldings(wallet?.holdings);

  return <main className="page">
    <section className="hero compactHero" style={{ textAlign: "center", padding: "18px 12px 10px", background: "linear-gradient(135deg, rgba(10,14,39,.96), rgba(3,7,18,.96))" }}>
      <div style={{ textAlign: "right", color: "rgba(243,186,47,.75)", fontSize: 10, fontWeight: 900 }}>V16-M</div>
      <h1 style={{ fontSize: "clamp(48px, 14vw, 78px)", fontWeight: 1000, margin: "6px 0", lineHeight: .95, background: "linear-gradient(180deg, #fff6b7, #ffd700, #b8860b)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>美股DCA<br />折價追蹤</h1>
      <h2 style={{ fontSize: 14, margin: 0, color: "rgba(248,250,252,.68)", fontWeight: 750 }}>Binance xStocks｜Ledger 決策版</h2>
      {error && <div className="dataGuard">{error}</div>}
    </section>
    <DecisionSection decisions={decisions} totalAmount={totalAmount} updatedAt={updatedAt} loading={loading} />
    <WalletSection walletSummary={walletSummary} onSync={syncWallet} />
    {actionList.length > 0 && <section className="list"><h3 style={{ color: "#f8fafc", margin: "0 0 10px" }}>🔥 可執行買點</h3>{actionList.map((a) => <AssetCard key={a.symbol} asset={a} ledger={ledger} />)}</section>}
    <details className="idleGroup" style={{ marginTop: 16 }}><summary>📋 觀察區（{watchList.length}）</summary><section className="list" style={{ marginTop: 12 }}>{watchList.map((a) => <AssetCard key={a.symbol} asset={a} ledger={ledger} />)}</section></details>
    <Footer source={source} wallet={wallet} />
  </main>;
}

function DecisionSection({ decisions, totalAmount, updatedAt, loading }) {
  return <section style={{ margin: "12px 0", padding: 14, background: "linear-gradient(135deg, rgba(30,41,59,.92), rgba(15,23,42,.96))", borderRadius: 16, border: decisions.length > 0 ? "2px solid #f59e0b" : "1px solid rgba(243,186,47,.22)" }}>
    <div className="liveLine" style={{ fontSize: 12, textAlign: "right", marginBottom: 6, fontWeight: 850 }}><span className={loading ? "liveDot loading" : "liveDot"} /><span className="liveText">{loading ? "更新中" : "LIVE"}</span>｜{formatTime(updatedAt)}</div>
    <h2 style={{ fontSize: 20, fontWeight: 950, color: "#f59e0b", margin: "0 0 10px" }}>今日決策</h2>
    {decisions.length ? <><div style={{ display: "grid", gap: 8, color: "#e2e8f0", fontSize: 16, fontWeight: 900, marginBottom: 12 }}><div>可執行買點：{decisions.length}筆</div><div>建議投入：<span style={{ color: "#22c55e", fontWeight: 950 }}>{money(totalAmount)}</span></div></div><div style={{ display: "grid", gap: 8 }}>{decisions.map((d) => <div key={`${d.symbol}_${d.tier}`} style={{ padding: "10px 12px", background: "#0f172a", borderRadius: 10, fontWeight: 900, color: "#f8fafc" }}>{ruleColors[(d.level || 1) - 1]} {d.symbol} {d.tier}（{money(d.amount)}）｜未登帳</div>)}</div></> : <div style={{ textAlign: "center", padding: "8px 0 12px", color: "#94a3b8", fontWeight: 900 }}>暫無未登帳買點</div>}
  </section>;
}
function WalletSection({ walletSummary, onSync }) {
  return <section style={{ margin: "12px 0 16px", padding: 12, background: "#020617", borderRadius: 16, border: "1px solid rgba(34,197,94,.75)" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}><h2 style={{ fontSize: 19, fontWeight: 950, color: "#4ade80", margin: 0 }}>鏈上持倉</h2><button onClick={onSync} style={{ padding: "8px 11px", borderRadius: 10, border: 0, background: "#2563eb", color: "white", fontWeight: 950 }}>重新同步</button></div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}><Metric label="持倉成本" value={`$${walletSummary.totalCost.toFixed(2)}`} /><Metric label="持倉市值" value={`$${walletSummary.marketValue.toFixed(2)}`} /><Metric label="未實現損益" value={signedUsd(walletSummary.pnl)} signed={walletSummary.pnl} /><Metric label="報酬率" value={signedPct(walletSummary.pnlPct)} signed={walletSummary.pnlPct} /></div></section>;
}
function Metric({ label, value, signed }) { return <div style={{ padding: 10, background: "#0f172a", borderRadius: 12 }}><span style={{ color: "#94a3b8", fontWeight: 900, fontSize: 12 }}>{label}</span><strong style={{ display: "block", color: signed === undefined ? "#f8fafc" : signedColor(signed), marginTop: 4, fontSize: 16 }}>{value}</strong></div>; }
function ProgressBar({ progress }) { const p = Math.min(99, Math.max(0, Number(progress.displayProgress || 0))); return <div><div style={{ fontWeight: 900, color: "#e2e8f0", marginBottom: 8 }}>{progress.stageText}</div><div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 8 }}><span style={{ fontSize: 13, fontWeight: 900, color: "#cbd5e1" }}>{progress.fromText}</span><div style={{ height: 10, width: "100%", background: "rgba(148,163,184,.22)", borderRadius: 999, overflow: "hidden" }}><div style={{ width: `${p}%`, height: "100%", background: "#22c55e", borderRadius: 999 }} /></div><span style={{ fontSize: 13, fontWeight: 900, color: "#cbd5e1" }}>{progress.toText}</span></div><div style={{ marginTop: 8, textAlign: "center", fontWeight: 950, color: "#e2e8f0" }}>{p}%</div></div>; }
function AssetCard({ asset, ledger }) {
  const progress = getProgress(asset);
  const level = asset.signalLevel || 0;
  const rows = (asset.rules || []).map((rule, i) => ({ level: `D${i + 1}`, rule, amount: asset.amounts?.[i] || 0 }));
  return <article className={`card level-${level || 0}`}><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><div><div style={{ fontSize: 21, fontWeight: 1000 }}>{asset.symbol}</div><div style={{ color: "#94a3b8", fontWeight: 850 }}>{asset.name}</div></div><strong>{asset.grade}</strong></div><div className="miniGrid" style={{ marginTop: 10 }}><Metric label="價格" value={`$${Number(asset.price || 0).toFixed(4)}`} /><Metric label="高點" value={`$${Number(asset.high || 0).toFixed(2)}`} /><Metric label="跌幅" value={pct(asset.discount)} signed={Number(asset.discount || 0)} /><Metric label="已完成" value={getLedgerText(ledger, asset.symbol)} /></div><div style={{ marginTop: 10, color: "#cbd5e1", fontWeight: 850 }}>{asset.isActionable ? `✅ ${asset.decision?.tier} 未登帳，可手動買入 ${money(asset.decision?.amount)}` : getLedgerText(ledger, asset.symbol)}</div><div style={{ marginTop: 10 }}><ProgressBar progress={progress} /></div><details style={{ marginTop: 10 }}><summary>層級規則</summary>{rows.map((r) => <div key={r.level} style={{ color: "#cbd5e1", fontWeight: 850 }}>{r.level}：{pct(r.rule)}｜{money(r.amount)}</div>)}</details></article>;
}
function Footer({ source, wallet }) { return <footer style={{ marginTop: 18, padding: 12, background: "#020617", borderRadius: 14, color: "#94a3b8", fontSize: 12, fontWeight: 850 }}>Market：{source || "--"}｜Wallet：{wallet ? "LIVE" : "等待同步"}｜V16-M Ledger Safe</footer>; }
