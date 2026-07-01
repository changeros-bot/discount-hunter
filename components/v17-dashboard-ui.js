const TIER_ICON = { D1: "D1", D2: "D2", D3: "D3", D4: "D4", D0: "D0" };
const TIER_TONE = {
  D0: { color: "#94a3b8", bg: "rgba(148,163,184,.10)", border: "rgba(148,163,184,.30)" },
  D1: { color: "#35f59a", bg: "rgba(53,245,154,.12)", border: "rgba(53,245,154,.45)" },
  D2: { color: "#ffc857", bg: "rgba(255,200,87,.12)", border: "rgba(255,200,87,.45)" },
  D3: { color: "#ff9f43", bg: "rgba(255,159,67,.12)", border: "rgba(255,159,67,.45)" },
  D4: { color: "#ff5c7a", bg: "rgba(255,92,122,.12)", border: "rgba(255,92,122,.45)" }
};
const CYAN = "#31e7ff";

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
  const color = !hasSigned ? "#f8fafc" : Number(signed) > 0 ? "#35f59a" : Number(signed) < 0 ? "#ff5c7a" : "#f8fafc";
  return <div style={{ padding: 11, borderRadius: 16, background: "linear-gradient(180deg, rgba(8,18,35,.92), rgba(5,11,24,.78))", border: "1px solid rgba(49,231,255,.13)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.04)" }}>
    <div style={{ color: "#7dd3fc", fontWeight: 900, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase" }}>{label}</div>
    <strong style={{ display: "block", marginTop: 5, fontSize: 17, color, textShadow: hasSigned ? `0 0 12px ${color}44` : "none" }}>{value}</strong>
  </div>;
}

function absDepth(value) { return Math.abs(Number(value || 0)); }
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
  return <div style={{ marginTop: 10, padding: 11, borderRadius: 16, background: "rgba(8,18,35,.72)", border: "1px solid rgba(49,231,255,.16)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.04)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", color: "#cbd5e1", fontWeight: 950, fontSize: 11, letterSpacing: 1 }}>
      <span>{p.fromTier}</span><span>{p.toTier}</span>
    </div>
    <div style={{ position: "relative", marginTop: 9, height: 10, borderRadius: 999, background: "linear-gradient(90deg, rgba(53,245,154,.20), rgba(49,231,255,.13), rgba(255,200,87,.15))" }}>
      <div style={{ width: `${p.pct}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg, #35f59a, #31e7ff, #ffc857)", boxShadow: "0 0 14px rgba(49,231,255,.34)" }} />
      <span style={{ position: "absolute", left: `calc(${p.pct}% - 6px)`, top: -4, width: 18, height: 18, borderRadius: 999, background: "#31e7ff", border: "2px solid rgba(255,255,255,.55)", boxShadow: "0 0 18px rgba(49,231,255,.75)" }} />
    </div>
    <div style={{ marginTop: 7, color: CYAN, fontSize: 12, fontWeight: 1000, textAlign: "left", letterSpacing: 1 }}>{Math.round(p.pct)}%</div>
  </div>;
}

export function LayerRules({ rules = [], amounts = [], activeTier }) {
  return <details style={{ marginTop: 10 }}>
    <summary style={{ fontWeight: 950, color: "#dbeafe", letterSpacing: .5 }}>層級規則</summary>
    <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
      {(rules || []).map((rule, index) => {
        const tier = `D${index + 1}`;
        const active = tier === activeTier;
        return <div key={tier} style={{ display: "grid", gridTemplateColumns: "52px 1fr 64px", gap: 8, padding: "8px 10px", borderRadius: 12, background: active ? "rgba(49,231,255,.10)" : "rgba(8,18,35,.78)", border: active ? "1px solid rgba(49,231,255,.42)" : "1px solid rgba(49,231,255,.10)", color: active ? "#e0fbff" : "#cbd5e1", fontWeight: 900 }}>
          <span>{active ? "▸ " : ""}{tier}</span><span>{fmtPct(rule)}</span><span style={{ textAlign: "right" }}>{fmtAmount(amounts?.[index] || 0)}</span>
        </div>;
      })}
    </div>
  </details>;
}

export function CardMetrics({ row }) {
  const holding = row?.walletHolding;
  const pnl = Number(holding?.currentValue || 0) - Number(holding?.totalCost || 0);
  const pnlPct = Number(holding?.totalCost || 0) > 0 ? pnl / Number(holding?.totalCost || 0) : 0;
  const dash = "—";
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
    <Metric label="price" value={fmtUsd(row.price, 4)} />
    <Metric label="52w high" value={fmtUsd(row.high || row.cycleHigh, 2)} />
    <Metric label="qty" value={holding ? Number(holding.quantity || 0).toFixed(4) : dash} />
    <Metric label="cost" value={holding ? fmtUsd(holding.totalCost, 2) : dash} />
    <Metric label="value" value={holding ? fmtUsd(holding.currentValue, 2) : dash} />
    <Metric label="pnl" value={holding ? `${pnl >= 0 ? "+" : "-"}${fmtUsd(Math.abs(pnl), 2)}` : dash} signed={holding ? pnl : undefined} />
    <Metric label="return" value={holding ? `${pnlPct >= 0 ? "+" : ""}${(pnlPct * 100).toFixed(2)}%` : dash} signed={holding ? pnlPct : undefined} />
    <Metric label="drawdown" value={fmtPct(row?.discount)} signed={row?.discount} />
  </div>;
}

export function AssetCard({ row, children }) {
  const tone = TIER_TONE[row.tier] || TIER_TONE.D0;
  return <article style={{ position: "relative", overflow: "hidden", padding: 15, borderRadius: 24, background: "radial-gradient(circle at 0% 0%, rgba(49,231,255,.18), transparent 36%), linear-gradient(135deg, rgba(11,19,36,.88), rgba(5,11,24,.78))", border: "1px solid rgba(49,231,255,.18)", color: "#f8fafc", boxShadow: "0 18px 40px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.05)", backdropFilter: "blur(18px)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, position: "relative" }}>
      <div><div style={{ fontSize: 21, fontWeight: 1000, letterSpacing: .3 }}>{row.symbol}</div><div style={{ color: "#94a3b8", fontWeight: 850, fontSize: 12 }}>{row.name || "--"}</div></div>
      <strong style={{ alignSelf: "flex-start", padding: "6px 11px", borderRadius: 999, background: tone.bg, border: `1px solid ${tone.border}`, color: tone.color, fontSize: 13, boxShadow: `0 0 18px ${tone.border}` }}>{TIER_ICON[row.tier] || row.tier}</strong>
    </div>
    <CardMetrics row={row} />{children}<LayerRules rules={row.rules || []} amounts={row.amounts || []} activeTier={row.tier} />
  </article>;
}

export function Section({ title, count, rows, empty, render }) {
  return <section style={{ marginTop: 16, padding: 13, borderRadius: 24, background: "rgba(5,11,24,.72)", border: "1px solid rgba(49,231,255,.16)", boxShadow: "0 0 32px rgba(49,231,255,.06)", backdropFilter: "blur(18px)" }}>
    <h2 style={{ margin: "0 0 11px", fontSize: 19, color: "#e0fbff", fontWeight: 1000, letterSpacing: .5 }}>{title}（{count}）</h2>
    {rows.length ? <div style={{ display: "grid", gap: 12 }}>{rows.map(render)}</div> : <div style={{ padding: "28px 0", textAlign: "center", color: "#7dd3fc", fontWeight: 950 }}>{empty}</div>}
  </section>;
}

export function PageShell({ loading, updatedAt, error, children }) {
  return <main style={{ minHeight: "100vh", padding: 14, background: "radial-gradient(circle at 12% 0%, rgba(49,231,255,.16), transparent 28%), radial-gradient(circle at 90% 8%, rgba(53,245,154,.10), transparent 24%), linear-gradient(180deg, #050b18, #020617)", color: "#f8fafc", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" }}>
    <header style={{ padding: "20px 14px 16px", textAlign: "center", borderRadius: 28, background: "linear-gradient(135deg, rgba(11,19,36,.84), rgba(5,11,24,.70))", border: "1px solid rgba(49,231,255,.20)", boxShadow: "0 0 42px rgba(49,231,255,.08), inset 0 1px 0 rgba(255,255,255,.06)", backdropFilter: "blur(20px)" }}>
      <div style={{ textAlign: "right", color: CYAN, fontSize: 11, fontWeight: 1000, letterSpacing: 2 }}>V17-M</div>
      <h1 style={{ margin: "8px 0", fontSize: "clamp(48px, 14vw, 80px)", lineHeight: .92, fontWeight: 1000, letterSpacing: -2, background: "linear-gradient(180deg, #f8fdff, #31e7ff, #35f59a)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", textShadow: "0 0 32px rgba(49,231,255,.24)" }}>美股DCA<br />折價追蹤</h1>
      <div style={{ color: "#94a3b8", fontWeight: 900, letterSpacing: 1 }}>BINANCE XSTOCKS｜LEDGER DECISION</div>
      {error && <div style={{ marginTop: 10, padding: 10, borderRadius: 14, color: "#fecaca", background: "rgba(127,29,29,.35)", fontWeight: 900 }}>{error}</div>}
    </header>
    <div style={{ margin: "12px 0", textAlign: "right", color: "#cbd5e1", fontWeight: 900, fontSize: 12, letterSpacing: .8 }}><span style={{ color: loading ? "#ffc857" : "#35f59a", textShadow: `0 0 12px ${loading ? "#ffc857" : "#35f59a"}` }}>●</span> {loading ? "SYNC" : "LIVE"}｜{timeText(updatedAt)}</div>
    {children}
  </main>;
}
