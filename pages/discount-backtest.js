import { useEffect, useState } from "react";

function Box({ title, children }) {
  return <section style={{ marginTop: 14, border: "1px solid rgba(148,163,184,.18)", background: "rgba(15,23,42,.76)", borderRadius: 22, padding: 16 }}>
    <h2 style={{ margin: "0 0 10px", color: "#f8fafc", fontSize: 18, fontWeight: 1000 }}>{title}</h2>
    {children}
  </section>;
}

function Pill({ children, color = "#38bdf8" }) {
  return <span style={{ color, border: `1px solid ${color}55`, background: `${color}14`, padding: "6px 10px", borderRadius: 999, fontWeight: 950, fontSize: 12 }}>{children}</span>;
}

function Row({ item }) {
  const danger = String(item.avg_max_adverse_252d || "").includes("-3") || String(item.avg_max_adverse_252d || "").includes("-2");
  return <section style={{ marginTop: 12, border: "1px solid rgba(148,163,184,.16)", background: "rgba(2,6,23,.45)", borderRadius: 18, padding: 14 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
      <div style={{ color: "#f8fafc", fontSize: 24, fontWeight: 1000 }}>{item.ticker}</div>
      <Pill color={item.grade === "C" || item.grade === "C+" ? "#f97316" : "#22c55e"}>{item.grade || "—"}</Pill>
    </div>
    <div style={{ marginTop: 8, color: "#fbbf24", fontWeight: 1000, fontSize: 18 }}>{item.finalRule}</div>
    <div style={{ marginTop: 8, color: "#cbd5e1", lineHeight: 1.55, fontWeight: 850 }}>{item.decision}</div>
    <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, color: "#cbd5e1", fontSize: 13, fontWeight: 850 }}>
      <div>最佳模型：{item.scheme}</div>
      <div>事件：{item.events}</div>
      <div>252日均值：<span style={{ color: "#4ade80" }}>{item.avg_ret_252d || "—"}</span></div>
      <div>252日勝率：<span style={{ color: "#4ade80" }}>{item.win_rate_ret_252d || "—"}</span></div>
      <div style={{ gridColumn: "1 / -1" }}>平均最大不利：<span style={{ color: danger ? "#f87171" : "#fbbf24" }}>{item.avg_max_adverse_252d || "—"}</span></div>
    </div>
  </section>;
}

export default function DiscountBacktest() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    fetch("/api/discount-backtest").then((r) => r.json()).then((j) => j.ok ? setData(j) : setError(j.error || "讀取失敗")).catch((e) => setError(e.message));
  }, []);
  const best = data?.best || [];
  return <main style={{ minHeight: "100vh", background: "linear-gradient(180deg,#020617 0%,#07111f 55%,#0f172a 100%)", color: "#f8fafc", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "22px 14px 40px" }}>
      <a href="/" style={{ color: "#93c5fd", textDecoration: "none", fontWeight: 900 }}>← 返回首頁</a>
      <header style={{ marginTop: 18, marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ color: "#38bdf8", letterSpacing: 3, fontWeight: 1000, fontSize: 13 }}>DCA 折價獵人 V18.1</div>
          <Pill color="#f59e0b">回測結論</Pill>
        </div>
        <h1 style={{ fontSize: 36, lineHeight: 1.05, margin: "10px 0", fontWeight: 1000 }}>資產類型分層表</h1>
        <p style={{ color: "#cbd5e1", lineHeight: 1.55, fontWeight: 850, margin: 0 }}>跌幅買點不再一套規則打全部。App 現有買點已依回測結果更新。</p>
      </header>
      {error && <Box title="讀取失敗"><div style={{ color: "#fecaca" }}>{error}</div></Box>}
      {!data && !error && <Box title="讀取中"><div style={{ color: "#94a3b8" }}>讀取回測總覽中…</div></Box>}
      {data && <>
        <Box title="核心結論"><div style={{ color: "#cbd5e1", lineHeight: 1.7, fontWeight: 850 }}>{data.conclusion}</div></Box>
        <Box title="四大規則">
          <div style={{ display: "grid", gap: 8, color: "#cbd5e1", lineHeight: 1.6, fontWeight: 900 }}>
            <div>ETF / QQQ：可以淺買。</div>
            <div>AI 基建：要中深買。</div>
            <div>高波動成長：要深買、少出手。</div>
            <div>BTC：要週期買，不套股票規則。</div>
          </div>
        </Box>
        <Box title="標的買點總覽">
          {best.map((item) => <Row key={item.ticker} item={item} />)}
        </Box>
      </>}
    </div>
  </main>;
}
