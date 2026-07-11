import { useEffect, useState } from "react";

function Box({ title, children, tone = "blue" }) {
  const border = tone === "green" ? "rgba(34,197,94,.38)" : tone === "red" ? "rgba(248,113,113,.36)" : tone === "yellow" ? "rgba(245,158,11,.34)" : "rgba(59,130,246,.30)";
  return <section style={{ marginTop: 14, border: `1px solid ${border}`, background: "rgba(15,23,42,.78)", borderRadius: 22, padding: 16 }}>
    <h2 style={{ margin: "0 0 10px", color: "#f8fafc", fontSize: 18, fontWeight: 1000 }}>{title}</h2>
    {children}
  </section>;
}

function n(value, digits = 2) {
  const x = Number(value || 0);
  return Number.isFinite(x) ? x.toFixed(digits) : "0.00";
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, { cache: "no-store", ...options });
  const json = await res.json();
  if (!res.ok || json.ok === false) throw new Error(json.error || "讀取失敗");
  return json;
}

function marketMapFromRows(rows = []) {
  return Object.fromEntries((rows || []).map((row) => [row.symbol, row]));
}

function statusText(status) {
  if (status === "consolidated") return "已完成收斂";
  if (status === "partial_consolidation") return "已收斂部分資料";
  return "待收斂";
}

function groupRows(rows = []) {
  return rows.reduce((acc, row) => {
    const key = row.group || "未分類";
    acc[key] = acc[key] || [];
    acc[key].push(row);
    return acc;
  }, {});
}

