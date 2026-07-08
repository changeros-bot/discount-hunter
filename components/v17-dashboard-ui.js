const CYAN = "#31e7ff";
const usdFmt = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usd0Fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const TIER_TONE = {
  D0: { color: "#94a3b8", bg: "rgba(148,163,184,.10)", border: "rgba(148,163,184,.30)" },
  D1: { color: "#35f59a", bg: "rgba(53,245,154,.12)", border: "rgba(53,245,154,.45)" },
  D2: { color: "#ffc857", bg: "rgba(255,200,87,.12)", border: "rgba(255,200,87,.45)" },
  D3: { color: "#ff9f43", bg: "rgba(255,159,67,.12)", border: "rgba(255,159,67,.45)" },
  D4: { color: "#ff5c7a", bg: "rgba(255,92,122,.12)", border: "rgba(255,92,122,.45)" },
  D5: { color: "#ef4444", bg: "rgba(239,68,68,.12)", border: "rgba(239,68,68,.45)" }
};

export function fmtPct(value) { const n = Number(value); return Number.isFinite(n) ? `${n.toFixed(1)}%` : "--"; }
export function fmtUsd(value, digits = 2) { if (value === null || value === undefined || value === "") return "N/A"; const n = Number(value); if (!Number.isFinite(n)) return "N/A"; return digits === 0 ? `$${usd0Fmt.format(n)}` : `$${usdFmt.format(n)}`; }
export function fmtAmount(value) { const n = Number(value || 0); return Number.isFinite(n) ? `${n.toFixed(2).replace(".00", "")}U` : "--"; }
export function timeText(iso) { if (!iso) return "讀取中"; const d = new Date(iso); return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`; }

export function Metric({ label, value, signed, subValue }) {
  const hasSigned = signed !== undefined && signed !== null;
  const color = !hasSigned ? "#f8fafc" : Number(signed) > 0 ? "#35f59a" : Number(signed) < 0 ? "#ff5c7a" : "#f8fafc";
  return <div style={{ padding: 10, minHeight: 62, background: "rgba(3,9,20,.54)", borderRight: "1px solid rgba(49,231,255,.10)", borderBottom: "1px solid rgba(49,231,255,.10)", minWidth: 0 }}>
    <div style={{ color: "#7dd3fc", fontWeight: 900, fontSize: 10, letterSpacing: .7, textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
    <strong style={{ display: "block", marginTop: 5, fontSize: 15, lineHeight: 1.1, color, textShadow: hasSigned ? `0 0 12px ${color}44` : "none", overflowWrap: "anywhere" }}>{value}</strong>
    {subValue ? <div style={{ marginTop: 4, color: "#94a3b8", fontSize: 10, fontWeight: 850 }}>{subValue}</div> : null}
  </div>;
}

function absDepth(value) { return Math.abs(Number(value || 0)); }
function symbolKey(symbol) { return String(symbol || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); }
function highLabel(row) { return row?.referenceMode === "cycle_high" || row?.discountModel === "btc_cycle_high_v1" || row?.assetType === "crypto" ? "Cycle High" : "高點"; }
function drawdownLabel(row) { return row?.referenceMode === "cycle_high" || row?.discountModel === "btc_cycle_high_v1" || row?.assetType === "crypto" ? "距Cycle High降幅" : "距52週高點降幅"; }
function referenceHigh(row) { return Number(row?.high || row?.cycleHigh || row?.high52w || 0); }
function layerPricePoint(row, rule) { const high = referenceHigh(row); const pct = Number(rule || 0); return high && Number.isFinite(pct) ? fmtUsd(high * (1 + pct / 100), 0) : "--"; }
function currentDiscountDepth(row) { const raw = Number(row?.discountRaw); return Number.isFinite(raw) ? Math.abs(raw) : absDepth(row?.discount); }
function nextTierProgress(row) { const depths = (row?.rules || []).map(absDepth); const level = Math.max(0, Number(row?.signalLevel || 0)); const current = currentDiscountDepth(row); const from = level === 0 ? 0 : depths[level - 1] ?? 0; const to = level === 0 ? depths[0] ?? 0 : depths[level] ?? depths[depths.length - 1] ?? from; const pct = Math.max(0, Math.min(100, ((current - from) / Math.max(.000001, to - from)) * 100)); return { fromTier: level === 0 ? "D0" : `D${level}`, toTier: level === 0 ? "D1" : depths[level] ? `D${level + 1}` : "MAX", pct }; }
function quantityText(holding) { if (!holding) return "—"; const qty = Number(holding.quantity || 0); if (!Number.isFinite(qty)) return "—"; return String(holding.symbol || "").toUpperCase() === "BTC" ? qty.toFixed(8).replace(/0+$/, "").replace(/\.$/, "") : qty.toFixed(4); }
function hasCostBasis(holding) { const cost = Number(holding?.totalCost || 0); if (!(cost > 0) || holding?.costBasisMissing) return false; const source = String(holding?.costBasisSource || ""); return source.includes("transfer_history") || source.includes("binance_myTrades") || source.includes("raw_buy_ledger_recovered") || source.includes("verified_tx_hash_receipt"); }
function avgCostText(holding) { if (!hasCostBasis(holding)) return "缺成本，不能算損益"; const avg = Number(holding?.averageCost || holding?.averageBuyPrice || 0); return avg > 0 ? `(均價 ${fmtUsd(avg, 2)})` : null; }
function cycleHighDate(row) { return row?.cycleHighDate ? `(${row.cycleHighDate})` : null; }

function qualityStatus(row) {
  const key = symbolKey(row?.symbol);
  if (key === "BTC") return { tone: "green", status: "通過", gate: "半自動：可草稿", action: "DCA 可｜逢低可" };
  if (["QQQON", "QQQ", "QQQM", "NVDAON", "TSMON", "AVGOON", "GOOGLON", "NVDA", "TSM", "AVGO", "GOOGL"].includes(key)) return { tone: "green", status: "通過", gate: "半自動：可草稿", action: "DCA 可｜逢低可" };
  if (["AMDON", "MRVLON", "AMD", "MRVL"].includes(key)) return { tone: "yellow", status: "觀察", gate: "半自動：低優先", action: "DCA 5U｜逢低可" };
  if (key === "SPCXON" || key === "SPCX") return { tone: "yellow", status: "未檢查", gate: "半自動：需確認", action: "DCA 5U｜逢低人工" };
  if (key === "RKLBON" || key === "RKLB") return { tone: "red", status: "觀察", gate: "半自動：只深跌", action: "DCA 禁止｜只等 -50/-65/-80" };
  return { tone: "yellow", status: "未檢查", gate: "半自動：禁止", action: "DCA 待確認｜逢低待確認" };
}

function strategyPolicy(row) {
  const key = symbolKey(row?.symbol);
  const core = { tone: "green", title: "核心策略", dca: "固定 DCA：每月 5U", dip: "逢低買進：照 D 層執行", note: "長期持有核心池，可 DCA + 逢低。" };
  const aiCore = { tone: "green", title: "AI核心策略", dca: "固定 DCA：每月 5U", dip: "逢低買進：照 D 層執行", note: "AI長期核心，DCA 與折價加碼都可用。" };
  const satellite = { tone: "yellow", title: "衛星策略", dca: "固定 DCA：每月 5U", dip: "逢低買進：照 D 層執行", note: "可投，但資金不足時優先級低於核心。" };
  if (key === "BTC") return { tone: "green", title: "BTC 週期核心", dca: "固定 DCA：每月 5U", dip: "逢低買進：照 BTC 週期 D 層", note: "核心資產；交易所持有，DCA + 深跌加碼。" };
  if (key === "QQQON" || key === "QQQ" || key === "QQQM") return { ...core, title: "ETF核心策略", note: "ETF型核心，最適合穩定 DCA。" };
  if (["NVDAON", "TSMON", "AVGOON", "GOOGLON", "NVDA", "TSM", "AVGO", "GOOGL"].includes(key)) return aiCore;
  if (["AMDON", "MRVLON", "AMD", "MRVL"].includes(key)) return satellite;
  if (key === "RKLBON" || key === "RKLB") return { tone: "red", title: "深折扣策略", dca: "固定 DCA：不做", dip: "逢低買進：只等 -50% / -65% / -80%", note: "平常不買；未到 -50% 前只觀察。" };
  if (key === "SPCXON" || key === "SPCX") return { tone: "yellow", title: "特殊觀察策略", dca: "固定 DCA：每月 5U", dip: "逢低買進：需人工確認", note: "必須用上市以來高點，不用一般 52 週高點。" };
  return { tone: "yellow", title: "未分類策略", dca: "固定 DCA：待確認", dip: "逢低買進：待確認", note: "尚未封版，不自動執行。" };
}

function toneStyle(tone) {
  const toneMap = {
    green: { color: "#bbf7d0", bg: "rgba(20,83,45,.22)", border: "rgba(34,197,94,.34)" },
    yellow: { color: "#fde68a", bg: "rgba(120,53,15,.20)", border: "rgba(245,158,11,.34)" },
    red: { color: "#fecaca", bg: "rgba(127,29,29,.20)", border: "rgba(248,113,113,.34)" },
  };
  return toneMap[tone] || toneMap.yellow;
}

function StrategyPolicyCard({ row }) {
  const p = strategyPolicy(row);
  const q = qualityStatus(row);
  const t = toneStyle(p.tone);
  const qt = toneStyle(q.tone);
  return <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
    <div style={{ padding: 10, borderRadius: 14, background: qt.bg, border: `1px solid ${qt.border}`, color: qt.color, fontWeight: 900, fontSize: 12, lineHeight: 1.45 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}><span style={{ fontSize: 13, fontWeight: 1000 }}>Quality</span><span>{q.status}</span></div>
      <div style={{ marginTop: 5, color: "#e2e8f0" }}>{q.gate}</div>
      <div style={{ color: "#cbd5e1" }}>{q.action}</div>
    </div>
    <div style={{ padding: 10, borderRadius: 14, background: t.bg, border: `1px solid ${t.border}`, color: t.color, fontWeight: 900, fontSize: 12, lineHeight: 1.45 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}><span style={{ fontSize: 13, fontWeight: 1000 }}>{p.title}</span><span style={{ color: "#e2e8f0", opacity: .88 }}>策略</span></div>
      <div style={{ marginTop: 5 }}>{p.dca}</div><div>{p.dip}</div>
    </div>
  </div>;
}

export function TierProgress({ row }) { if (!row) return null; const p = nextTierProgress(row); return <div style={{ marginTop: 10, padding: 10, borderRadius: 16, background: "rgba(3,9,20,.35)", border: "1px solid rgba(49,231,255,.12)" }}><div style={{ display: "flex", justifyContent: "space-between", color: "#e2e8f0", fontWeight: 950, fontSize: 13 }}><span>{p.fromTier}</span><span>{p.toTier}</span></div><div style={{ position: "relative", marginTop: 8, height: 8, borderRadius: 999, background: "rgba(49,231,255,.12)" }}><div style={{ width: `${p.pct}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg, #35f59a, #31e7ff, #ffc857)", boxShadow: "0 0 16px rgba(49,231,255,.40)" }} /><span style={{ position: "absolute", left: `calc(${p.pct}% - 6px)`, top: -5, width: 18, height: 18, borderRadius: 999, background: CYAN, boxShadow: "0 0 18px rgba(49,231,255,.80)" }} /></div><div style={{ marginTop: 8, color: CYAN, fontSize: 12, fontWeight: 1000 }}>{Math.round(p.pct)}%</div></div>; }
export function LayerRules({ row, rules = [], amounts = [], activeTier }) { return <div style={{ marginTop: 10 }}><div style={{ color: CYAN, fontWeight: 950, fontSize: 13, marginBottom: 8 }}>層級規則</div><div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 6 }}>{(rules || []).map((rule, index) => { const tier = `D${index + 1}`; const active = tier === activeTier; return <div key={tier} style={{ padding: "8px 3px", minHeight: 64, borderRadius: 12, textAlign: "center", background: active ? "rgba(49,231,255,.10)" : "rgba(8,18,35,.58)", border: active ? "1px solid rgba(49,231,255,.48)" : "1px solid rgba(148,163,184,.18)", color: active ? CYAN : "#94a3b8", fontWeight: 900 }}><div>{tier}</div><div style={{ fontSize: 10 }}>{fmtPct(rule).replace(".0", "")}</div><div style={{ fontSize: 10 }}>{fmtAmount(amounts?.[index] || 0)}</div><div style={{ marginTop: 3, fontSize: 10, color: active ? "#e0fbff" : "#64748b" }}>{layerPricePoint(row, rule)}</div></div>; })}</div></div>; }

