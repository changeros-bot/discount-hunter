import { useEffect, useState } from "react";

function usd(n) {
  const x = Number(n || 0);
  return `$${x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function qty(n) {
  const x = Number(n || 0);
  return x.toLocaleString("en-US", { maximumFractionDigits: 8 });
}
function shortHash(hash) {
  if (!hash) return "—";
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}
function tone(status) {
  if (status === "CHAIN_COST_FOUND") return { color: "#86efac", bg: "rgba(34,197,94,.12)", border: "rgba(34,197,94,.35)", label: "PASS" };
  if (status === "TRANSFER_IN_ONLY_NO_COST") return { color: "#fde68a", bg: "rgba(245,158,11,.12)", border: "rgba(245,158,11,.35)", label: "NO COST" };
  return { color: "#cbd5e1", bg: "rgba(148,163,184,.10)", border: "rgba(148,163,184,.25)", label: "NONE" };
}

export default function V17CostDiagnosticsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/v17/xstocks-cost-diagnostics?t=${Date.now()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error || `HTTP ${res.status}`);
      setData(json);
    } catch (e) {
      setError(e.message || "diagnostics failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const rows = data?.bySymbol || [];
  const found = rows.filter((r) => r.costStatus === "CHAIN_COST_FOUND").length;
  const transferOnly = rows.filter((r) => r.costStatus === "TRANSFER_IN_ONLY_NO_COST").length;

  return <main style={{ minHeight: "100vh", background: "linear-gradient(180deg,#020617,#0f172a)", color: "#f8fafc", padding: 14, fontFamily: "system-ui,-apple-system,BlinkMacSystemFont,'Noto Sans TC',sans-serif" }}>
    <section style={{ maxWidth: 520, margin: "0 auto", paddingBottom: 40 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 1000 }}>V17 成本診斷</h1>
          <div style={{ color: "#94a3b8", marginTop: 6, fontSize: 13, fontWeight: 800 }}>只查資料層，不改主頁</div>
        </div>
        <button onClick={load} style={{ border: "1px solid rgba(56,189,248,.35)", background: "rgba(56,189,248,.12)", color: "#bae6fd", borderRadius: 12, padding: "9px 12px", fontWeight: 950 }}>{loading ? "讀取中" : "刷新"}</button>
      </header>

      {error ? <div style={{ padding: 12, borderRadius: 14, background: "rgba(127,29,29,.35)", color: "#fecaca", marginBottom: 12 }}>{error}</div> : null}

      <section style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 12 }}>
        <div style={metricStyle()}><div>鏈上成本</div><strong>{found}</strong></div>
        <div style={metricStyle()}><div>轉入無成本</div><strong>{transferOnly}</strong></div>
        <div style={metricStyle()}><div>Transfers</div><strong>{data?.counts?.uniqueTransfers ?? "—"}</strong></div>
      </section>

      <section style={cardStyle()}>
        <h2 style={h2Style()}>資料源</h2>
        <div style={lineStyle()}>Wallet：{data?.walletAddress || "—"}</div>
        <div style={lineStyle()}>Moralis：{String(data?.configured?.moralis ?? "—")}</div>
        <div style={lineStyle()}>MegaNode / NodeReal：{String(data?.configured?.megaNode ?? "—")}</div>
        <div style={lineStyle()}>BscScan：{String(data?.configured?.bscscan ?? "—")}</div>
        <div style={lineStyle()}>Buy Records：{data?.counts?.buyRecords ?? "—"}</div>
        <div style={lineStyle()}>Transfer-in Records：{data?.counts?.transferInRecords ?? "—"}</div>
      </section>

      {rows.map((r) => {
        const t = tone(r.costStatus);
        return <section key={r.symbol} style={{ ...cardStyle(), borderColor: t.border }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <h2 style={{ ...h2Style(), marginBottom: 0 }}>{r.symbol}</h2>
            <span style={{ color: t.color, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 999, padding: "5px 9px", fontSize: 12, fontWeight: 1000 }}>{t.label}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
            <div style={boxStyle()}><div>鏈上成本</div><strong>{usd(r.chainCostUsd)}</strong></div>
            <div style={boxStyle()}><div>鏈上買入量</div><strong>{qty(r.chainQuantity)}</strong></div>
            <div style={boxStyle()}><div>轉入量</div><strong>{qty(r.transferInQuantity)}</strong></div>
            <div style={boxStyle()}><div>Buy / Transfer</div><strong>{r.buyCount} / {r.transferInCount}</strong></div>
          </div>
          {r.costStatus !== "CHAIN_COST_FOUND" ? <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: "rgba(245,158,11,.10)", color: "#fde68a", fontSize: 13, lineHeight: 1.55 }}>
            這檔目前沒有找到同一 tx hash 的 stablecoin OUT + xStock IN，所以鏈上無法證明買入成本。
          </div> : null}
          <details style={{ marginTop: 10 }}>
            <summary style={{ color: "#93c5fd", fontWeight: 900 }}>查看 tx hash</summary>
            {(r.txs || []).map((tx) => <div key={tx.hash} style={{ marginTop: 10, padding: 10, borderRadius: 12, background: "rgba(15,23,42,.72)", border: "1px solid rgba(148,163,184,.16)", fontSize: 12, lineHeight: 1.55 }}>
              <div style={{ color: "#e2e8f0", fontWeight: 950 }}>{shortHash(tx.hash)}</div>
              <div>stable OUT：{usd(tx.stableOutUsd)}</div>
              <div>xStock IN：{tx.xstockInflows.map((x) => `${x.symbol} ${qty(x.amount)}`).join("、") || "—"}</div>
              <div>狀態：{tx.buyCandidate ? "BUY 可計成本" : "缺同 tx 穩定幣流出"}</div>
            </div>)}
          </details>
        </section>;
      })}
    </section>
  </main>;
}

function metricStyle() { return { padding: 12, borderRadius: 16, background: "rgba(15,23,42,.88)", border: "1px solid rgba(148,163,184,.18)", color: "#94a3b8", fontSize: 12, fontWeight: 800 }; }
function cardStyle() { return { padding: 14, borderRadius: 18, background: "rgba(15,23,42,.90)", border: "1px solid rgba(148,163,184,.18)", marginBottom: 12 }; }
function boxStyle() { return { padding: 10, borderRadius: 12, background: "rgba(2,6,23,.45)", color: "#94a3b8", fontSize: 12, fontWeight: 850 }; }
function h2Style() { return { margin: "0 0 10px", fontSize: 18, fontWeight: 1000 }; }
function lineStyle() { return { color: "#cbd5e1", fontSize: 13, margin: "5px 0" }; }
