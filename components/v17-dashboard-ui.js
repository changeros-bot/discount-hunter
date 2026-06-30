const TIER_ICON = { D1: "🟢", D2: "🟡", D3: "🟠", D4: "🔴", D0: "⚪" };

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

export function Metric({ label, value }) {
  return <div style={{ padding: 10, borderRadius: 12, background: "#020617", border: "1px solid rgba(148,163,184,.14)" }}>
    <div style={{ color: "#94a3b8", fontWeight: 850, fontSize: 12 }}>{label}</div>
    <strong style={{ display: "block", marginTop: 4, fontSize: 16 }}>{value}</strong>
  </div>;
}

export function LayerRules({ rules = [], amounts = [], activeTier }) {
  return <details open style={{ marginTop: 10 }}>
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

export function AssetCard({ row, children }) {
  return <article style={{ padding: 14, borderRadius: 16, background: "linear-gradient(135deg, #0f172a, #020617)", border: "1px solid rgba(148,163,184,.22)", color: "#f8fafc" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 1000 }}>{TIER_ICON[row.tier] || "⚪"} {row.symbol} {row.tier}</div>
        <div style={{ color: "#94a3b8", fontWeight: 800, fontSize: 12 }}>{row.name || "--"}</div>
      </div>
      <strong style={{ color: Number(row.discount || 0) < 0 ? "#fca5a5" : "#cbd5e1" }}>{fmtPct(row.discount)}</strong>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
      <Metric label="現價" value={fmtUsd(row.price, 4)} />
      <Metric label="高點" value={fmtUsd(row.high || row.cycleHigh, 2)} />
    </div>
    <LayerRules rules={row.rules || []} amounts={row.amounts || []} activeTier={row.tier} />
    {children}
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
      <div style={{ textAlign: "right", color: "rgba(250,204,21,.8)", fontSize: 11, fontWeight: 1000 }}>V17</div>
      <h1 style={{ margin: "6px 0", fontSize: "clamp(48px, 14vw, 78px)", lineHeight: .95, fontWeight: 1000, color: "#facc15" }}>美股DCA<br />折價追蹤</h1>
      <div style={{ color: "rgba(248,250,252,.68)", fontWeight: 850 }}>V17 State Machine｜{loading ? "更新中" : "LIVE"}｜{timeText(updatedAt)}</div>
      {error && <div style={{ marginTop: 10, padding: 10, borderRadius: 12, color: "#fecaca", background: "rgba(127,29,29,.35)", fontWeight: 900 }}>{error}</div>}
    </header>
    {children}
  </main>;
}