export function CardMetrics({ row }) { const holding = row?.walletHolding; const hasHolding = Boolean(holding); const costReady = hasCostBasis(holding); const value = Number(holding?.currentValue || 0); const cost = Number(holding?.totalCost || 0); const pnl = costReady ? value - cost : null; const pnlPct = costReady && cost > 0 ? pnl / cost : null; const dash = "—"; return <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", overflow: "hidden", borderRadius: 16, border: "1px solid rgba(49,231,255,.14)", background: "rgba(2,6,23,.38)" }}><Metric label="現價" value={fmtUsd(row.price, 4)} /><Metric label={highLabel(row)} value={fmtUsd(row.high || row.cycleHigh, 2)} subValue={cycleHighDate(row)} /><Metric label="數量" value={hasHolding ? quantityText(holding) : dash} /><Metric label="成本" value={hasHolding ? (costReady ? fmtUsd(cost, 2) : "N/A") : dash} subValue={hasHolding ? avgCostText(holding) : null} /><Metric label="市值" value={hasHolding ? fmtUsd(value, 2) : dash} /><Metric label="損益" value={hasHolding ? (costReady ? `${pnl >= 0 ? "+" : "-"}${fmtUsd(Math.abs(pnl), 2)}` : "N/A") : dash} signed={costReady ? pnl : null} subValue={hasHolding && !costReady ? "缺成本不計算" : null} /><Metric label="報酬率" value={hasHolding ? (costReady ? `${pnlPct >= 0 ? "+" : ""}${(pnlPct * 100).toFixed(2)}%` : "N/A") : dash} signed={costReady ? pnlPct : null} subValue={hasHolding && !costReady ? "缺成本不計算" : null} /><Metric label={drawdownLabel(row)} value={fmtPct(row?.discount)} signed={row?.discount} /></div>; }

export function AssetCard({ row, children }) { const tone = TIER_TONE[row.tier] || TIER_TONE.D0; return <article style={{ position: "relative", overflow: "hidden", padding: 14, borderRadius: 22, background: "radial-gradient(circle at 0% 0%, rgba(49,231,255,.18), transparent 36%), linear-gradient(135deg, rgba(11,19,36,.88), rgba(5,11,24,.78))", border: "1px solid rgba(49,231,255,.20)", color: "#f8fafc", boxShadow: "0 18px 40px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.05)", backdropFilter: "blur(18px)" }}><style jsx>{`.asset-card-children > div:first-child > span:last-child { display: none !important; }`}</style><div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start", marginBottom: 10 }}><div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}><span style={{ flex: "0 0 auto", width: 15, height: 15, borderRadius: 999, background: "#35f59a", boxShadow: "0 0 16px rgba(53,245,154,.75)" }} /><div style={{ minWidth: 0 }}><div style={{ fontSize: 21, fontWeight: 1000, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.symbol}</div><div style={{ color: "#94a3b8", fontWeight: 850, fontSize: 12 }}>{row.name || "--"}</div></div></div><strong style={{ flex: "0 0 auto", padding: "6px 10px", borderRadius: 999, background: tone.bg, border: `1px solid ${tone.border}`, color: tone.color, fontSize: 13, boxShadow: `0 0 18px ${tone.border}` }}>{row.tier}</strong></div><CardMetrics row={row} /><div className="asset-card-children" style={{ marginTop: 10 }}>{children}</div><StrategyPolicyCard row={row} /><LayerRules row={row} rules={row.rules || []} amounts={row.amounts || []} activeTier={row.tier} /></article>; }
export function Section({ title, count, rows, empty, render }) { return <section style={{ marginTop: 16, padding: 12, borderRadius: 24, background: "rgba(5,11,24,.72)", border: "1px solid rgba(49,231,255,.16)", boxShadow: "0 0 32px rgba(49,231,255,.06)", backdropFilter: "blur(18px)" }}><h2 style={{ margin: "0 0 11px", fontSize: 19, color: "#e0fbff", fontWeight: 1000, letterSpacing: .5 }}>{title}（{count}）</h2>{rows.length ? <div style={{ display: "grid", gap: 12 }}>{rows.map(render)}</div> : <div style={{ padding: "28px 0", textAlign: "center", color: "#7dd3fc", fontWeight: 950 }}>{empty}</div>}</section>; }
export function PageShell({ loading, updatedAt, error, children }) { const liveColor = loading ? "#ffc857" : "#35f59a"; return <main style={{ minHeight: "100vh", padding: 12, background: "radial-gradient(circle at 12% 0%, rgba(49,231,255,.16), transparent 28%), radial-gradient(circle at 90% 8%, rgba(53,245,154,.10), transparent 24%), linear-gradient(180deg, #050b18, #020617)", color: "#f8fafc", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" }}><header style={{ position: "relative", overflow: "hidden", padding: "18px 14px 14px", textAlign: "left", borderRadius: 28, background: "linear-gradient(135deg, rgba(11,19,36,.92), rgba(5,11,24,.76))", border: "1px solid rgba(49,231,255,.26)", boxShadow: "0 0 46px rgba(49,231,255,.10), inset 0 1px 0 rgba(255,255,255,.07)", backdropFilter: "blur(20px)" }}><div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}><a href="/semi-auto-drafts" style={{ padding: "6px 10px", borderRadius: 999, color: "#bbf7d0", background: "rgba(34,197,94,.10)", border: "1px solid rgba(34,197,94,.30)", fontSize: 11, fontWeight: 1000, letterSpacing: 1.1, textDecoration: "none" }}>半自動草稿</a><div style={{ padding: "6px 10px", borderRadius: 999, color: CYAN, background: "rgba(49,231,255,.08)", border: "1px solid rgba(49,231,255,.30)", fontSize: 11, fontWeight: 1000, letterSpacing: 1.7 }}>V17-M</div></div><h1 style={{ position: "relative", margin: "22px 0 20px", fontSize: "clamp(48px, 15vw, 82px)", lineHeight: .98, fontWeight: 1000, letterSpacing: -2.2, background: "linear-gradient(180deg, #f8fdff 0%, #31e7ff 52%, #35f59a 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", textShadow: "0 0 36px rgba(49,231,255,.30)" }}>美股DCA<br />折價追蹤</h1><div style={{ position: "relative", display: "flex", justifyContent: "flex-end", margin: "0 0 14px" }}><div style={{ padding: "8px 12px", borderRadius: 16, color: "#a5f3fc", background: "rgba(49,231,255,.08)", border: "1px solid rgba(49,231,255,.24)", fontSize: 11, fontWeight: 950, letterSpacing: 1.4 }}>BINANCE XSTOCKS</div></div><div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 18, background: "rgba(2,6,23,.54)", border: "1px solid rgba(49,231,255,.18)" }}><div style={{ display: "flex", alignItems: "center", gap: 7, color: liveColor, fontWeight: 1000, fontSize: 12, letterSpacing: .8 }}><span style={{ width: 9, height: 9, borderRadius: 999, background: liveColor, boxShadow: `0 0 16px ${liveColor}` }} />{loading ? "SYNC" : "LIVE"}</div><div style={{ color: "#cbd5e1", fontWeight: 900, fontSize: 12, letterSpacing: .4 }}>{timeText(updatedAt)}</div></div>{error && <div style={{ position: "relative", marginTop: 10, padding: 10, borderRadius: 14, color: "#fecaca", background: "rgba(127,29,29,.35)", fontWeight: 900 }}>{error}</div>}</header>{children}</main>; }
