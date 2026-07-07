import { useEffect, useState } from "react";

export default function HighVolWatch() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    fetch("/api/crypto-watch-backtest")
      .then((r) => r.json())
      .then((j) => (j.ok ? setData(j) : setError(j.error || "讀取失敗")))
      .catch((e) => setError(e.message));
  }, []);
  const events = data?.events || [];
  const tickers = data?.tickers || [];
  return <main style={{ minHeight: "100vh", background: "#020617", color: "#f8fafc", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 460, margin: "0 auto", padding: 18 }}>
      <a href="/" style={{ color: "#93c5fd", textDecoration: "none", fontWeight: 900 }}>← 返回首頁</a>
      <h1 style={{ fontSize: 34, margin: "18px 0 8px" }}>高波動觀察組</h1>
      <p style={{ color: "#cbd5e1", lineHeight: 1.6, fontWeight: 850 }}>MUSDT / BPUSDT 回撤分層研究。此頁只呈現研究資料。</p>
      {error && <div style={{ marginTop: 16, color: "#fecaca" }}>讀取失敗：{error}</div>}
      {!data && !error && <div style={{ marginTop: 16, color: "#94a3b8" }}>讀取中…</div>}
      {data && <>
        <section style={{ marginTop: 16, border: "1px solid #f59e0b55", borderRadius: 20, padding: 14, background: "#0f172a" }}>
          <div style={{ color: "#fbbf24", fontWeight: 1000 }}>規則</div>
          <div style={{ color: "#cbd5e1", marginTop: 8, lineHeight: 1.6 }}>{data.rule}</div>
          <div style={{ color: "#94a3b8", marginTop: 8, lineHeight: 1.6 }}>{data.conclusion}</div>
        </section>
        <section style={{ marginTop: 16, border: "1px solid #334155", borderRadius: 20, padding: 14, background: "#0f172a" }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>標的狀態</h2>
          {tickers.map((t) => <div key={t.ticker} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #1e293b", color: "#cbd5e1", fontWeight: 850 }}><span style={{ color: "#fff", fontWeight: 1000 }}>{t.ticker}</span><span>{t.events} 次</span><span>{t.dataStatus}</span></div>)}
        </section>
        <section style={{ marginTop: 16, border: "1px solid #334155", borderRadius: 20, padding: 14, background: "#0f172a" }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>事件</h2>
          {events.map((r, i) => <div key={i} style={{ padding: "12px 0", borderBottom: "1px solid #1e293b", color: "#cbd5e1", lineHeight: 1.6, fontWeight: 850 }}>
            <div style={{ color: "#fff", fontWeight: 1000 }}>{r.ticker}｜{String(r.date || "").slice(0, 10)}｜{r.layer}</div>
            <div>距高點：{r.drawdown}｜7日：{r.ret_7d || "—"}｜30日：{r.ret_30d || "—"}｜最大不利：{r.max_adverse_90d || "—"}</div>
          </div>)}
        </section>
      </>}
    </div>
  </main>;
}