function CandidateList({ rows = [] }) {
  if (!rows.length) return <div style={{ color: "#94a3b8", fontWeight: 850 }}>目前沒有候選。</div>;
  return <div style={{ display: "grid", gap: 8 }}>
    {rows.map((row) => <div key={row.symbol} style={{ padding: 10, borderRadius: 14, background: "rgba(2,6,23,.45)", border: "1px solid rgba(148,163,184,.18)", color: "#cbd5e1", fontWeight: 850 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <strong style={{ color: "#f8fafc" }}>{row.symbol}</strong>
        <span style={{ color: "#fde68a", fontSize: 12 }}>{row.totalScore !== null && row.totalScore !== undefined ? `${row.totalScore}分` : "未評分"}</span>
      </div>
      <div style={{ marginTop: 5, color: "#94a3b8", fontSize: 12 }}>{row.name || row.bucket || "—"}</div>
    </div>)}
  </div>;
}

function PositionList({ rows = [] }) {
  if (!rows.length) return <div style={{ color: "#94a3b8", fontWeight: 850 }}>目前沒有紙上交易部位。</div>;
  const groups = groupRows(rows);
  return <div style={{ display: "grid", gap: 12 }}>
    {Object.entries(groups).map(([group, items]) => <div key={group}>
      <div style={{ color: "#bfdbfe", fontWeight: 1000, marginBottom: 6 }}>{group}（{items.length}）</div>
      <div style={{ display: "grid", gap: 8 }}>
        {items.map((row) => <div key={row.id} style={{ padding: 10, borderRadius: 14, background: "rgba(2,6,23,.45)", border: "1px solid rgba(148,163,184,.18)", color: "#cbd5e1", fontWeight: 850 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <strong style={{ color: "#f8fafc" }}>{row.symbol} {row.tier}</strong>
            <span style={{ color: Number(row.pnl || 0) >= 0 ? "#bbf7d0" : "#fecaca" }}>{n((row.pnlPct || 0) * 100)}%</span>
          </div>
          <div style={{ marginTop: 5, fontSize: 12 }}>買入價 ${n(row.price, 4)}｜現價 ${n(row.currentPrice, 4)}｜成本 ${n(row.amountUSDT)}｜市值 ${n(row.currentValue)}｜損益 ${n(row.pnl)}</div>
          <div style={{ marginTop: 4, color: "#94a3b8", fontSize: 11 }}>{row.trigger}｜{row.source}</div>
        </div>)}
      </div>
    </div>)}
  </div>;
}

export default function PaperAutoPage() {
  const [summary, setSummary] = useState(null);
  const [lastRun, setLastRun] = useState(null);
  const [market45, setMarket45] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setBusy(true);
    setError("");
    try {
      const prices = await fetchJson(`/api/prices?t=${Date.now()}`);
      const markets = marketMapFromRows(prices.data || []);
      const [paper, review] = await Promise.all([
        fetchJson("/api/v17/paper-summary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ markets }) }),
        fetchJson("/api/v17/market-45-review"),
      ]);
      setSummary(paper);
      setMarket45(review);
    } catch (err) {
      setError(err.message || "讀取失敗");
    } finally {
      setBusy(false);
    }
  }

  async function runPaper() {
    setBusy(true);
    setError("");
    try {
      const prices = await fetchJson(`/api/prices?t=${Date.now()}`);
      const markets = marketMapFromRows(prices.data || []);
      const result = await fetchJson("/api/v17/paper-auto-run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ markets }) });
      setLastRun(result);
      await load();
    } catch (err) {
      setError(err.message || "執行失敗");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { load(); }, []);

  const s = summary?.summary || {};
  const pnlColor = Number(s.pnl || 0) >= 0 ? "#bbf7d0" : "#fecaca";
  const market45Candidates = summary?.market45PaperCandidates || market45?.buckets?.["紙上交易候選"] || [];

  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "linear-gradient(180deg,#020617 0%,#07111f 55%,#0f172a 100%)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "22px 14px 40px" }}>
      <a href="/v17" style={{ color: "#93c5fd", textDecoration: "none", fontWeight: 900 }}>← 返回折價獵人 V17</a>
      <header style={{ marginTop: 18, marginBottom: 18 }}>
        <div style={{ color: "#22c55e", letterSpacing: 3, fontWeight: 1000, fontSize: 13 }}>V17 紙上交易自動測試</div>
        <h1 style={{ fontSize: 34, lineHeight: 1.05, margin: "10px 0", fontWeight: 1000 }}>紙上交易自動測試</h1>
        <p style={{ color: "#cbd5e1", lineHeight: 1.55, fontWeight: 850, margin: 0 }}>既有 V17 十檔 + Market 45 紙上候選 5 檔一起跑 7 天紙上交易。這裡不會送出任何真實訂單。</p>
      </header>

      {error && <Box title="錯誤" tone="red"><div style={{ color: "#fecaca", fontWeight: 850 }}>{error}</div></Box>}

      <Box title="目前規則" tone="green">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, color: "#cbd5e1", fontWeight: 850 }}>
          <div>模式：{summary?.settings?.mode || "AUTO_PAPER"}</div>
          <div>測試天數：{summary?.settings?.testDays || 7} 天</div>
          <div>既有V17：{s.existingTenCount || 10} 檔</div>
          <div>Market45：{s.market45CandidateCount || market45Candidates.length || 0} 檔</div>
          <div>每筆金額：{summary?.settings?.perTradeUSDT || 5}U</div>
          <div>每日上限：{summary?.settings?.dailyMaxTrades || 15} 筆</div>
          <div>真實下單：禁止</div>
          <div>測試建倉：允許</div>
        </div>
      </Box>

      <Box title="紙上交易績效" tone="blue">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, color: "#cbd5e1", fontWeight: 850 }}>
          <div>累積筆數：{s.totalTrades || 0}</div>
          <div>開放部位：{s.openTrades || 0}</div>
          <div>投入成本：${n(s.cost)}</div>
          <div>目前市值：${n(s.value)}</div>
          <div>損益：<strong style={{ color: pnlColor }}>${n(s.pnl)}</strong></div>
          <div>報酬率：<strong style={{ color: pnlColor }}>{n((s.pnlPct || 0) * 100)}%</strong></div>
        </div>
      </Box>

      <Box title="操作">
        <button disabled={busy} onClick={runPaper} style={{ width: "100%", padding: "13px 10px", borderRadius: 14, border: "1px solid rgba(34,197,94,.45)", background: "rgba(34,197,94,.18)", color: "#bbf7d0", fontWeight: 1000 }}>今天跑一次紙上交易</button>
        <button disabled={busy} onClick={load} style={{ width: "100%", marginTop: 8, padding: "12px 10px", borderRadius: 14, border: "1px solid rgba(59,130,246,.35)", background: "rgba(59,130,246,.12)", color: "#bfdbfe", fontWeight: 1000 }}>重新整理</button>
        {lastRun && <div style={{ marginTop: 10, color: "#bbf7d0", fontWeight: 900 }}>本次可測 {lastRun.eligibleCount || 0} 檔，新增 {lastRun.createdCount} 筆，略過 {lastRun.skippedCount} 筆。</div>}
        {lastRun?.skipped?.length ? <div style={{ marginTop: 8, color: "#fde68a", fontSize: 12, fontWeight: 850, lineHeight: 1.45 }}>略過原因：{lastRun.skipped.slice(0, 6).map((x) => `${x.symbol}:${x.reason}`).join("；")}</div> : null}
      </Box>

      <Box title="45 檔收斂進度" tone="yellow">
        <div style={{ color: "#cbd5e1", fontWeight: 850, lineHeight: 1.6 }}>
          <div>總數：{market45?.total || 45} 檔</div>
          <div>已收斂：{market45?.covered || 0} 檔</div>
          <div>缺資料：{market45?.missingCount ?? 45} 檔</div>
          <div>狀態：{statusText(market45?.status)}</div>
          <div>紙上交易候選：{market45Candidates.length} 檔</div>
          <div>測試週期：7 天</div>
        </div>
      </Box>

      <Box title="Market45 紙上候選（5）" tone="green">
        <CandidateList rows={market45Candidates} />
      </Box>

      <Box title="紙上部位">
        <PositionList rows={summary?.positions || []} />
      </Box>
    </div>
  </main>;
}
