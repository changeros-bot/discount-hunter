import { useEffect, useMemo, useState } from "react";

const BASELINE_KEY = "v17-candidate-lab-stage2-baseline-v1";
const tone = {
  PASS: { color: "#bbf7d0", bg: "rgba(34,197,94,.13)", border: "rgba(34,197,94,.28)" },
  CHECK: { color: "#fde68a", bg: "rgba(245,158,11,.13)", border: "rgba(245,158,11,.28)" },
  FAIL: { color: "#fecaca", bg: "rgba(248,113,113,.13)", border: "rgba(248,113,113,.28)" },
};

function money(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? `$${n.toFixed(n >= 100 ? 2 : 3)}` : "—";
}
function pct(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(1)}%` : "—";
}
function readBaseline() {
  try { return JSON.parse(localStorage.getItem(BASELINE_KEY) || "null"); } catch { return null; }
}
function writeBaseline(value) {
  try { localStorage.setItem(BASELINE_KEY, JSON.stringify(value)); } catch {}
}
function StatusPill({ value }) {
  const s = tone[value] || tone.CHECK;
  return <span style={{ padding: "5px 9px", borderRadius: 999, color: s.color, background: s.bg, border: `1px solid ${s.border}`, fontSize: 11, fontWeight: 1000 }}>{value}</span>;
}

export default function CandidateLab() {
  const [data, setData] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/v17/candidate-lab?t=${Date.now()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error || `HTTP ${res.status}`);
      setData(json);
      setError("");
      const saved = readBaseline();
      if (saved?.positions?.length) {
        setBaseline(saved);
      } else {
        const passRows = (json.rows || []).filter((row) => row.labStatus === "PASS" && Number(row.price) > 0);
        const started = {
          startedAt: new Date().toISOString(),
          durationDays: 28,
          capitalPerAsset: 5,
          positions: passRows.map((row) => ({
            symbol: row.symbol,
            name: row.name,
            group: row.group,
            entryPrice: Number(row.price),
            quantity: 5 / Number(row.price),
            cost: 5,
            entryDiscount: row.discount,
            source: row.quoteAudit?.provider,
            realOrder: false,
          })),
        };
        writeBaseline(started);
        setBaseline(started);
      }
    } catch (err) {
      setError(err.message || "candidate_lab_failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const baselineMap = useMemo(() => new Map((baseline?.positions || []).map((p) => [p.symbol, p])), [baseline]);
  const enrichedRows = useMemo(() => (data?.rows || []).map((row) => {
    const paper = baselineMap.get(row.symbol);
    const currentValue = paper ? paper.quantity * Number(row.price || 0) : null;
    const pnl = paper ? currentValue - paper.cost : null;
    const pnlPct = paper && paper.cost > 0 ? pnl / paper.cost : null;
    return { ...row, paper, currentValue, pnl, pnlPct };
  }), [data, baselineMap]);

  const rows = useMemo(() => filter === "ALL" ? enrichedRows : enrichedRows.filter((row) => row.labStatus === filter), [enrichedRows, filter]);
  const groups = useMemo(() => {
    const map = new Map();
    for (const row of rows) {
      const key = row.group || "其他";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    }
    return [...map.entries()];
  }, [rows]);

  const stage2 = useMemo(() => {
    const active = enrichedRows.filter((row) => row.paper);
    const cost = active.reduce((s, row) => s + Number(row.paper.cost || 0), 0);
    const value = active.reduce((s, row) => s + Number(row.currentValue || 0), 0);
    return { count: active.length, cost, value, pnl: value - cost, pnlPct: cost > 0 ? (value - cost) / cost : 0 };
  }, [enrichedRows]);

  return <main style={{ minHeight: "100vh", padding: 12, background: "radial-gradient(circle at 10% 0%,rgba(34,211,238,.12),transparent 28%),linear-gradient(180deg,#050b18,#020617)", color: "#f8fafc", fontFamily: "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
    <header style={{ padding: 16, borderRadius: 22, background: "linear-gradient(135deg,rgba(8,47,73,.75),rgba(15,23,42,.96))", border: "1px solid rgba(34,211,238,.25)" }}>
      <a href="/v17" style={{ color: "#bae6fd", textDecoration: "none", fontWeight: 900 }}>← 返回折價獵人 V17</a>
      <h1 style={{ margin: "14px 0 5px", fontSize: 30 }}>候選標的內測實驗室</h1>
      <div style={{ color: "#94a3b8", fontSize: 12, lineHeight: 1.6 }}>Stage 1 資料驗證＋Stage 2 獨立紙上基準單。正式 10 檔與既有 28 檔帳本不受影響。</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 12 }}>
        <span style={{ padding: "6px 9px", borderRadius: 999, background: "rgba(30,41,59,.72)", color: "#cbd5e1", fontSize: 11, fontWeight: 900 }}>真實下單：禁止</span>
        <span style={{ padding: "6px 9px", borderRadius: 999, background: "rgba(30,41,59,.72)", color: "#cbd5e1", fontSize: 11, fontWeight: 900 }}>自動交易：禁止</span>
        <span style={{ padding: "6px 9px", borderRadius: 999, background: "rgba(34,197,94,.12)", color: "#bbf7d0", fontSize: 11, fontWeight: 900 }}>Stage 2：已開始</span>
      </div>
    </header>

    <section style={{ marginTop: 12, padding: 14, borderRadius: 18, background: "rgba(15,23,42,.9)", border: "1px solid rgba(148,163,184,.16)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
        {[["總候選", data?.summary?.total || 0, "#f8fafc"], ["PASS", data?.summary?.pass || 0, "#86efac"], ["CHECK", data?.summary?.check || 0, "#fde68a"], ["FAIL", data?.summary?.fail || 0, "#fca5a5"], ["Stage 2", stage2.count, "#67e8f9"], ["總投入", `${stage2.cost.toFixed(0)}U`, "#c4b5fd"]].map(([label, value, color]) => <div key={label} style={{ padding: 10, borderRadius: 13, background: "rgba(2,6,23,.55)" }}><div style={{ color: "#94a3b8", fontSize: 10, fontWeight: 900 }}>{label}</div><div style={{ color, fontSize: 20, fontWeight: 1000, marginTop: 3 }}>{value}</div></div>)}
      </div>
      <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: "rgba(8,145,178,.12)", border: "1px solid rgba(34,211,238,.2)", color: "#cbd5e1", fontSize: 12, lineHeight: 1.6 }}>
        Stage 2 市值：{money(stage2.value)}｜損益：<strong style={{ color: stage2.pnl >= 0 ? "#86efac" : "#fb7185" }}>{stage2.pnl >= 0 ? "+" : ""}{money(stage2.pnl)}</strong>｜報酬率：{(stage2.pnlPct * 100).toFixed(2)}%<br />
        起始時間：{baseline?.startedAt ? new Date(baseline.startedAt).toLocaleString("zh-TW") : "建立中"}｜每檔基準單 5U｜追蹤 4 週
      </div>
      <button onClick={load} disabled={loading} style={{ width: "100%", marginTop: 10, padding: 11, borderRadius: 12, border: "1px solid rgba(34,211,238,.3)", background: "rgba(8,145,178,.18)", color: "#a5f3fc", fontWeight: 1000 }}>{loading ? "驗證中…" : "重新驗證並更新紙上損益"}</button>
      {error ? <div style={{ marginTop: 8, color: "#fecaca", fontSize: 12 }}>{error}</div> : null}
    </section>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginTop: 12 }}>
      {["ALL", "PASS", "CHECK", "FAIL"].map((key) => <button key={key} onClick={() => setFilter(key)} style={{ padding: "9px 4px", borderRadius: 11, border: filter === key ? "1px solid #22d3ee" : "1px solid rgba(148,163,184,.16)", background: filter === key ? "rgba(8,145,178,.2)" : "rgba(15,23,42,.8)", color: filter === key ? "#67e8f9" : "#94a3b8", fontWeight: 1000 }}>{key}</button>)}
    </div>

    {groups.map(([group, items]) => <section key={group} style={{ marginTop: 14 }}>
      <h2 style={{ margin: "0 0 8px", color: "#e2e8f0", fontSize: 17 }}>{group}（{items.length}）</h2>
      <div style={{ display: "grid", gap: 9 }}>
        {items.map((row) => {
          const s = tone[row.labStatus] || tone.CHECK;
          const high = Number(row.high52w || row.high || 0);
          return <article key={row.symbol} style={{ padding: 12, borderRadius: 16, background: "linear-gradient(135deg,rgba(15,23,42,.96),rgba(2,6,23,.96))", border: `1px solid ${s.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <div><strong style={{ fontSize: 20 }}>{row.symbol}</strong><div style={{ color: "#94a3b8", fontSize: 11 }}>{row.name}</div></div>
              <StatusPill value={row.labStatus} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 7, marginTop: 10 }}>
              {[["現價", money(row.price)], ["52週高點", money(high)], ["折價", pct(row.discount)], ["訊號", `${row.signal?.text || "—"} ${row.signal?.amount || ""}`], ["紙上買入價", row.paper ? money(row.paper.entryPrice) : "未建倉"], ["紙上損益", row.paper ? `${row.pnl >= 0 ? "+" : ""}${money(row.pnl)} (${(row.pnlPct * 100).toFixed(2)}%)` : "—"]].map(([k,v]) => <div key={k} style={{ padding: 8, borderRadius: 11, background: "rgba(2,6,23,.55)" }}><div style={{ color: "#7dd3fc", fontSize: 10, fontWeight: 900 }}>{k}</div><div style={{ marginTop: 3, color: k === "紙上損益" && row.paper ? (row.pnl >= 0 ? "#86efac" : "#fb7185") : "#f8fafc", fontWeight: 1000 }}>{v}</div></div>)}
            </div>
            <div style={{ marginTop: 8, color: "#cbd5e1", fontSize: 11, lineHeight: 1.55 }}>Provider：{row.quoteAudit?.provider || "—"}<br />Token：{row.tokenSymbol || "未辨識"}<br />狀態：{row.quoteAudit?.status || "—"}</div>
            <div style={{ marginTop: 8, color: row.paper ? "#86efac" : "#64748b", fontSize: 10 }}>{row.paper ? "Stage 2：5U 基準紙上部位追蹤中；禁止真實下單。" : "未進 Stage 2：CHECK／FAIL 不建立部位。"}</div>
          </article>;
        })}
      </div>
    </section>)}
  </main>;
}
