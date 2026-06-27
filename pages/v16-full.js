import { useEffect, useMemo, useState } from "react";

const REFRESH_MS = 5000;
const tierIcon = { D1: "🟢", D2: "🟡", D3: "🟠", D4: "🔴" };

function pct(v) { const n = Number(v); return Number.isFinite(n) ? `${n.toFixed(1)}%` : "--"; }
function money(v) { const n = Number(v); return Number.isFinite(n) ? `${n.toFixed(2).replace(".00", "")}U` : "--"; }
function usd(v) { const n = Number(v || 0); return `$${n.toFixed(2)}`; }
function signedUsd(v) { const n = Number(v || 0); return `${n > 0 ? "+" : n < 0 ? "-" : ""}$${Math.abs(n).toFixed(2)}`; }
function signedPct(v) { const n = Number(v || 0) * 100; return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`; }
function signedColor(v) { const n = Number(v || 0); return n > 0 ? "#22c55e" : n < 0 ? "#ef4444" : "#f8fafc"; }
function signedClass(v) { const n = Number(v || 0); return n > 0 ? "signed-positive" : n < 0 ? "signed-negative" : ""; }
function normalizeSymbol(s) { return String(s || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, ""); }
function stripOnSuffix(symbol) { return normalizeSymbol(symbol).replace(/ON$/, ""); }
function decisionKey(d) { return `${normalizeSymbol(d?.symbol)}_${String(d?.tier || "").toUpperCase()}`; }
function isLiveHolding(h) { return h && Number(h.quantity) > 0 && h.quantitySource === "bsc_rpc_balanceOf_live"; }
function timeText(iso) { if (!iso) return "讀取中"; const d = new Date(iso); return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}:${String(d.getSeconds()).padStart(2,"0")}`; }
function decisionTimeText(iso) { return iso ? timeText(iso) : "本次更新"; }

function dedupeDecisions(items = []) {
  const map = new Map();
  for (const item of items || []) {
    const key = decisionKey(item);
    if (!key || key === "_") continue;
    const previous = map.get(key);
    if (!previous || new Date(item.triggeredAt || 0).getTime() >= new Date(previous.triggeredAt || 0).getTime()) {
      map.set(key, item);
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    if (Number(a.level || 0) !== Number(b.level || 0)) return Number(b.level || 0) - Number(a.level || 0);
    return Math.abs(Number(b.discount || 0)) - Math.abs(Number(a.discount || 0));
  });
}

async function jsonFetch(url, options = {}) {
  const res = await fetch(url, { cache: "no-store", ...options });
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.ok === false) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
  return data;
}

