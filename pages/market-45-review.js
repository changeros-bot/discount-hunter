import { useEffect, useState } from "react";

function Box({ title, children, tone = "blue" }) {
  const border = tone === "green" ? "rgba(34,197,94,.38)" : tone === "red" ? "rgba(248,113,113,.36)" : tone === "yellow" ? "rgba(245,158,11,.34)" : "rgba(59,130,246,.30)";
  return <section style={{ marginTop: 14, border: `1px solid ${border}`, background: "rgba(15,23,42,.78)", borderRadius: 22, padding: 16 }}>
    <h2 style={{ margin: "0 0 10px", color: "#f8fafc", fontSize: 18, fontWeight: 1000 }}>{title}</h2>
    {children}
  </section>;
}

function statusText(status) {
  if (status === "final_screened") return "最終篩選完成";
  if (status === "partial_consolidation") return "已收斂部分資料";
  if (status === "consolidated") return "已完成收斂";
  return "待收斂";
}

function RowCard({ row, final = false }) {
  return <div style={{ padding: 10, borderRadius: 12, background: "rgba(2,6,23,.45)", border: "1px solid rgba(148,163,184,.14)", marginTop: 8 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
      <div>
        <strong style={{ color: "#f8fafc", fontSize: 15 }}>{row.symbol || row.name}</strong>
        {row.name && row.name !== row.symbol ? <span style={{ color: "#94a3b8", marginLeft: 6, fontSize: 12 }}>{row.name}</span> : null}
      </div>
      <div style={{ color: "#fde68a", fontWeight: 1000, fontSize: 12 }}>{row.totalScore !== null && row.totalScore !== undefined ? `${row.totalScore}分` : "未評分"}</div>
    </div>
    <div style={{ marginTop: 5, display: "flex", flexWrap: "wrap", gap: 5 }}>
      {final && row.finalRank ? <span style={{ color: "#f8fafc", background: "rgba(245,158,11,.16)", padding: "4px 7px", borderRadius: 999, fontSize: 11, fontWeight: 1000 }}>#{row.finalRank}</span> : null}
      {row.finalBucket ? <span style={{ color: "#bbf7d0", background: "rgba(34,197,94,.12)", padding: "4px 7px", borderRadius: 999, fontSize: 11, fontWeight: 1000 }}>{row.finalBucket}</span> : null}
      {row.bucket ? <span style={{ color: "#bfdbfe", background: "rgba(59,130,246,.12)", padding: "4px 7px", borderRadius: 999, fontSize: 11, fontWeight: 900 }}>{row.bucket}</span> : null}
      {row.quality ? <span style={{ color: "#bbf7d0", background: "rgba(34,197,94,.12)", padding: "4px 7px", borderRadius: 999, fontSize: 11, fontWeight: 900 }}>{row.quality}</span> : null}
      {row.tier ? <span style={{ color: "#ddd6fe", background: "rgba(168,85,247,.12)", padding: "4px 7px", borderRadius: 999, fontSize: 11, fontWeight: 900 }}>{row.tier}</span> : null}
    </div>
    <div style={{ marginTop: 7, color: "#cbd5e1", fontSize: 12, fontWeight: 850, lineHeight: 1.5 }}>{row.finalDecision || row.decision || row.reason || "—"}</div>
    {row.realTradeBlockedReason ? <div style={{ marginTop: 5, color: "#fecaca", fontSize: 11, fontWeight: 900, lineHeight: 1.45 }}>真實交易：禁止｜{row.realTradeBlockedReason}</div> : null}
    {row.rule ? <div style={{ marginTop: 5, color: "#94a3b8", fontSize: 11, fontWeight: 800, lineHeight: 1.45 }}>規則：{row.rule}</div> : null}
  </div>;
}

export default function Market45Review() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      const res = await fetch(`/api/v17/market-45-review?t=${Date.now()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error || "讀取失敗");
      setData(json);
    } catch (err) {
      setError(err.message || "讀取失敗");
    }
  }

  useEffect(() => { load(); }, []);

  const buckets = data?.buckets || {};
  const summary = data?.summary || {};
  const finalBuckets = data?.finalBuckets || {};
  const finalSummary = data?.finalSummary || {};
  const useFinal = Boolean(data?.finalScreened);
  const visibleBuckets = useFinal ? finalBuckets : buckets;
  const visibleSummary = useFinal ? finalSummary : summary;

  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "linear-gradient(180deg,#020617 0%,#07111f 55%,#0f172a 100%)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "22px 14px 40px" }}>
      <a href="/v17" style={{ color: "#93c5fd", textDecoration: "none", fontWeight: 900 }}>← 返回折價獵人 V17</a>
      <header style={{ marginTop: 18, marginBottom: 18 }}>
        <div style={{ color: "#22c55e", letterSpacing: 3, fontWeight: 1000, fontSize: 13 }}>Market 45 最終篩選</div>
        <h1 style={{ fontSize: 34, lineHeight: 1.05, margin: "10px 0", fontWeight: 1000 }}>45 檔最終篩選結果</h1>
        <p style={{ color: "#cbd5e1", lineHeight: 1.55, fontWeight: 850, margin: 0 }}>45 檔完成收斂後，固定 5 檔進 7 天紙上交易、10 檔進正式觀察，其餘不進自動化。</p>
      </header>
      {error && <Box title="錯誤" tone="red"><div style={{ color: "#fecaca", fontWeight: 850 }}>{error}</div></Box>}
      <Box title="完成狀態" tone={useFinal ? "green" : "yellow"}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, color: "#cbd5e1", fontWeight: 850, lineHeight: 1.6 }}>
          <div>總數：{data?.total || 45} 檔</div>
          <div>已收斂：{data?.covered || 0} 檔</div>
          <div>缺資料：{data?.missingCount ?? 45} 檔</div>
          <div>狀態：{statusText(data?.status)}</div>
          <div>紙上交易：{finalSummary["紙上交易測試"] ?? "—"} 檔</div>
          <div>正式觀察：{finalSummary["正式觀察"] ?? "—"} 檔</div>
        </div>
        {data?.completionText ? <div style={{ marginTop: 10, color: "#bbf7d0", fontWeight: 900, lineHeight: 1.5 }}>{data.completionText}</div> : null}
        {data?.finalRules?.rule ? <div style={{ marginTop: 8, color: "#fde68a", fontWeight: 850, lineHeight: 1.5 }}>{data.finalRules.rule}</div> : null}
      </Box>
      <Box title="最終分類統計" tone="blue">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, color: "#cbd5e1", fontWeight: 850 }}>
          {Object.entries(visibleSummary).map(([key, value]) => <div key={key}>{key}：<strong style={{ color: "#f8fafc" }}>{value}</strong></div>)}
        </div>
      </Box>
      {Object.entries(visibleBuckets).map(([name, rows]) => <Box key={name} title={`${name}（${rows.length}）`} tone={name === "紙上交易測試" ? "green" : name === "正式觀察" ? "blue" : name === "缺資料" ? "yellow" : rows.length ? "blue" : "blue"}>
        {rows.length ? rows.map((row) => <RowCard key={row.symbol || row.name} row={row} final={useFinal} />) : <div style={{ color: "#94a3b8", fontWeight: 850 }}>無。</div>}
      </Box>)}
      <Box title="入口">
        <a href="/paper-auto" style={{ color: "#bbf7d0", fontWeight: 1000, textDecoration: "none" }}>紙上交易自動測試</a>
      </Box>
    </div>
  </main>;
}
