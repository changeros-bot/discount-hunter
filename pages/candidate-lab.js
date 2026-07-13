import { useEffect, useMemo, useState } from "react";

const LEGACY_BASELINE_KEY = "v17-candidate-lab-stage2-baseline-v1";
const tone = {
  PASS: { color: "#bbf7d0", bg: "rgba(34,197,94,.13)", border: "rgba(34,197,94,.28)" },
  CHECK: { color: "#fde68a", bg: "rgba(245,158,11,.13)", border: "rgba(245,158,11,.28)" },
  FAIL: { color: "#fecaca", bg: "rgba(248,113,113,.13)", border: "rgba(248,113,113,.28)" },
};

function money(value) {
  const n = Number(value || 0);
  return n > 0 ? `$${n.toFixed(n >= 100 ? 2 : 3)}` : "—";
}
function pct(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(1)}%` : "—";
}
function StatusPill({ value }) {
  const s = tone[value] || tone.CHECK;
  return <span style={{ padding: "5px 9px", borderRadius: 999, color: s.color, background: s.bg, border: `1px solid ${s.border}`, fontSize: 11, fontWeight: 1000 }}>{value}</span>;
}

export default function CandidateLab() {
  const [data, setData] = useState(null);
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
    } catch (err) {
      setError(err.message || "candidate_lab_failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    try { localStorage.removeItem(LEGACY_BASELINE_KEY); } catch {}
    load();
  }, []);

  const rows = useMemo(() => {
    const all = data?.rows || [];
    return filter === "ALL" ? all : all.filter((row) => row.labStatus === filter);
  }, [data, filter]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const row of rows) {
      const key = row.group || "其他";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    }
    return [...map.entries()];
  }, [rows]);

  return <main style={{ minHeight: "100vh", padding: 12, background: "radial-gradient(circle at 10% 0%,rgba(34,211,238,.12),transparent 28%),linear-gradient(180deg,#050b18,#020617)", color: "#f8fafc", fontFamily: "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
    <header style={{ padding: 16, borderRadius: 22, background: "linear-gradient(135deg,rgba(8,47,73,.75),rgba(15,23,42,.96))", border: "1px solid rgba(34,211,238,.25)" }}>
      <a href="/v17" style={{ color: "#bae6fd", textDecoration: "none", fontWeight: 900 }}>← 返回折價獵人 V17</a>
      <h1 style={{ margin: "14px 0 5px", fontSize: 30 }}>候選標的內測實驗室</h1>
      <div style={{ color: "#94a3b8", fontSize: 12, lineHeight: 1.6 }}>目前只做內測，不建立任何紙上部位。Stage 1 驗證資料；Stage 2 將做連續穩定性與規則合理性測試；Stage 3 才是 dry-run 訊號模擬。</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 12 }}>
        <span style={{ padding: "6px 9px", borderRadius: 999, background: "rgba(30,41,59,.72)", color: "#cbd5e1", fontSize: 11, fontWeight: 900 }}>真實下單：禁止</span>
        <span style={{ padding: "6px 9px", borderRadius: 999, background: "rgba(30,41,59,.72)", color: "#cbd5e1", fontSize: 11, fontWeight: 900 }}>自動交易：禁止</span>
        <span style={{ padding: "6px 9px", borderRadius: 999, background: "rgba(245,158,11,.12)", color: "#fde68a", fontSize: 11, fontWeight: 900 }}>紙上建倉：未開始</span>
      </div>
    </header>

    <section style={{ marginTop: 12, padding: 14, borderRadius: 18, background: "rgba(15,23,42,.9)", border: "1px solid rgba(148,163,184,.16)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
        {[["總候選", data?.summary?.total || 0, "#f8fafc"], ["PASS", data?.summary?.pass || 0, "#86efac"], ["CHECK", data?.summary?.check || 0, "#fde68a"], ["FAIL", data?.summary?.fail || 0, "#fca5a5"], ["Binance", data?.summary?.binance || 0, "#67e8f9"], ["紙上部位", 0, "#c4b5fd"]].map(([label, value, color]) => <div key={label} style={{ padding: 10, borderRadius: 13, background: "rgba(2,6,23,.55)" }}><div style={{ color: "#94a3b8", fontSize: 10, fontWeight: 900 }}>{label}</div><div style={{ color, fontSize: 20, fontWeight: 1000, marginTop: 3 }}>{value}</div></div>)}
      </div>
      <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: "rgba(120,53,15,.14)", border: "1px solid rgba(245,158,11,.22)", color: "#fde68a", fontSize: 12, lineHeight: 1.6 }}>
        內測流程：資料有效性 → 連續穩定性 → 規則與高點合理性 → Dry-run 訊號 → Josh 明確同意後才建立紙上交易。
      </div>
      <button onClick={load} disabled={loading} style={{ width: "100%", marginTop: 10, padding: 11, borderRadius: 12, border: "1px solid rgba(34,211,238,.3)", background: "rgba(8,145,178,.18)", color: "#a5f3fc", fontWeight: 1000 }}>{loading ? "內測驗證中…" : "重新執行 Stage 1 內測"}</button>
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
              {[["現價", money(row.price)], ["52週高點", money(high)], ["折價", pct(row.discount)], ["Dry-run 訊號", `${row.signal?.text || "—"} ${row.signal?.amount || ""}`]].map(([k,v]) => <div key={k} style={{ padding: 8, borderRadius: 11, background: "rgba(2,6,23,.55)" }}><div style={{ color: "#7dd3fc", fontSize: 10, fontWeight: 900 }}>{k}</div><div style={{ marginTop: 3, color: "#f8fafc", fontWeight: 1000 }}>{v}</div></div>)}
            </div>
            <div style={{ marginTop: 8, color: "#cbd5e1", fontSize: 11, lineHeight: 1.55 }}>Provider：{row.quoteAudit?.provider || "—"}<br />Token：{row.tokenSymbol || "未辨識"}<br />狀態：{row.quoteAudit?.status || "—"}{row.quoteAudit?.error ? `｜${row.quoteAudit.error}` : ""}</div>
            <div style={{ marginTop: 8, color: "#64748b", fontSize: 10 }}>目前僅記錄內測結果；不建立紙上部位、不計算紙上損益。</div>
          </article>;
        })}
      </div>
    </section>)}
  </main>;
}
