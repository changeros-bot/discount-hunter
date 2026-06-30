import { useEffect, useMemo, useState } from "react";
import { classifyUniverse, ledgerDoneTiers, normalizeSymbol } from "../lib/v17-state-classifier";

const REFRESH_MS = 5000;
const tierIcon = { D1: "🟢", D2: "🟡", D3: "🟠", D4: "🔴" };

function pct(v) {
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toFixed(1)}%` : "--";
}

function money(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? `${n.toFixed(2).replace(".00", "")}U` : "--";
}

function usd(v) {
  const n = Number(v || 0);
  return `$${n.toFixed(2)}`;
}

function signedUsd(v) {
  const n = Number(v || 0);
  return `${n > 0 ? "+" : n < 0 ? "-" : ""}$${Math.abs(n).toFixed(2)}`;
}

function signedPct(v) {
  const n = Number(v || 0) * 100;
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function signedColor(v) {
  const n = Number(v || 0);
  return n > 0 ? "#22c55e" : n < 0 ? "#ef4444" : "#f8fafc";
}

function timeText(iso) {
  if (!iso) return "讀取中";
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

function decisionKey(d) {
  return d?.key || `${normalizeSymbol(d?.symbol)}_${String(d?.tier || "").toUpperCase()}`;
}

function dedupeDecisions(items = []) {
  const map = new Map();
  for (const item of items || []) {
    const key = decisionKey(item);
    if (!key || key === "_") continue;
    map.set(key, item);
  }
  return Array.from(map.values()).sort((a, b) => {
    if (Number(a.level || 0) !== Number(b.level || 0)) return Number(b.level || 0) - Number(a.level || 0);
    return Math.abs(Number(b.discount || 0)) - Math.abs(Number(a.discount || 0));
  });
}

function marketMapFromRows(rows = []) {
  return Object.fromEntries((rows || []).map((row) => [row.symbol, {
    symbol: row.symbol,
    price: row.price,
    high: row.high,
    high52w: row.high52w,
    cycleHigh: row.high || row.cycleHigh || row.high52w,
    discount: row.discount
  }]));
}

async function jsonFetch(url, options = {}) {
  const res = await fetch(url, { cache: "no-store", ...options });
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.ok === false) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
  return data;
}

function requireRows(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label}_not_array`);
  return value;
}

function walletSummary(holdings = []) {
  const live = (holdings || []).filter((h) => Number(h.quantity) > 0);
  const cost = live.reduce((s, h) => s + Number(h.totalCost || 0), 0);
  const value = live.reduce((s, h) => s + Number(h.currentValue || 0), 0);
  const pnl = value - cost;
  return { live, cost, value, pnl, pnlPct: cost > 0 ? pnl / cost : 0 };
}

function progressFor(asset) {
  const rules = (asset.rules || []).map((r) => Math.abs(Number(r))).filter(Number.isFinite);
  const depth = Math.abs(Number(asset.discount || 0));
  const amounts = asset.amounts || [];
  if (!rules.length || !Number.isFinite(depth)) return { label: "資料未就緒", p: 0, from: "0U", to: "0U" };
  if (depth < rules[0]) return { label: "D0｜距離 D1", p: Math.floor(Math.max(0, Math.min(99, (depth / rules[0]) * 100))), from: "0U", to: `${amounts[0] || 0}U` };
  for (let i = 0; i < rules.length - 1; i++) {
    if (depth >= rules[i] && depth < rules[i + 1]) {
      const span = Math.max(0.000001, rules[i + 1] - rules[i]);
      return { label: `D${i + 1} → D${i + 2}`, p: Math.max(0, Math.min(99, Math.floor(((depth - rules[i]) / span) * 100))), from: `${amounts[i] || 0}U`, to: `${amounts[i + 1] || 0}U` };
    }
  }
  return { label: `D${rules.length} 已達最深層`, p: 100, from: `${amounts[rules.length - 1] || 0}U`, to: "最深層" };
}

