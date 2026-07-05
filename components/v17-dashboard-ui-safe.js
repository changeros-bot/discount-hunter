import { fmtAmount, fmtPct, fmtUsd, LayerRules, Metric, PageShell, Section, TierProgress } from "./v17-dashboard-ui";

const TIER_ICON = { D1: "D1", D2: "D2", D3: "D3", D4: "D4", D5: "D5", D0: "D0" };
const TIER_TONE = {
  D0: { color: "#94a3b8", bg: "rgba(148,163,184,.10)", border: "rgba(148,163,184,.30)" },
  D1: { color: "#35f59a", bg: "rgba(53,245,154,.12)", border: "rgba(53,245,154,.45)" },
  D2: { color: "#ffc857", bg: "rgba(255,200,87,.12)", border: "rgba(255,200,87,.45)" },
  D3: { color: "#ff9f43", bg: "rgba(255,159,67,.12)", border: "rgba(255,159,67,.45)" },
  D4: { color: "#ff5c7a", bg: "rgba(255,92,122,.12)", border: "rgba(255,92,122,.45)" },
  D5: { color: "#ef4444", bg: "rgba(239,68,68,.12)", border: "rgba(239,68,68,.45)" }
};
const CYAN = "#31e7ff";

export { fmtAmount, PageShell, Section, TierProgress };

function highLabel(row) {
  if (row?.referenceMode === "cycle_high" || row?.discountModel === "btc_cycle_high_v1" || row?.assetType === "crypto") return "Cycle High";
  return "高點";
}

function drawdownLabel(row) {
  if (row?.referenceMode === "cycle_high" || row?.discountModel === "btc_cycle_high_v1" || row?.assetType === "crypto") return "距Cycle High降幅";
  return "距52週高點降幅";
}

function quantityText(holding) {
  if (!holding) return "—";
  const qty = Number(holding.quantity || 0);
  if (!Number.isFinite(qty)) return "—";
  const symbol = String(holding.symbol || "").toUpperCase();
  if (symbol === "BTC") return qty.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
  return qty.toFixed(4);
}

function hasCostBasis(holding) {
  const cost = Number(holding?.totalCost || 0);
  if (!(cost > 0)) return false;
  if (holding?.costBasisMissing) return false;
  const source = String(holding?.costBasisSource || "");
  return source.includes("transfer_history") || source.includes("binance_myTrades");
}

function avgCostText(holding) {
  if (!hasCostBasis(holding)) return "缺成本，不能算損益";
  const avg = Number(holding?.averageCost || holding?.averageBuyPrice || 0);
  return avg > 0 ? `(均價 ${fmtUsd(avg, 2)})` : null;
}

function cycleHighDate(row) {
  return row?.cycleHighDate ? `(${row.cycleHighDate})` : null;
}

function CardMetrics({ row }) {
  const holding = row?.walletHolding;
  const hasHolding = Boolean(holding);
  const costReady = hasCostBasis(holding);
  const value = Number(holding?.currentValue || 0);
  const cost = Number(holding?.totalCost || 0);
  const pnl = costReady ? value - cost : null;
  const pnlPct = costReady && cost > 0 ? pnl / cost : null;
  const dash = "—";
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", overflow: "hidden", borderRadius: 16, border: "1px solid rgba(49,231,255,.14)", background: "rgba(2,6,23,.38)" }}>
    <Metric label="現價" value={fmtUsd(row.price, 4)} />
    <Metric label={highLabel(row)} value={fmtUsd(row.high || row.cycleHigh, 2)} subValue={cycleHighDate(row)} />
    <Metric label="數量" value={hasHolding ? quantityText(holding) : dash} />
    <Metric label="成本" value={hasHolding ? (costReady ? fmtUsd(cost, 2) : "N/A") : dash} subValue={hasHolding ? avgCostText(holding) : null} />
    <Metric label="市值" value={hasHolding ? fmtUsd(value, 2) : dash} />
    <Metric label="損益" value={hasHolding ? (costReady ? `${pnl >= 0 ? "+" : "-"}${fmtUsd(Math.abs(pnl), 2)}` : "N/A") : dash} signed={costReady ? pnl : null} subValue={hasHolding && !costReady ? "缺成本不計算" : null} />
    <Metric label="報酬率" value={hasHolding ? (costReady ? `${pnlPct >= 0 ? "+" : ""}${(pnlPct * 100).toFixed(2)}%` : "N/A") : dash} signed={costReady ? pnlPct : null} subValue={hasHolding && !costReady ? "缺成本不計算" : null} />
    <Metric label={drawdownLabel(row)} value={fmtPct(row?.discount)} signed={row?.discount} />
  </div>;
}

export function AssetCard({ row, children }) {
  const tone = TIER_TONE[row.tier] || TIER_TONE.D0;
  return <article style={{ position: "relative", overflow: "hidden", padding: 14, borderRadius: 22, background: "radial-gradient(circle at 0% 0%, rgba(49,231,255,.18), transparent 36%), linear-gradient(135deg, rgba(11,19,36,.88), rgba(5,11,24,.78))", border: "1px solid rgba(49,231,255,.20)", color: "#f8fafc", boxShadow: "0 18px 40px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.05)", backdropFilter: "blur(18px)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start", marginBottom: 10 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
        <span style={{ flex: "0 0 auto", width: 15, height: 15, borderRadius: 999, background: "#35f59a", boxShadow: "0 0 16px rgba(53,245,154,.75)" }} />
        <div style={{ minWidth: 0 }}><div style={{ fontSize: 21, fontWeight: 1000, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.symbol}</div><div style={{ color: "#94a3b8", fontWeight: 850, fontSize: 12 }}>{row.name || "--"}</div></div>
      </div>
      <strong style={{ flex: "0 0 auto", padding: "6px 10px", borderRadius: 999, background: tone.bg, border: `1px solid ${tone.border}`, color: tone.color, fontSize: 13, boxShadow: `0 0 18px ${tone.border}` }}>{TIER_ICON[row.tier] || row.tier}</strong>
    </div>
    <CardMetrics row={row} />
    <div style={{ marginTop: 10 }}>{children}</div>
    <LayerRules row={row} rules={row.rules || []} amounts={row.amounts || []} activeTier={row.tier} />
  </article>;
}