function requireNonEmptyArray(value, label) {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${label}_empty`);
  return value;
}

function ledgerRows(ledger, symbol) {
  if (!ledger || !symbol) return {};
  if (ledger[symbol]) return ledger[symbol];
  const target = normalizeSymbol(symbol);
  const key = Object.keys(ledger).find((k) => normalizeSymbol(k) === target || stripOnSuffix(k) === stripOnSuffix(symbol));
  return key ? ledger[key] : {};
}

function ledgerDoneTiers(ledger, symbol) {
  const rows = ledgerRows(ledger, symbol);
  return [1,2,3,4].filter((i) => Array.isArray(rows[`D${i}`]) && rows[`D${i}`].length).map((i) => `D${i}`);
}

function ledgerHasTier(ledger, symbol, tier) {
  if (!tier) return false;
  const rows = ledgerRows(ledger, symbol);
  return Array.isArray(rows[tier]) && rows[tier].length > 0;
}

function ledgerText(ledger, symbol) {
  const done = ledgerDoneTiers(ledger, symbol);
  return done.length ? `已登帳：${done.join(" / ")}` : "尚未登帳";
}

function walletHoldingMap(holdings) {
  const map = new Map();
  for (const holding of holdings || []) {
    if (!isLiveHolding(holding)) continue;
    const full = normalizeSymbol(holding.symbol);
    const base = stripOnSuffix(holding.symbol);
    if (full) map.set(full, holding);
    if (base) map.set(base, holding);
  }
  return map;
}

function walletOwns(walletMap, symbol) {
  if (!walletMap || !symbol) return false;
  return walletMap.has(normalizeSymbol(symbol)) || walletMap.has(stripOnSuffix(symbol));
}

function progressFor(asset) {
  const rules = (asset.rules || []).map((r) => Math.abs(Number(r))).filter(Number.isFinite);
  const depth = Math.abs(Number(asset.discount || 0));
  const amounts = asset.amounts || [];
  if (!rules.length || !Number.isFinite(depth)) return { label: "資料未就緒", p: 0, from: "0U", to: "0U" };
  if (depth < rules[0]) {
    const p = rules[0] > 0 ? Math.max(0, Math.min(99, (depth / rules[0]) * 100)) : 0;
    return { label: "距離 D1 買點", p: Math.floor(p), from: "0U", to: `${amounts[0] || 0}U` };
  }
  for (let i = 0; i < rules.length - 1; i++) {
    if (depth >= rules[i] && depth < rules[i + 1]) {
      const span = Math.max(0.000001, rules[i + 1] - rules[i]);
      const p = ((depth - rules[i]) / span) * 100;
      return { label: `D${i + 1} → D${i + 2}`, p: Math.max(0, Math.min(99, Math.floor(p))), from: `${amounts[i] || 0}U`, to: `${amounts[i + 1] || 0}U` };
    }
  }
  return { label: `D${rules.length} 已達最深層`, p: 100, from: `${amounts[rules.length - 1] || 0}U`, to: "最深層" };
}

function walletSummary(holdings) {
  const live = (holdings || []).filter(isLiveHolding);
  const cost = live.reduce((s, h) => s + Number(h.totalCost || 0), 0);
  const value = live.reduce((s, h) => s + Number(h.currentValue || 0), 0);
  const pnl = value - cost;
  return { live, cost, value, pnl, pnlPct: cost > 0 ? pnl / cost : 0 };
}

export default function V16FullHome() {
  const [assets, setAssets] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [ledger, setLedger] = useState({});
  const [wallet, setWallet] = useState(null);
  const [updatedAt, setUpdatedAt] = useState("");
  const [source, setSource] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState("");
  const [reconciling, setReconciling] = useState(false);
  const [reconcileMessage, setReconcileMessage] = useState("");

  async function calculateDecisions(rows, currentLedger) {
    const today = await jsonFetch(`/api/today-decisions?t=${Date.now()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assets: rows, ledger: currentLedger })
    });
    setDecisions(dedupeDecisions(today.decisions || []));
    setUpdatedAt(today.updatedAt || "");
    return today;
  }

  async function loadAll() {
    setLoading(true);
    try {
      const prices = await jsonFetch(`/api/prices?t=${Date.now()}`);
      const rows = requireNonEmptyArray(prices.data, "prices_data");
      const ledgerData = await jsonFetch(`/api/buy-ledger?t=${Date.now()}`);
      const currentLedger = ledgerData.ledger || {};
      setAssets(rows);
      setLedger(currentLedger);
      const today = await calculateDecisions(rows, currentLedger);
      setUpdatedAt(prices.updatedAt || today.updatedAt || "");
      setSource(prices.source || "");
      setError("");
    } catch (e) {
      setError(e.message || "讀取失敗");
    } finally {
      setLoading(false);
    }
  }

  async function syncWallet(options = {}) {
    setWalletLoading(true);
    if (options.clearError !== false) setWalletError("");
    try {
      const data = await jsonFetch(`/api/sync-wallet?t=${Date.now()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      requireNonEmptyArray(data.holdings, "wallet_holdings");
      setWallet(data);
      setWalletError("");
      return data;
    } catch (e) {
      setWalletError(e.message || "Wallet 同步失敗");
      if (options.throwOnError) throw e;
      return null;
    } finally {
      setWalletLoading(false);
    }
  }

  async function reconcileLedger() {
    setReconciling(true);
    setReconcileMessage("");
    setError("");
    try {
      const safeAssets = requireNonEmptyArray(assets, "prices_data");
      const currentWallet = wallet || await syncWallet({ throwOnError: true });
      const holdings = requireNonEmptyArray(currentWallet?.holdings, "wallet_holdings");
      const result = await jsonFetch(`/api/reconcile-tiers?t=${Date.now()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assets: safeAssets, holdings })
      });
      const updatedLedger = result.ledger || ledger;
      setLedger(updatedLedger);
      await calculateDecisions(safeAssets, updatedLedger);
      setReconcileMessage(`補登 ${result.addedCount || 0} 筆｜${result.storage || "--"}`);
    } catch (e) {
      setError(e.message || "補登失敗");
    } finally {
      setReconciling(false);
    }
  }

  useEffect(() => {
    loadAll();
    syncWallet({ clearError: false });
    const t = setInterval(loadAll, REFRESH_MS);
    const w = setInterval(() => syncWallet({ clearError: false }), 60000);
    return () => { clearInterval(t); clearInterval(w); };
  }, []);

  const walletMap = useMemo(() => walletHoldingMap(wallet?.holdings), [wallet]);
  const displayDecisions = useMemo(() => dedupeDecisions(decisions).map((d) => ({ ...d, walletOwned: walletOwns(walletMap, d.symbol) })), [decisions, walletMap]);
  const executableDecisions = displayDecisions.filter((d) => !d.walletOwned);
  const boughtPendingDecisions = displayDecisions.filter((d) => d.walletOwned);
  const decisionMap = useMemo(() => new Map(displayDecisions.map((d) => [decisionKey(d), d])), [displayDecisions]);
  const rows = useMemo(() => assets.map((a) => {
    const level = Number(a?.signal?.level || 0);
    const tier = level > 0 ? `D${level}` : "";
    const decision = decisionMap.get(`${normalizeSymbol(a.symbol)}_${tier}`);
    const walletOwned = walletOwns(walletMap, a.symbol);
    const isLedgerDoneForTier = ledgerHasTier(ledger, a.symbol, tier);
    return { ...a, signalLevel: level, tier, decision, walletOwned, isLedgerDoneForTier, isActionable: !!decision && !walletOwned, isLedgerPending: !!decision && walletOwned };
  }).sort((a,b) => {
    if (a.signalLevel !== b.signalLevel) return b.signalLevel - a.signalLevel;
    return Math.abs(Number(b.discount || 0)) - Math.abs(Number(a.discount || 0));
  }), [assets, decisionMap, walletMap, ledger]);

  const completedHoldingRows = rows.filter((r) => r.signalLevel > 0 && r.isLedgerDoneForTier);
  const watchRows = rows.filter((r) => r.signalLevel <= 0);
  const totalAmount = executableDecisions.reduce((s, d) => s + Number(d.amount || 0), 0);
  const ws = walletSummary(wallet?.holdings);

  return <main className="page">
    <section className="hero compactHero" style={{ textAlign: "center", padding: "18px 12px 10px", background: "linear-gradient(135deg, rgba(10,14,39,.96), rgba(3,7,18,.96))" }}>
      <div style={{ textAlign: "right", color: "rgba(243,186,47,.75)", fontSize: 10, fontWeight: 900 }}>V16-M</div>
      <h1 style={{ fontSize: "clamp(48px, 14vw, 78px)", fontWeight: 1000, margin: "6px 0", lineHeight: .95, background: "linear-gradient(180deg, #fff6b7, #ffd700, #b8860b)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>美股DCA<br />折價追蹤</h1>
      <h2 style={{ fontSize: 14, margin: 0, color: "rgba(248,250,252,.68)", fontWeight: 750 }}>Binance xStocks｜Ledger 決策版</h2>
      {error && <div className="dataGuard">{error}</div>}
      {walletError && <div className="dataGuard">Wallet：{walletError}</div>}
      {reconcileMessage && <div className="dataGuard" style={{ color: "#bbf7d0" }}>{reconcileMessage}</div>}
    </section>

    <section style={{ margin: "12px 0", padding: 14, background: "linear-gradient(135deg, rgba(30,41,59,.92), rgba(15,23,42,.96))", borderRadius: 16, border: displayDecisions.length ? "2px solid #f59e0b" : "1px solid rgba(243,186,47,.22)" }}>
      <div className="liveLine" style={{ fontSize: 12, textAlign: "right", marginBottom: 6, fontWeight: 850 }}><span className={loading ? "liveDot loading" : "liveDot"} /><span className="liveText">{loading ? "更新中" : "LIVE"}</span>｜{timeText(updatedAt)}</div>
      <h2 style={{ fontSize: 20, fontWeight: 950, color: "#f59e0b", margin: "0 0 10px" }}>今日決策</h2>
      {displayDecisions.length ? <><div style={{ display: "grid", gap: 8, color: "#e2e8f0", fontSize: 16, fontWeight: 900, marginBottom: 12 }}><div>可手動買入：{executableDecisions.length}筆</div><div>已買入待補登：{boughtPendingDecisions.length}筆</div><div>建議新增投入：<span className="signed-positive" style={{ color: "#22c55e", fontWeight: 950 }}>{money(totalAmount)}</span></div></div><div style={{ display: "grid", gap: 8 }}>{displayDecisions.map((d) => <div key={decisionKey(d)} style={{ padding: "10px 12px", background: "#0f172a", borderRadius: 10, fontWeight: 900, color: d.walletOwned ? "#fde68a" : "#f8fafc" }}><div>{tierIcon[d.tier] || "⚪"} {d.symbol} {d.tier}（{money(d.amount)}）｜買點已達｜{d.walletOwned ? "已買入，Ledger待補登" : "未登帳"}</div><div style={{ marginTop: 4, color: "#94a3b8", fontSize: 12 }}>進買點：{decisionTimeText(d.triggeredAt)}</div></div>)}</div></> : <div style={{ textAlign: "center", padding: "8px 0 12px", color: "#94a3b8", fontWeight: 900 }}>暫無未登帳買點</div>}
    </section>

    <section style={{ margin: "12px 0 16px", padding: 12, background: "#020617", borderRadius: 16, border: "1px solid rgba(34,197,94,.75)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}><h2 style={{ fontSize: 19, fontWeight: 950, color: "#4ade80", margin: 0 }}>鏈上持倉</h2><div style={{ display: "flex", gap: 6 }}><button onClick={reconcileLedger} disabled={reconciling || !assets.length || !wallet?.holdings?.length} style={{ padding: "8px 11px", borderRadius: 10, border: 0, background: reconciling || !assets.length || !wallet?.holdings?.length ? "#475569" : "#16a34a", color: "white", fontWeight: 950 }}>{reconciling ? "補登中" : "補登Ledger"}</button><button onClick={() => syncWallet({ throwOnError: false })} disabled={walletLoading} style={{ padding: "8px 11px", borderRadius: 10, border: 0, background: walletLoading ? "#475569" : "#2563eb", color: "white", fontWeight: 950 }}>{walletLoading ? "同步中" : "重新同步"}</button></div></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}><Metric label="持倉成本" value={usd(ws.cost)} /><Metric label="持倉市值" value={usd(ws.value)} /><Metric label="未實現損益" value={signedUsd(ws.pnl)} signed={ws.pnl} /><Metric label="報酬率" value={signedPct(ws.pnlPct)} signed={ws.pnlPct} /></div>
    </section>

    {completedHoldingRows.length > 0 && <details className="idleGroup" style={{ marginTop: 16 }}><summary>✅ 已登帳持倉區（{completedHoldingRows.length}）</summary><section className="list" style={{ marginTop: 12 }}>{completedHoldingRows.map((a) => <AssetCard key={a.symbol} asset={a} ledger={ledger} />)}</section></details>}
    <details className="idleGroup" style={{ marginTop: 16 }}><summary>📋 觀察區（{watchRows.length}）</summary><section className="list" style={{ marginTop: 12 }}>{watchRows.map((a) => <AssetCard key={a.symbol} asset={a} ledger={ledger} />)}</section></details>
    <details className="idleGroup" style={{ marginTop: 16 }}><summary>📘 Ledger 檢查</summary><pre style={{ whiteSpace: "pre-wrap", overflowX: "auto", color: "#cbd5e1", fontSize: 11 }}>{JSON.stringify(ledger, null, 2)}</pre></details>
    <footer style={{ marginTop: 18, padding: 12, background: "#020617", borderRadius: 14, color: "#94a3b8", fontSize: 12, fontWeight: 850 }}>Market：{source || "--"}｜Wallet：{wallet ? "LIVE" : walletLoading ? "同步中" : "等待同步"}｜V16-M Full Ledger Safe</footer>
  </main>;
}

function Metric({ label, value, signed }) {
  const hasSigned = signed !== undefined;
  return <div style={{ padding: 10, background: "#0f172a", borderRadius: 12 }}><span style={{ color: "#94a3b8", fontWeight: 900, fontSize: 12 }}>{label}</span><strong className={hasSigned ? signedClass(signed) : ""} style={{ display: "block", color: hasSigned ? signedColor(signed) : "#f8fafc", marginTop: 4, fontSize: 16 }}>{value}</strong></div>;
}

function ProgressBar({ progress }) {
  const p = Math.min(100, Math.max(0, Number(progress.p || 0)));
  return <div><div style={{ fontWeight: 900, color: "#e2e8f0", marginBottom: 8 }}>{progress.label}</div><div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 8 }}><span style={{ fontSize: 13, fontWeight: 900, color: "#cbd5e1" }}>{progress.from}</span><div style={{ height: 10, width: "100%", background: "rgba(148,163,184,.22)", borderRadius: 999, overflow: "hidden" }}><div style={{ width: `${p}%`, height: "100%", background: p >= 100 ? "#f59e0b" : "#22c55e", borderRadius: 999 }} /></div><span style={{ fontSize: 13, fontWeight: 900, color: "#cbd5e1" }}>{progress.to}</span></div><div style={{ marginTop: 8, textAlign: "center", fontWeight: 950, color: p >= 100 ? "#f59e0b" : "#e2e8f0" }}>{p}%</div></div>;
}

function AssetCard({ asset, ledger }) {
  const progress = progressFor(asset);
  const rows = (asset.rules || []).map((rule, i) => ({ level: `D${i + 1}`, rule, amount: asset.amounts?.[i] || 0 }));
  const doneText = ledgerText(ledger, asset.symbol);
  const statusText = asset.isLedgerPending ? `⚠️ ${asset.decision?.tier} 已買入，Ledger待補登｜進買點：${decisionTimeText(asset.decision?.triggeredAt)}` : asset.isActionable ? `✅ ${asset.decision?.tier} 未登帳，可手動買入 ${money(asset.decision?.amount)}｜進買點：${decisionTimeText(asset.decision?.triggeredAt)}` : doneText;
  return <article className={`card level-${asset.signalLevel || 0}`}><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><div><div style={{ fontSize: 21, fontWeight: 1000 }}>{asset.symbol}</div><div style={{ color: "#94a3b8", fontWeight: 850 }}>{asset.name}</div></div><strong>{asset.grade}</strong></div><div className="miniGrid" style={{ marginTop: 10 }}><Metric label="價格" value={`$${Number(asset.price || 0).toFixed(4)}`} /><Metric label="高點" value={`$${Number(asset.high || 0).toFixed(2)}`} /><Metric label="跌幅" value={pct(asset.discount)} signed={Number(asset.discount || 0)} /><Metric label="Ledger" value={doneText} /></div><div style={{ marginTop: 10, color: asset.isLedgerPending ? "#fde68a" : asset.isActionable ? "#f8fafc" : "#cbd5e1", fontWeight: 850 }}>{statusText}</div><div style={{ marginTop: 10 }}><ProgressBar progress={progress} /></div><details style={{ marginTop: 10 }}><summary>層級規則</summary>{rows.map((r) => <div key={r.level} style={{ color: "#cbd5e1", fontWeight: 850 }}>{r.level}：{pct(r.rule)}｜{money(r.amount)}</div>)}</details></article>;
}
