const cyan = "#31e7ff";
const tones = {
  D0: ["#94a3b8", "rgba(148,163,184,.12)", "rgba(148,163,184,.30)"],
  D1: ["#35f59a", "rgba(53,245,154,.12)", "rgba(53,245,154,.42)"],
  D2: ["#ffc857", "rgba(255,200,87,.12)", "rgba(255,200,87,.42)"],
  D3: ["#ff9f43", "rgba(255,159,67,.12)", "rgba(255,159,67,.42)"],
  D4: ["#ff5c7a", "rgba(255,92,122,.12)", "rgba(255,92,122,.42)"]
};

export function fmtPct(v) { const n = Number(v); return Number.isFinite(n) ? `${n.toFixed(1)}%` : "--"; }
export function fmtUsd(v, d = 2) { const n = Number(v || 0); return Number.isFinite(n) ? `$${n.toFixed(d)}` : "--"; }
export function fmtAmount(v) { const n = Number(v || 0); return Number.isFinite(n) ? `${n.toFixed(2).replace(".00", "")}U` : "--"; }
export function timeText(iso) {
  if (!iso) return "讀取中";
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

function abs(v) { return Math.abs(Number(v || 0)); }
function depth(row) { const raw = Number(row?.discountRaw); return Number.isFinite(raw) ? Math.abs(raw) : abs(row?.discount); }
function progress(row) {
  const rules = (row?.rules || []).map(abs);
  const level = Math.max(0, Number(row?.signalLevel || 0));
  const from = level === 0 ? 0 : rules[level - 1] || 0;
  const to = level === 0 ? rules[0] || 0 : rules[level] || rules[rules.length - 1] || from;
  const pct = Math.max(0, Math.min(100, ((depth(row) - from) / Math.max(.000001, to - from)) * 100));
  return { from: level === 0 ? "D0" : `D${level}`, to: level === 0 ? "D1" : rules[level] ? `D${level + 1}` : "MAX", pct };
}

export function Metric({ label, value, signed }) {
  const color = signed === undefined ? "#f8fafc" : Number(signed) >= 0 ? "#35f59a" : "#ff5c7a";
  return <div style={{ padding: 10, minHeight: 62, minWidth: 0, background: "rgba(3,9,20,.56)", borderRight: "1px solid rgba(49,231,255,.10)", borderBottom: "1px solid rgba(49,231,255,.10)" }}>
    <div style={{ color: "#7dd3fc", fontWeight: 900, fontSize: 10, letterSpacing: .7, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
    <strong style={{ display: "block", marginTop: 5, fontSize: 15, lineHeight: 1.1, color, overflowWrap: "anywhere" }}>{value}</strong>
  </div>;
}

function CardMetrics({ row }) {
  const h = row?.walletHolding;
  const pnl = Number(h?.currentValue || 0) - Number(h?.totalCost || 0);
  const ret = Number(h?.totalCost || 0) > 0 ? pnl / Number(h.totalCost) : 0;
  const dash = "—";
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", overflow: "hidden", borderRadius: 16, border: "1px solid rgba(49,231,255,.14)" }}>
    <Metric label="現價" value={fmtUsd(row.price, 4)} /><Metric label="高點" value={fmtUsd(row.high || row.cycleHigh, 2)} />
    <Metric label="數量" value={h ? Number(h.quantity || 0).toFixed(4) : dash} /><Metric label="成本" value={h ? fmtUsd(h.totalCost, 2) : dash} />
    <Metric label="市值" value={h ? fmtUsd(h.currentValue, 2) : dash} /><Metric label="損益" value={h ? `${pnl >= 0 ? "+" : "-"}${fmtUsd(Math.abs(pnl), 2)}` : dash} signed={h ? pnl : undefined} />
    <Metric label="報酬率" value={h ? `${ret >= 0 ? "+" : ""}${(ret * 100).toFixed(2)}%` : dash} signed={h ? ret : undefined} /><Metric label="距52週高點降幅" value={fmtPct(row?.discount)} signed={row?.discount} />
  </div>;
}

function Status({ row }) {
  const skipped = row.skippedTiers?.includes(row.tier);
  const text = row.decision ? `待處理：${row.tier}` : skipped ? `已略過：${row.tier}` : row.tier === "D0" ? "等待進入 D1" : `已完成：${row.ledgerDoneTiers?.join(" / ") || row.tier}`;
  return <div style={{ marginTop: 10, padding: 10, borderRadius: 16, background: "rgba(3,9,20,.38)", border: "1px solid rgba(49,231,255,.14)", color: row.decision ? "#fde68a" : skipped ? "#cbd5e1" : row.tier === "D0" ? "#93c5fd" : "#bbf7d0", fontWeight: 950 }}>{text}</div>;
}

export function TierProgress({ row }) {
  const p = progress(row);
  return <div style={{ marginTop: 10, padding: 10, borderRadius: 16, background: "rgba(3,9,20,.38)", border: "1px solid rgba(49,231,255,.14)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", color: "#e2e8f0", fontWeight: 950, fontSize: 13 }}><span>{p.from}</span><span>{p.to}</span></div>
    <div style={{ position: "relative", marginTop: 8, height: 8, borderRadius: 999, background: "rgba(49,231,255,.12)" }}>
      <div style={{ width: `${p.pct}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#35f59a,#31e7ff,#ffc857)" }} />
    </div>
    <div style={{ marginTop: 8, color: cyan, fontSize: 12, fontWeight: 1000 }}>{Math.round(p.pct)}%</div>
  </div>;
}

function LayerRules({ rules = [], amounts = [], activeTier }) {
  return <div style={{ marginTop: 10 }}>
    <div style={{ color: cyan, fontWeight: 950, fontSize: 13, marginBottom: 8 }}>層級規則</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>{rules.map((r, i) => {
      const tier = `D${i + 1}`; const active = tier === activeTier;
      return <div key={tier} style={{ padding: "8px 3px", minHeight: 52, borderRadius: 12, textAlign: "center", background: active ? "rgba(49,231,255,.10)" : "rgba(8,18,35,.58)", border: active ? "1px solid rgba(49,231,255,.48)" : "1px solid rgba(148,163,184,.18)", color: active ? cyan : "#94a3b8", fontWeight: 900 }}><div>{tier}</div><div style={{ fontSize: 10 }}>{fmtPct(r).replace(".0", "")}</div><div style={{ fontSize: 10 }}>{fmtAmount(amounts?.[i] || 0)}</div></div>;
    })}</div>
  </div>;
}

export function AssetCard({ row, children }) {
  const [color, bg, border] = tones[row.tier] || tones.D0;
  return <article style={{ padding: 14, borderRadius: 22, background: "radial-gradient(circle at 0 0,rgba(49,231,255,.18),transparent 36%),linear-gradient(135deg,rgba(11,19,36,.88),rgba(5,11,24,.78))", border: "1px solid rgba(49,231,255,.20)", color: "#f8fafc", boxShadow: "0 18px 40px rgba(0,0,0,.35)", backdropFilter: "blur(18px)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start", marginBottom: 10 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}><span style={{ flex: "0 0 auto", width: 15, height: 15, borderRadius: 999, background: "#35f59a", boxShadow: "0 0 16px rgba(53,245,154,.75)" }} /><div style={{ minWidth: 0 }}><div style={{ fontSize: 21, fontWeight: 1000, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.symbol}</div><div style={{ color: "#94a3b8", fontWeight: 850, fontSize: 12 }}>{row.name || "--"}</div></div></div>
      <strong style={{ flex: "0 0 auto", padding: "6px 10px", borderRadius: 999, background: bg, border: `1px solid ${border}`, color, fontSize: 13 }}>{TIER_ICON[row.tier] || row.tier}</strong>
    </div>
    <CardMetrics row={row} /><Status row={row} /><TierProgress row={row} /><LayerRules rules={row.rules || []} amounts={row.amounts || []} activeTier={row.tier} />{children && <div style={{ marginTop: 10 }}>{children}</div>}
  </article>;
}

export function Section({ title, count, rows, empty, render }) {
  return <section style={{ marginTop: 16, padding: 12, borderRadius: 24, background: "rgba(5,11,24,.72)", border: "1px solid rgba(49,231,255,.16)", boxShadow: "0 0 32px rgba(49,231,255,.06)" }}><h2 style={{ margin: "0 0 11px", fontSize: 19, color: "#e0fbff", fontWeight: 1000 }}>{title}（{count}）</h2>{rows.length ? <div style={{ display: "grid", gap: 12 }}>{rows.map(render)}</div> : <div style={{ padding: "28px 0", textAlign: "center", color: "#7dd3fc", fontWeight: 950 }}>{empty}</div>}</section>;
}

export function PageShell({ loading, updatedAt, error, children }) {
  return <main style={{ minHeight: "100vh", padding: 12, background: "radial-gradient(circle at 12% 0%,rgba(49,231,255,.16),transparent 28%),linear-gradient(180deg,#050b18,#020617)", color: "#f8fafc", fontFamily: "system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" }}><header style={{ padding: "20px 14px 16px", textAlign: "left", borderRadius: 28, background: "linear-gradient(135deg,rgba(11,19,36,.84),rgba(5,11,24,.70))", border: "1px solid rgba(49,231,255,.20)" }}><div style={{ textAlign: "right", color: cyan, fontSize: 11, fontWeight: 1000, letterSpacing: 2 }}>V17-M</div><h1 style={{ margin: "8px 0", fontSize: "clamp(46px,14vw,80px)", lineHeight: .92, fontWeight: 1000, letterSpacing: -2, background: "linear-gradient(180deg,#f8fdff,#31e7ff,#35f59a)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>美股DCA<br />折價追蹤</h1><div style={{ color: "#94a3b8", fontWeight: 900, letterSpacing: 1 }}>BINANCE XSTOCKS｜LEDGER DECISION</div>{error && <div style={{ marginTop: 10, padding: 10, borderRadius: 14, color: "#fecaca", background: "rgba(127,29,29,.35)", fontWeight: 900 }}>{error}</div>}</header><div style={{ margin: "12px 0", textAlign: "right", color: "#cbd5e1", fontWeight: 900, fontSize: 12 }}><span style={{ color: loading ? "#ffc857" : "#35f59a" }}>●</span> {loading ? "SYNC" : "LIVE"}｜{timeText(updatedAt)}</div>{children}</main>;
}