export default function V16FullHome() {
  const [assets, setAssets] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [decisionSummary, setDecisionSummary] = useState({ actionCount: 0, totalAmount: 0 });
  const [ledger, setLedger] = useState({});
  const [wallet, setWallet] = useState(null);
  const [updatedAt, setUpdatedAt] = useState("");
  const [marketSource, setMarketSource] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [skipLoadingKey, setSkipLoadingKey] = useState("");

  async function calculateDecisions(rows) {
    const today = await jsonFetch(`/api/v17/ui-decisions?t=${Date.now()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markets: marketMapFromRows(rows), persistState: true })
    });
    const cards = dedupeDecisions(today.cards || []);
    setDecisions(cards);
    setDecisionSummary(today.summary || { actionCount: cards.length, totalAmount: 0 });
    return cards;
  }

  async function syncWallet() {
    setWalletLoading(true);
    try {
      const data = await jsonFetch(`/api/sync-wallet?t=${Date.now()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      setWallet(data);
      return data;
    } catch (e) {
      setError(e.message || "Wallet 同步失敗");
      return null;
    } finally {
      setWalletLoading(false);
    }
  }

  async function loadAll() {
    setLoading(true);
    try {
      const prices = await jsonFetch(`/api/prices?t=${Date.now()}`);
      const rows = requireRows(prices.data || [], "prices_data");
      const ledgerData = await jsonFetch(`/api/buy-ledger?t=${Date.now()}`);
      setAssets(rows);
      setLedger(ledgerData.ledger || {});
      await calculateDecisions(rows);
      setUpdatedAt(prices.updatedAt || new Date().toISOString());
      setMarketSource(prices.source || "Binance xStocks");
      setError("");
    } catch (e) {
      setError(e.message || "讀取失敗");
    } finally {
      setLoading(false);
    }
  }

  async function skipLayer(decision) {
    const key = decisionKey(decision);
    setSkipLoadingKey(key);
    setError("");
    try {
      await jsonFetch(`/api/v17/events?t=${Date.now()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: {
            id: `${normalizeSymbol(decision.symbol)}-${decision.tier}-skip-${Date.now()}`,
            symbol: decision.symbol,
            type: "skip_layer",
            status: "skipped",
            layer: Number(decision.level || String(decision.tier || "").replace("D", "")),
            price: decision.price,
            amount: 0,
            source: "ui_skip_layer",
            time: new Date().toISOString(),
            raw: { button: "略過本層", rule: "Skip current layer only. No ledger write." }
          }
        })
      });
      await calculateDecisions(assets);
      setToast(`${decision.symbol} ${decision.tier} 已略過本層`);
      setTimeout(() => setToast(""), 5000);
    } catch (e) {
      setError(e.message || "略過本層失敗");
    } finally {
      setSkipLoadingKey("");
    }
  }

  useEffect(() => {
    loadAll();
    syncWallet();
    const t = setInterval(loadAll, REFRESH_MS);
    const w = setInterval(syncWallet, 60000);
    return () => { clearInterval(t); clearInterval(w); };
  }, []);

  const classified = useMemo(() => classifyUniverse({
    assets,
    ledger,
    holdings: wallet?.holdings || [],
    decisions
  }), [assets, ledger, wallet, decisions]);

  const decisionRows = classified.decisionRows;
  const holdingRows = classified.holdingRows.sort((a, b) => b.signalLevel - a.signalLevel || Math.abs(Number(b.discount || 0)) - Math.abs(Number(a.discount || 0)));
  const watchRows = classified.watchRows.sort((a, b) => Math.abs(Number(b.discount || 0)) - Math.abs(Number(a.discount || 0)));
  const totalAmount = Number(decisionSummary.totalAmount || decisions.reduce((s, d) => s + Number(d.amount || 0), 0));
  const ws = walletSummary(wallet?.holdings || []);

  return <main className="page">
    <section className="hero compactHero" style={{ textAlign: "center", padding: "18px 12px 10px", background: "linear-gradient(135deg, rgba(10,14,39,.96), rgba(3,7,18,.96))" }}>
      <div style={{ textAlign: "right", color: "rgba(243,186,47,.75)", fontSize: 10, fontWeight: 900 }}>V17-Q</div>
      <h1 style={{ fontSize: "clamp(48px, 14vw, 78px)", fontWeight: 1000, margin: "6px 0", lineHeight: .95, background: "linear-gradient(180deg, #fff6b7, #ffd700, #b8860b)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>美股DCA<br />折價追蹤</h1>
      <h2 style={{ fontSize: 14, margin: 0, color: "rgba(248,250,252,.68)", fontWeight: 750 }}>Binance xStocks｜V17 Action Queue</h2>
      {error && <div className="dataGuard">{error}</div>}
      {toast && <div className="dataGuard" style={{ color: "#fde68a" }}>{toast}</div>}
    </section>

    <section style={{ margin: "12px 0", padding: 14, background: "linear-gradient(135deg, rgba(30,41,59,.92), rgba(15,23,42,.96))", borderRadius: 16, border: decisionRows.length ? "2px solid #f59e0b" : "1px solid rgba(243,186,47,.22)" }}>
      <div className="liveLine" style={{ fontSize: 12, textAlign: "right", marginBottom: 6, fontWeight: 850 }}><span className={loading ? "liveDot loading" : "liveDot"} /><span className="liveText">{loading ? "更新中" : "LIVE"}</span>｜{timeText(updatedAt)}</div>
      <h2 style={{ fontSize: 20, fontWeight: 950, color: "#f59e0b", margin: "0 0 10px" }}>今日決策</h2>
      {decisionRows.length ? <>
        <div style={{ display: "grid", gap: 8, color: "#e2e8f0", fontSize: 16, fontWeight: 900, marginBottom: 12 }}>
          <div>待處理：{decisionRows.length}筆</div>
          <div>建議新增投入：<span style={{ color: "#22c55e", fontWeight: 950 }}>{money(totalAmount)}</span></div>
        </div>
        <div style={{ display: "grid", gap: 12 }}>{decisionRows.map((row) => <DecisionCard key={decisionKey(row.decision)} decision={row.decision} asset={row} onSkip={skipLayer} skipLoading={skipLoadingKey === decisionKey(row.decision)} />)}</div>
      </> : <EmptyDecision holdingCount={holdingRows.length} watchCount={watchRows.length} />}
    </section>

    <section style={{ margin: "12px 0 16px", padding: 12, background: "#020617", borderRadius: 16, border: "1px solid rgba(34,197,94,.75)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <h2 style={{ fontSize: 19, fontWeight: 950, color: "#4ade80", margin: 0 }}>鏈上持倉</h2>
        <button onClick={syncWallet} disabled={walletLoading} style={{ padding: "8px 11px", borderRadius: 10, border: 0, background: walletLoading ? "#475569" : "#2563eb", color: "white", fontWeight: 950 }}>{walletLoading ? "同步中" : "重新同步"}</button>
      </div>
      <div style={{ marginTop: 6, color: "#94a3b8", fontSize: 12, fontWeight: 850 }}>最後同步：{timeText(wallet?.lastSyncTime || wallet?.checkedAt)}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
        <Metric label="持倉成本" value={usd(ws.cost)} />
        <Metric label="持倉市值" value={usd(ws.value)} />
        <Metric label="未實現損益" value={signedUsd(ws.pnl)} signed={ws.pnl} />
        <Metric label="報酬率" value={signedPct(ws.pnlPct)} signed={ws.pnlPct} />
      </div>
    </section>

    {holdingRows.length > 0 && <details className="idleGroup" style={{ marginTop: 16 }} open>
      <summary>✅ 持倉中買點區（{holdingRows.length}）</summary>
      <section className="list" style={{ marginTop: 12 }}>{holdingRows.map((a) => <AssetCard key={`holding-${a.symbol}`} asset={a} ledger={ledger} mode="holding" />)}</section>
    </details>}

    <details className="idleGroup" style={{ marginTop: 16 }} open>
      <summary>📋 觀察區 D0（{watchRows.length}）</summary>
      <section className="list" style={{ marginTop: 12 }}>{watchRows.map((a) => <AssetCard key={`watch-${a.symbol}`} asset={a} ledger={ledger} mode="watch" />)}</section>
    </details>

    <footer style={{ marginTop: 18, padding: 12, background: "#020617", borderRadius: 14, color: "#94a3b8", fontSize: 12, fontWeight: 850 }}>
      Market：{marketSource ? "Binance xStocks" : "--"}｜Wallet：{wallet ? "LIVE" : walletLoading ? "同步中" : "等待同步"}｜Engine：V17
    </footer>
  </main>;
}

function EmptyDecision({ holdingCount, watchCount }) {
  return <div style={{ textAlign: "center", padding: "28px 10px 30px", color: "#cbd5e1", fontWeight: 900, fontSize: 16, lineHeight: 1.65 }}>
    <div style={{ fontSize: 19, fontWeight: 1000 }}>暫無待執行買點</div>
    <div style={{ marginTop: 8, color: "#94a3b8", fontSize: 13 }}>目前沒有新的 D1-D4 待處理層。</div>
    <div style={{ marginTop: 4, color: "#94a3b8", fontSize: 13 }}>持倉中買點：{holdingCount}｜D0 觀察：{watchCount}</div>
  </div>;
}

function Metric({ label, value, signed }) {
  const hasSigned = signed !== undefined;
  return <div style={{ padding: 10, background: "#0f172a", borderRadius: 12 }}>
    <span style={{ color: "#94a3b8", fontWeight: 900, fontSize: 12 }}>{label}</span>
    <strong style={{ display: "block", color: hasSigned ? signedColor(signed) : "#f8fafc", marginTop: 4, fontSize: 16 }}>{value}</strong>
  </div>;
}

function LayerRules({ rules = [], amounts = [], activeTier }) {
  return <details style={{ marginTop: 10 }} open>
    <summary style={{ color: "#e2e8f0", fontWeight: 950 }}>層級規則</summary>
    <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
      {(rules || []).map((rule, i) => {
        const tier = `D${i + 1}`;
        const active = tier === activeTier;
        return <div key={tier} style={{ display: "grid", gridTemplateColumns: "48px 1fr 58px", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 10, background: active ? "rgba(245,158,11,.18)" : "rgba(15,23,42,.9)", border: active ? "1px solid rgba(245,158,11,.65)" : "1px solid rgba(148,163,184,.14)", color: active ? "#fde68a" : "#cbd5e1", fontWeight: 950 }}>
          <span>{active ? "▶ " : ""}{tier}</span>
          <span>{pct(rule)}</span>
          <span style={{ textAlign: "right" }}>{money(amounts?.[i] || 0)}</span>
        </div>;
      })}
    </div>
  </details>;
}

function DecisionCard({ decision, asset, onSkip, skipLoading }) {
  const rule = Number(decision?.rule ?? asset?.rules?.[(Number(decision?.level || 1) - 1)]);
  return <article style={{ padding: 14, background: "#0f172a", borderRadius: 14, border: "1px solid rgba(245,158,11,.55)", color: "#f8fafc", fontWeight: 900 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
      <div><div style={{ fontSize: 19, fontWeight: 1000 }}>{tierIcon[decision?.tier] || "⚪"} {decision?.symbol} {decision?.tier}</div><div style={{ marginTop: 4, color: "#94a3b8", fontSize: 12 }}>{decision?.name || asset?.name || "--"}</div></div>
      <strong style={{ color: "#22c55e", fontSize: 20 }}>{decision?.amountText || money(decision?.amount)}</strong>
    </div>
    <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      <Metric label="現價" value={`$${Number(decision?.price || asset?.price || 0).toFixed(4)}`} />
      <Metric label="高點" value={`$${Number(decision?.high || asset?.high || 0).toFixed(2)}`} />
      <Metric label="目前跌幅" value={decision?.discountText || pct(decision?.discount ?? asset?.discount)} signed={Number(decision?.discount ?? asset?.discount || 0)} />
      <Metric label="觸發規則" value={decision?.ruleText || (Number.isFinite(rule) ? pct(rule) : "--")} />
    </div>
    <LayerRules rules={asset?.rules || []} amounts={asset?.amounts || []} activeTier={decision?.tier} />
    <div style={{ marginTop: 10, padding: 10, background: "rgba(15,23,42,.9)", borderRadius: 10, color: "#cbd5e1", fontSize: 13, lineHeight: 1.55 }}>
      <div>狀態：<strong style={{ color: "#fde68a" }}>{decision?.statusLabel || decision?.status}</strong></div>
      <div>原因：{decision?.reason || "V17 Action Queue"}</div>
      {decision?.amountLow && <div style={{ color: "#fde68a" }}>⚠️ 買入金額不足，仍需補足。</div>}
    </div>
    <button onClick={() => onSkip?.(decision)} disabled={skipLoading} style={{ width: "100%", marginTop: 10, padding: "11px 12px", borderRadius: 12, border: "1px solid rgba(245,158,11,.55)", background: skipLoading ? "#475569" : "rgba(245,158,11,.12)", color: "#fde68a", fontWeight: 1000, fontSize: 15 }}>
      {skipLoading ? "略過中..." : "略過本層"}
    </button>
  </article>;
}

function ProgressBar({ progress }) {
  const p = Math.min(100, Math.max(0, Number(progress.p || 0)));
  return <div>
    <div style={{ fontWeight: 900, color: "#e2e8f0", marginBottom: 8 }}>{progress.label}</div>
    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 13, fontWeight: 900, color: "#cbd5e1" }}>{progress.from}</span>
      <div style={{ height: 10, width: "100%", background: "rgba(148,163,184,.22)", borderRadius: 999, overflow: "hidden" }}><div style={{ width: `${p}%`, height: "100%", background: p >= 100 ? "#f59e0b" : "#22c55e", borderRadius: 999 }} /></div>
      <span style={{ fontSize: 13, fontWeight: 900, color: "#cbd5e1" }}>{progress.to}</span>
    </div>
    <div style={{ marginTop: 8, textAlign: "center", fontWeight: 950, color: p >= 100 ? "#f59e0b" : "#e2e8f0" }}>{p}%</div>
  </div>;
}

function AssetCard({ asset, ledger, mode }) {
  const progress = progressFor(asset);
  const done = ledgerDoneTiers(ledger, asset.symbol);
  const statusText = mode === "watch" ? "D0｜未進入買點" : `已買：${done.length ? done.join(" / ") : "鏈上持倉"}`;
  return <article className={`card level-${asset.signalLevel || 0}`}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
      <div><div style={{ fontSize: 21, fontWeight: 1000 }}>{asset.symbol}</div><div style={{ color: "#94a3b8", fontWeight: 850 }}>{asset.name}</div></div>
      <strong>{asset.grade || asset.conviction || ""}</strong>
    </div>
    <div className="miniGrid" style={{ marginTop: 10 }}>
      <Metric label="價格" value={`$${Number(asset.price || 0).toFixed(4)}`} />
      <Metric label="高點" value={`$${Number(asset.high || 0).toFixed(2)}`} />
      <Metric label="跌幅" value={pct(asset.discount)} signed={Number(asset.discount || 0)} />
      <Metric label="區間" value={asset.tier || "D0"} />
    </div>
    <div style={{ marginTop: 10, color: "#cbd5e1", fontWeight: 850 }}>{statusText}</div>
    <div style={{ marginTop: 10 }}><ProgressBar progress={progress} /></div>
    <LayerRules rules={asset.rules || []} amounts={asset.amounts || []} activeTier={mode === "watch" ? "" : asset.tier} />
  </article>;
}
