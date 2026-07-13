import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import V17Dashboard from "./v17";

const HISTORY_KEY = "v17-real-portfolio-history-v1";
const RANGES = { "1D": 24 * 60 * 60 * 1000, "7D": 7 * 24 * 60 * 60 * 1000, "30D": 30 * 24 * 60 * 60 * 1000 };

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function readHistory() {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((p) => safeNumber(p?.ts) > 0 && safeNumber(p?.value) > 0) : [];
  } catch {
    return [];
  }
}

function writeHistory(points) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(points.slice(-4000)));
  } catch {}
}

function formatDate(ts, range) {
  const date = new Date(ts);
  return range === "1D"
    ? date.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false })
    : `${date.getMonth() + 1}/${String(date.getDate()).padStart(2, "0")}`;
}

function formatDateTime(ts) {
  return new Date(ts).toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function compactPoints(points, max = 120) {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => points[Math.round(i * step)]);
}

function PortfolioValueChart() {
  const [range, setRange] = useState("7D");
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState("讀取真實持倉…");

  async function capturePoint() {
    try {
      const res = await fetch(`/api/daily-summary?t=${Date.now()}`, { cache: "no-store" });
      const data = await res.json();
      const totals = data?.totals || {};
      const value = safeNumber(totals.currentValue);
      if (!(value > 0)) throw new Error("current_value_missing");
      const point = {
        ts: Date.now(),
        value,
        cost: totals.totalCost == null ? null : safeNumber(totals.totalCost),
        pnl: totals.pnl == null ? null : safeNumber(totals.pnl),
        pnlPct: totals.pnlPct == null ? null : safeNumber(totals.pnlPct),
        holdingCount: safeNumber(totals.holdingCount),
      };
      const old = readHistory();
      const last = old[old.length - 1];
      const merged = last && point.ts - last.ts < 5 * 60 * 1000
        ? [...old.slice(0, -1), point]
        : [...old, point];
      const keepAfter = Date.now() - 35 * 24 * 60 * 60 * 1000;
      const next = merged.filter((p) => p.ts >= keepAfter);
      writeHistory(next);
      setHistory(next);
      setSelected(point);
      setStatus(`真實持倉 ${point.holdingCount || 0} 檔｜最後更新 ${formatDateTime(point.ts)}`);
    } catch {
      const cached = readHistory();
      setHistory(cached);
      setStatus(cached.length ? "即時資料暫時失敗，顯示已保存快照" : "尚無可用歷史；等待下一次真實持倉同步");
    }
  }

  useEffect(() => {
    setHistory(readHistory());
    capturePoint();
    const timer = setInterval(capturePoint, 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const visible = useMemo(() => {
    const cutoff = Date.now() - RANGES[range];
    return compactPoints(history.filter((p) => p.ts >= cutoff).sort((a, b) => a.ts - b.ts));
  }, [history, range]);

  const chart = useMemo(() => {
    const points = visible.length ? visible : [];
    if (!points.length) return null;
    const values = points.map((p) => p.value);
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (max === min) {
      const pad = Math.max(0.5, max * 0.005);
      min -= pad;
      max += pad;
    } else {
      const pad = (max - min) * 0.12;
      min -= pad;
      max += pad;
    }
    const W = 720, H = 280, L = 66, R = 14, T = 18, B = 46;
    const plotW = W - L - R, plotH = H - T - B;
    const xy = points.map((p, i) => ({
      ...p,
      x: L + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW),
      y: T + ((max - p.value) / (max - min)) * plotH,
    }));
    const path = xy.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const area = `${path} L${xy[xy.length - 1].x.toFixed(1)},${(T + plotH).toFixed(1)} L${xy[0].x.toFixed(1)},${(T + plotH).toFixed(1)} Z`;
    const yTicks = Array.from({ length: 4 }, (_, i) => max - (i / 3) * (max - min));
    const xIndexes = [...new Set([0, Math.floor((points.length - 1) / 3), Math.floor(((points.length - 1) * 2) / 3), points.length - 1])];
    return { W, H, L, R, T, B, plotW, plotH, xy, path, area, yTicks, xIndexes, min, max };
  }, [visible]);

  const active = selected || visible[visible.length - 1] || null;
  const first = visible[0] || null;
  const change = active && first ? active.value - first.value : 0;
  const changePct = first?.value ? change / first.value : 0;

  function selectNearest(event) {
    if (!chart?.xy?.length) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const clientX = event.touches?.[0]?.clientX ?? event.clientX;
    const svgX = ((clientX - rect.left) / rect.width) * chart.W;
    const nearest = chart.xy.reduce((best, p) => Math.abs(p.x - svgX) < Math.abs(best.x - svgX) ? p : best, chart.xy[0]);
    setSelected(nearest);
  }

  return <section style={{ margin: "12px 0 16px", padding: 14, borderRadius: 20, background: "linear-gradient(180deg,rgba(15,23,42,.98),rgba(2,6,23,.98))", border: "1px solid rgba(250,204,21,.24)", boxShadow: "0 16px 42px rgba(0,0,0,.28)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
      <div>
        <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 900 }}>真實持倉總市值（USD）</div>
        <div style={{ color: "#f8fafc", fontSize: 30, fontWeight: 1000, marginTop: 4 }}>${safeNumber(active?.value).toFixed(2)}</div>
        <div style={{ marginTop: 3, color: change >= 0 ? "#4ade80" : "#fb7185", fontSize: 13, fontWeight: 1000 }}>{range === "1D" ? "1日" : range === "7D" ? "7日" : "30日"} {change >= 0 ? "+" : "-"}${Math.abs(change).toFixed(2)}（{changePct >= 0 ? "+" : ""}{(changePct * 100).toFixed(2)}%）</div>
      </div>
      <div style={{ textAlign: "right", color: "#cbd5e1", fontSize: 11, fontWeight: 850, lineHeight: 1.55 }}>
        <div>{active ? formatDateTime(active.ts) : "等待資料"}</div>
        <div>損益：{active?.pnl == null ? "N/A" : `${active.pnl >= 0 ? "+" : "-"}$${Math.abs(active.pnl).toFixed(2)}`}</div>
      </div>
    </div>

    <div style={{ marginTop: 12, borderRadius: 15, overflow: "hidden", background: "rgba(2,6,23,.72)", border: "1px solid rgba(148,163,184,.12)" }}>
      {chart ? <svg viewBox={`0 0 ${chart.W} ${chart.H}`} role="img" aria-label="真實持倉總市值歷史曲線" style={{ width: "100%", display: "block", touchAction: "none" }} onMouseMove={selectNearest} onClick={selectNearest} onTouchStart={selectNearest} onTouchMove={selectNearest}>
        <defs>
          <linearGradient id="v17PortfolioArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#facc15" stopOpacity=".34" /><stop offset="100%" stopColor="#facc15" stopOpacity="0" /></linearGradient>
          <filter id="v17PortfolioGlow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        {chart.yTicks.map((tick, i) => {
          const y = chart.T + (i / 3) * chart.plotH;
          return <g key={tick}><line x1={chart.L} x2={chart.W - chart.R} y1={y} y2={y} stroke="rgba(148,163,184,.18)" strokeDasharray="5 6" /><text x={chart.L - 8} y={y + 4} textAnchor="end" fill="#94a3b8" fontSize="16" fontWeight="700">${tick.toFixed(2)}</text></g>;
        })}
        <path d={chart.area} fill="url(#v17PortfolioArea)" />
        <path d={chart.path} fill="none" stroke="#facc15" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" filter="url(#v17PortfolioGlow)" />
        {chart.xIndexes.map((idx) => <text key={idx} x={chart.xy[idx].x} y={chart.H - 15} textAnchor={idx === 0 ? "start" : idx === chart.xy.length - 1 ? "end" : "middle"} fill="#94a3b8" fontSize="16" fontWeight="700">{formatDate(chart.xy[idx].ts, range)}</text>)}
        {active ? (() => {
          const point = chart.xy.reduce((best, p) => Math.abs(p.ts - active.ts) < Math.abs(best.ts - active.ts) ? p : best, chart.xy[0]);
          return <g><line x1={point.x} x2={point.x} y1={chart.T} y2={chart.T + chart.plotH} stroke="rgba(250,204,21,.35)" strokeDasharray="4 5" /><circle cx={point.x} cy={point.y} r="8" fill="#020617" stroke="#facc15" strokeWidth="4" /></g>;
        })() : null}
      </svg> : <div style={{ minHeight: 230, display: "grid", placeItems: "center", padding: 18, color: "#94a3b8", textAlign: "center", fontSize: 12, fontWeight: 850 }}>{status}</div>}
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 10 }}>
      {[['1D','1日'],['7D','7日'],['30D','30日']].map(([key,label]) => <button key={key} onClick={() => { setRange(key); setSelected(null); }} style={{ padding: "10px 5px", borderRadius: 12, border: range === key ? "1px solid #facc15" : "1px solid rgba(148,163,184,.16)", background: range === key ? "rgba(250,204,21,.12)" : "rgba(15,23,42,.78)", color: range === key ? "#fde047" : "#94a3b8", fontWeight: 1000 }}>{label}</button>)}
    </div>
    <div style={{ marginTop: 8, color: "#64748b", fontSize: 10, fontWeight: 800, lineHeight: 1.45 }}>{status}｜每分鐘保存一次真實持倉總市值；歷史從功能上線後開始累積。</div>
  </section>;
}

function ChartPortal() {
  const [target, setTarget] = useState(null);
  useEffect(() => {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (document.getElementById("v17-real-portfolio-chart-host")) {
        clearInterval(timer);
        return;
      }
      const summary = Array.from(document.querySelectorAll("section")).find((section) => {
        const text = section.textContent || "";
        return text.includes("真實持倉") && text.includes("總投入") && text.includes("目前市值");
      });
      if (summary) {
        const host = document.createElement("div");
        host.id = "v17-real-portfolio-chart-host";
        summary.insertAdjacentElement("afterend", host);
        setTarget(host);
        clearInterval(timer);
      } else if (attempts >= 40) {
        clearInterval(timer);
      }
    }, 500);
    return () => clearInterval(timer);
  }, []);
  return target ? createPortal(<PortfolioValueChart />, target) : null;
}

export default function V17WithChart() {
  return <><V17Dashboard /><ChartPortal /></>;
}
