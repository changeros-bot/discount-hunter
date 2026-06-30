const TIER_ICON = { D1: "🟢", D2: "🟡", D3: "🟠", D4: "🔴", D0: "⚪" };
const TIER_TONE = {
  D0: { color: "#cbd5e1", bg: "rgba(148,163,184,.12)", border: "rgba(148,163,184,.35)" },
  D1: { color: "#86efac", bg: "rgba(34,197,94,.16)", border: "rgba(34,197,94,.48)" },
  D2: { color: "#fde68a", bg: "rgba(250,204,21,.16)", border: "rgba(250,204,21,.50)" },
  D3: { color: "#fdba74", bg: "rgba(249,115,22,.16)", border: "rgba(249,115,22,.50)" },
  D4: { color: "#fca5a5", bg: "rgba(239,68,68,.16)", border: "rgba(239,68,68,.50)" }
};

export function fmtPct(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(1)}%` : "--";
}

export function fmtUsd(value, digits = 2) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? `$${n.toFixed(digits)}` : "--";
}

export function fmtAmount(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? `${n.toFixed(2).replace(".00", "")}U` : "--";
}

export function timeText(iso) {
  if (!iso) return "讀取中";
  const date = new Date(iso);
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
}

export function Metric({ label, value, signed }) {
  const hasSigned = signed !== undefined;
  const color = !hasSigned ? "#f8fafc" : Number(signed) > 0 ? "#22c55e" : Number(signed) < 0 ? "#fca5a5" : "#f8fafc";
  return <div style={{ padding: 10, borderRadius: 12, background: "#020617", border: "1px solid rgba(148,163,184,.14)" }}>
    <div style={{ color: "#94a3b8", fontWeight: 850, fontSize: 12 }}>{label}</div>
    <strong style={{ display: "block", marginTop: 4, fontSize: 16, color }}>{value}</strong>
  </div>;
}

function absDepth(value) {
  return Math.abs(Number(value || 0));
}

function currentDiscountDepth(row) {
  const raw = Number(row?.discountRaw);
  if (Number.isFinite(raw)) return Math.abs(raw);
  return absDepth(row?.discount);
}

function nextTierProgress(row) {
  const depths = (row?.rules || []).map(absDepth);
  const level = Math.max(1, Number(row?.signalLevel || 0));
  const current = currentDiscountDepth(row);
  const from = depths[level - 1] ?? 0;
  const to = depths[level] ?? depths[depths.length - 1] ?? from;
  const span = Math.max(0.000001, to - from);
  const pct = Math.max(0, Math.min(100, ((current - from) / span) * 100));
  return { fromTier: `D${level}`, toTier: depths[level] ? `D${level + 1}` : "MAX", pct };
}

export function TierProgress({ row }) {
  if (!row || Number(row.signalLevel || 0) <= 0) return null;
  const p = nextTierProgress(row);
  return <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: "rgba(15,23,42,.86)", border: "1px solid rgba(148,163,184,.14)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", color: "#cbd5e1", fontWeight: 950, fontSize: 12 }}>
      <span>{p.fromTier}</span><span>{p.toTier}</span>
    </div>
    <div style={{ position: "relative", marginTop: 8, height: 9, borderRadius: 999, background: "rgba(148,163,184,.18)" }}>
      <div style={{ width: `${p.pct}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg, #22c55e, #facc15)" }} />
      <span style={{ position: "absolute", left: `calc(${p.pct}% - 5px)`, top: -3, width: 15, height: 15, borderRadius: 999, background: "#facc15", boxShadow: "0 0 12px rgba(250,204,21,.85)" }} />
    </div>
    <div style={{ marginTop: 6, color: "#fde68a", fontSize: 12, fontWeight: 1000, textAlign: "left" }}>{Math.round(p.pct)}%</div>
  </div>;
}

export function LayerRules({ rules = [], amounts = [], activeTier }) {
  return <details style={{ marginTop: 10 }}>
    <summary style={{ fontWeight: 900, color: "#e2e8f0" }}>層級規則</summary>
    <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
      {(rules || []).map((rule, index) => {
        const tier = `D${index + 1}`;
        const active = tier === activeTier;
        return <div key={tier} style={{ display: "grid", gridTemplateColumns: "52px 1fr 64px", gap: 8, padding: "8px 10px", borderRadius: 10, background: active ? "rgba(245,158,11,.18)" : "rgba(15,23,42,.92)", border: active ? "1px solid rgba(245,158,11,.65)" : "1px solid rgba(148,163,184,.15)", color: active ? "#fde68a" : "#cbd5e1", fontWeight: 900 }}>
          <span>{active ? "▶ " : ""}{tier}</span>
          <span>{fmtPct(rule)}</span>
          <span style={{ textAlign: "right" }}>{fmtAmount(amounts?.[index] || 0)}</span>
        </div>;
      })}
    </div>
  </details>;
}

