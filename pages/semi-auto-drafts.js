import { useEffect, useState } from "react";

function Box({ title, children }) {
  return <section style={{ marginTop: 14, border: "1px solid rgba(148,163,184,.18)", background: "rgba(15,23,42,.76)", borderRadius: 22, padding: 16 }}>
    <h2 style={{ margin: "0 0 10px", color: "#f8fafc", fontSize: 18, fontWeight: 1000 }}>{title}</h2>
    {children}
  </section>;
}

function DraftCard({ draft }) {
  async function copy() {
    try { await navigator.clipboard.writeText(draft.copyText || ""); } catch {}
  }
  return <section style={{ marginTop: 12, border: "1px solid rgba(245,158,11,.28)", background: "rgba(2,6,23,.48)", borderRadius: 18, padding: 14 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
      <div style={{ color: "#f8fafc", fontSize: 24, fontWeight: 1000 }}>{draft.symbol}</div>
      <div style={{ color: "#fbbf24", fontWeight: 1000 }}>{draft.tier}</div>
    </div>
    <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, color: "#cbd5e1", fontSize: 13, fontWeight: 850 }}>
      <div>金額：{Number(draft.amountUsd || 0).toFixed(2)} USDT</div>
      <div>價格：${Number(draft.price || 0).toFixed(4)}</div>
      <div>估算數量：{Number(draft.estimatedQty || 0).toFixed(8)}</div>
      <div>跌幅：{draft.discountText || "—"}</div>
    </div>
    <details style={{ marginTop: 12, color: "#cbd5e1", fontSize: 12, lineHeight: 1.6, fontWeight: 850 }}>
      <summary style={{ color: "#bae6fd", fontWeight: 1000 }}>檢查清單</summary>
      <ul>{(draft.checklist || []).map((x) => <li key={x}>{x}</li>)}</ul>
    </details>
    <pre style={{ marginTop: 12, whiteSpace: "pre-wrap", color: "#e2e8f0", background: "rgba(15,23,42,.8)", border: "1px solid rgba(148,163,184,.18)", borderRadius: 14, padding: 12, fontSize: 12, lineHeight: 1.55 }}>{draft.copyText}</pre>
    <button onClick={copy} style={{ marginTop: 10, width: "100%", padding: "12px 10px", borderRadius: 14, border: "1px solid rgba(34,197,94,.45)", background: "rgba(34,197,94,.16)", color: "#bbf7d0", fontWeight: 1000 }}>複製下單草稿</button>
  </section>;
}

export default function SemiAutoDrafts() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    async function run() {
      try {
        const prices = await fetch(`/api/prices?t=${Date.now()}`, { cache: "no-store" }).then((r) => r.json());
        const rows = Array.isArray(prices.data) ? prices.data : [];
        const markets = Object.fromEntries(rows.map((row) => [row.symbol, { symbol: row.symbol, price: row.price, high: row.high, cycleHigh: row.high || row.cycleHigh, discount: row.discount }]));
        const drafts = await fetch(`/api/v17/semi-auto-drafts?t=${Date.now()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ markets }) }).then((r) => r.json());
        if (!drafts.ok) throw new Error(drafts.error || "讀取失敗");
        setData(drafts);
      } catch (e) {
        setError(e.message || "讀取失敗");
      }
    }
    run();
  }, []);
  const drafts = data?.drafts || [];
  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "linear-gradient(180deg,#020617 0%,#07111f 55%,#0f172a 100%)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "22px 14px 40px" }}>
      <a href="/v17" style={{ color: "#93c5fd", textDecoration: "none", fontWeight: 900 }}>← 返回折價獵人</a>
      <header style={{ marginTop: 18, marginBottom: 18 }}>
        <div style={{ color: "#f59e0b", letterSpacing: 3, fontWeight: 1000, fontSize: 13 }}>V18.1 SEMI-AUTO</div>
        <h1 style={{ fontSize: 36, lineHeight: 1.05, margin: "10px 0", fontWeight: 1000 }}>半自動下單草稿</h1>
        <p style={{ color: "#cbd5e1", lineHeight: 1.55, fontWeight: 850, margin: 0 }}>只產生可複製草稿，不連交易 API、不自動下單。實際交易必須由你在 Binance 手動確認。</p>
      </header>
      {error && <Box title="讀取失敗"><div style={{ color: "#fecaca" }}>{error}</div></Box>}
      {!data && !error && <Box title="讀取中"><div style={{ color: "#94a3b8" }}>產生半自動草稿中…</div></Box>}
      {data && <>
        <Box title="安全邊界"><div style={{ color: "#cbd5e1", lineHeight: 1.7, fontWeight: 850 }}>草稿數：{data.draftCount}｜總金額：{Number(data.totalDraftAmountUsd || 0).toFixed(2)} USDT<br />Auto Trade：OFF｜Manual Confirm：ON｜Kill Switch：ON</div></Box>
        {drafts.length === 0 ? <Box title="目前沒有草稿"><div style={{ color: "#94a3b8", lineHeight: 1.6, fontWeight: 850 }}>沒有進入買點的標的，或目前買點已被略過 / 完成。</div></Box> : drafts.map((draft) => <DraftCard key={`${draft.symbol}-${draft.tier}`} draft={draft} />)}
      </>}
    </div>
  </main>;
}
