import { useEffect, useMemo, useState } from "react";

const LEGACY_BASELINE_KEY = "v17-candidate-lab-stage2-baseline-v1";
const SNAPSHOT_KEY = "v17-candidate-lab-stage2-snapshots-v1";
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
function readSnapshots() {
  try {
    const value = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}
function writeSnapshots(value) {
  try { localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(value.slice(-20))); } catch {}
}
function StatusPill({ value }) {
  const s = tone[value] || tone.CHECK;
  return <span style={{ padding: "5px 9px", borderRadius: 999, color: s.color, background: s.bg, border: `1px solid ${s.border}`, fontSize: 11, fontWeight: 1000 }}>{value}</span>;
}
function stage2Metrics(symbol, snapshots) {
  const obs = snapshots.map((snap) => snap.rows?.find((row) => row.symbol === symbol)).filter(Boolean);
  if (!obs.length) return { observations: 0, status: "WAIT", providerStable: true, maxPriceJump: 0, maxHighShift: 0, signalChanges: 0 };
  let maxPriceJump = 0;
  let maxHighShift = 0;
  let signalChanges = 0;
  for (let i = 1; i < obs.length; i += 1) {
    const prev = obs[i - 1];
    const now = obs[i];
    if (prev.price > 0) maxPriceJump = Math.max(maxPriceJump, Math.abs(now.price / prev.price - 1) * 100);
    if (prev.high52w > 0) maxHighShift = Math.max(maxHighShift, Math.abs(now.high52w / prev.high52w - 1) * 100);
    if (now.signalLevel !== prev.signalLevel) signalChanges += 1;
  }
  const providers = new Set(obs.map((row) => row.provider));
  const providerStable = providers.size <= 1;
  const status = !providerStable || maxHighShift > 5 || maxPriceJump > 25 ? "CHECK" : obs.length >= 3 ? "PASS" : "WAIT";
  return { observations: obs.length, status, providerStable, maxPriceJump, maxHighShift, signalChanges };
}