export function HoldingMetrics({ holding, row }) {
  const pnl = Number(holding?.currentValue || 0) - Number(holding?.totalCost || 0);
  const pnlPct = Number(holding?.totalCost || 0) > 0 ? pnl / Number(holding?.totalCost || 0) : 0;
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
    {holding && <Metric label="數量" value={Number(holding.quantity || 0).toFixed(4)} />}
    {holding && <Metric label="成本" value={fmtUsd(holding.totalCost, 2)} />}
    {holding && <Metric label="市值" value={fmtUsd(holding.currentValue, 2)} />}
    {holding && <Metric label="損益" value={`${pnl >= 0 ? "+" : "-"}${fmtUsd(Math.abs(pnl), 2)}`} signed={pnl} />}
    {holding && <Metric label="報酬率" value={`${pnlPct >= 0 ? "+" : ""}${(pnlPct * 100).toFixed(2)}%`} signed={pnlPct} />}
    <Metric label="距52週高點降幅" value={fmtPct(row?.discount)} signed={row?.discount} />
  </div>;
}

export function AssetCard({ row, children }) {
  const tone = TIER_TONE[row.tier] || TIER_TONE.D0;
  return <article style={{ position: "relative", overflow: "hidden", padding: 14, borderRadius: 16, background: "radial-gradient(circle at 0% 0%, rgba(250,204,21,.30), rgba(34,197,94,.10) 22%, transparent 43%), linear-gradient(135deg, #0f172a, #020617)", border: "1px solid rgba(148,163,184,.22)", color: "#f8fafc" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, position: "relative" }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 1000 }}>{TIER_ICON[row.tier] || "⚪"} {row.symbol}</div>
        <div style={{ color: "#94a3b8", fontWeight: 800, fontSize: 12 }}>{row.name || "--"}</div>
      </div>
      <strong style={{ alignSelf: "flex-start", padding: "5px 10px", borderRadius: 999, background: tone.bg, border: `1px solid ${tone.border}`, color: tone.color, fontSize: 15 }}>{row.tier}</strong>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
      <Metric label="現價" value={fmtUsd(row.price, 4)} />
      <Metric label="高點" value={fmtUsd(row.high || row.cycleHigh, 2)} />
    </div>
    {children}
    <TierProgress row={row} />
    <LayerRules rules={row.rules || []} amounts={row.amounts || []} activeTier={row.tier} />
  </article>;
}

export function Section({ title, count, rows, empty, render }) {
  return <section style={{ marginTop: 14, padding: 12, borderRadius: 18, background: "rgba(2,6,23,.9)", border: "1px solid rgba(250,204,21,.18)" }}>
    <h2 style={{ margin: "0 0 10px", fontSize: 20, color: "#facc15", fontWeight: 1000 }}>{title}（{count}）</h2>
    {rows.length ? <div style={{ display: "grid", gap: 12 }}>{rows.map(render)}</div> : <div style={{ padding: "26px 0", textAlign: "center", color: "#94a3b8", fontWeight: 900 }}>{empty}</div>}
  </section>;
}

export function PageShell({ loading, updatedAt, error, children }) {
  return <main style={{ minHeight: "100vh", padding: 14, background: "#020617", color: "#f8fafc", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" }}>
    <header style={{ padding: "18px 12px 14px", textAlign: "center", borderRadius: 22, background: "linear-gradient(135deg, rgba(10,14,39,.96), rgba(3,7,18,.96))", border: "1px solid rgba(250,204,21,.18)" }}>
      <div style={{ textAlign: "right", color: "rgba(250,204,21,.8)", fontSize: 11, fontWeight: 1000 }}>V17-M</div>
      <h1 style={{ margin: "6px 0", fontSize: "clamp(48px, 14vw, 78px)", lineHeight: .95, fontWeight: 1000, background: "linear-gradient(180deg, #fff6b7, #ffd700, #b8860b)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>美股DCA<br />折價追蹤</h1>
      <div style={{ color: "rgba(248,250,252,.68)", fontWeight: 850 }}>Binance xStocks｜Ledger 決策版</div>
      {error && <div style={{ marginTop: 10, padding: 10, borderRadius: 12, color: "#fecaca", background: "rgba(127,29,29,.35)", fontWeight: 900 }}>{error}</div>}
    </header>
    <div style={{ margin: "12px 0", textAlign: "right", color: "#cbd5e1", fontWeight: 850, fontSize: 12 }}><span style={{ color: loading ? "#facc15" : "#22c55e" }}>●</span> {loading ? "更新中" : "LIVE"}｜{timeText(updatedAt)}</div>
    {children}
  </main>;
}