export default function CandidateLab() {
  const [data, setData] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/v17/candidate-lab?t=${Date.now()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error || `HTTP ${res.status}`);
      const now = Date.now();
      const slimRows = (json.rows || []).map((row) => ({
        symbol: row.symbol,
        price: Number(row.price || 0),
        high52w: Number(row.high52w || row.high || 0),
        provider: row.quoteAudit?.provider || "—",
        signalLevel: Number(row.signal?.level || 0),
      }));
      const old = readSnapshots();
      const last = old[old.length - 1];
      const next = last && now - last.ts < 5 * 60 * 1000 ? [...old.slice(0, -1), { ts: now, rows: slimRows }] : [...old, { ts: now, rows: slimRows }];
      writeSnapshots(next);
      setSnapshots(next);
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
    setSnapshots(readSnapshots());
    load();
  }, []);

  const enriched = useMemo(() => (data?.rows || []).map((row) => ({ ...row, stage2: stage2Metrics(row.symbol, snapshots) })), [data, snapshots]);
  const rows = useMemo(() => filter === "ALL" ? enriched : enriched.filter((row) => row.labStatus === filter), [enriched, filter]);
  const groups = useMemo(() => {
    const map = new Map();
    for (const row of rows) {
      const key = row.group || "其他";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    }
    return [...map.entries()];
  }, [rows]);
  const stage2Summary = useMemo(() => enriched.reduce((acc, row) => {
    acc[row.stage2.status] = (acc[row.stage2.status] || 0) + 1;
    return acc;
  }, { PASS: 0, CHECK: 0, WAIT: 0 }), [enriched]);

  return <main style={{ minHeight: "100vh", padding: 12, background: "radial-gradient(circle at 10% 0%,rgba(34,211,238,.12),transparent 28%),linear-gradient(180deg,#050b18,#020617)", color: "#f8fafc", fontFamily: "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
    <header style={{ padding: 16, borderRadius: 22, background: "linear-gradient(135deg,rgba(8,47,73,.75),rgba(15,23,42,.96))", border: "1px solid rgba(34,211,238,.25)" }}>
      <a href="/v17" style={{ color: "#bae6fd", textDecoration: "none", fontWeight: 900 }}>← 返回折價獵人 V17</a>
      <h1 style={{ margin: "14px 0 5px", fontSize: 30 }}>候選標的內測實驗室</h1>
      <div style={{ color: "#94a3b8", fontSize: 12, lineHeight: 1.6 }}>Stage 1 驗證資料；Stage 2 累積多次快照檢查報價、52 週高點與訊號穩定性。仍不建立任何紙上部位。</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 12 }}>
        <span style={{ padding: "6px 9px", borderRadius: 999, background: "rgba(30,41,59,.72)", color: "#cbd5e1", fontSize: 11, fontWeight: 900 }}>真實下單：禁止</span>
        <span style={{ padding: "6px 9px", borderRadius: 999, background: "rgba(30,41,59,.72)", color: "#cbd5e1", fontSize: 11, fontWeight: 900 }}>紙上建倉：未開始</span>
        <span style={{ padding: "6px 9px", borderRadius: 999, background: "rgba(8,145,178,.16)", color: "#67e8f9", fontSize: 11, fontWeight: 900 }}>Stage 2：內測中</span>
      </div>
    </header>

    <section style={{ marginTop: 12, padding: 14, borderRadius: 18, background: "rgba(15,23,42,.9)", border: "1px solid rgba(148,163,184,.16)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
        {[["總候選", data?.summary?.total || 0, "#f8fafc"], ["Stage1 PASS", data?.summary?.pass || 0, "#86efac"], ["Stage1 CHECK", data?.summary?.check || 0, "#fde68a"], ["Stage2 PASS", stage2Summary.PASS, "#67e8f9"], ["Stage2 CHECK", stage2Summary.CHECK, "#fca5a5"], ["待累積", stage2Summary.WAIT, "#c4b5fd"]].map(([label, value, color]) => <div key={label} style={{ padding: 10, borderRadius: 13, background: "rgba(2,6,23,.55)" }}><div style={{ color: "#94a3b8", fontSize: 10, fontWeight: 900 }}>{label}</div><div style={{ color, fontSize: 20, fontWeight: 1000, marginTop: 3 }}>{value}</div></div>)}
      </div>
      <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: "rgba(8,145,178,.12)", border: "1px solid rgba(34,211,238,.22)", color: "#bae6fd", fontSize: 12, lineHeight: 1.6 }}>
        已累積 {snapshots.length} 次快照。至少 3 次且無異常，才標記 Stage 2 PASS；價格單次跳動超過 25%、高點漂移超過 5%、或報價來源切換會標記 CHECK。
      </div>
      <button onClick={load} disabled={loading} style={{ width: "100%", marginTop: 10, padding: 11, borderRadius: 12, border: "1px solid rgba(34,211,238,.3)", background: "rgba(8,145,178,.18)", color: "#a5f3fc", fontWeight: 1000 }}>{loading ? "內測驗證中…" : "新增一次 Stage 2 驗證快照"}</button>
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
          const m = row.stage2;
          return <article key={row.symbol} style={{ padding: 12, borderRadius: 16, background: "linear-gradient(135deg,rgba(15,23,42,.96),rgba(2,6,23,.96))", border: `1px solid ${s.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <div><strong style={{ fontSize: 20 }}>{row.symbol}</strong><div style={{ color: "#94a3b8", fontSize: 11 }}>{row.name}</div></div>
              <div style={{ display: "flex", gap: 6 }}><StatusPill value={row.labStatus} /><span style={{ padding: "5px 9px", borderRadius: 999, background: m.status === "PASS" ? "rgba(34,197,94,.13)" : m.status === "CHECK" ? "rgba(248,113,113,.13)" : "rgba(99,102,241,.13)", color: m.status === "PASS" ? "#bbf7d0" : m.status === "CHECK" ? "#fecaca" : "#c4b5fd", fontSize: 11, fontWeight: 1000 }}>S2 {m.status}</span></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 7, marginTop: 10 }}>
              {[["現價", money(row.price)], ["52週高點", money(high)], ["折價", pct(row.discount)], ["Dry-run 訊號", `${row.signal?.text || "—"} ${row.signal?.amount || ""}`], ["觀測次數", m.observations], ["來源穩定", m.providerStable ? "是" : "否"], ["最大價格跳動", `${m.maxPriceJump.toFixed(2)}%`], ["最大高點漂移", `${m.maxHighShift.toFixed(2)}%`], ["訊號變更", `${m.signalChanges} 次`]].map(([k,v]) => <div key={k} style={{ padding: 8, borderRadius: 11, background: "rgba(2,6,23,.55)" }}><div style={{ color: "#7dd3fc", fontSize: 10, fontWeight: 900 }}>{k}</div><div style={{ marginTop: 3, color: "#f8fafc", fontWeight: 1000 }}>{v}</div></div>)}
            </div>
            <div style={{ marginTop: 8, color: "#cbd5e1", fontSize: 11, lineHeight: 1.55 }}>Provider：{row.quoteAudit?.provider || "—"}<br />Token：{row.tokenSymbol || "未辨識"}<br />Stage 2：只驗證穩定性，不建立部位。</div>
          </article>;
        })}
      </div>
    </section>)}
  </main>;
}
