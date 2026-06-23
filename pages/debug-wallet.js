import { useEffect, useMemo, useState } from "react";

function n(value, digits = 6) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "--";
  return num.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function money(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "--";
  return `$${num.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function findHolding(data, symbol) {
  const target = String(symbol || "").toUpperCase();
  return (data?.holdings || []).find((h) => String(h.symbol || "").toUpperCase() === target) || null;
}

function joinList(value) {
  return Array.isArray(value) && value.length > 0 ? value.join(", ") : "--";
}

function jsonText(value) {
  if (value === undefined || value === null) return "--";
  return JSON.stringify(value, null, 2);
}

export default function DebugWallet() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadedAt, setLoadedAt] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/sync-wallet?t=${Date.now()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "sync-wallet failed");
      setData(json);
      setLoadedAt(new Date().toLocaleString());
    } catch (err) {
      setError(err.message || "debug load failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const amd = useMemo(() => findHolding(data, "AMDON"), [data]);
  const holdingSymbols = data?.holdings?.map((h) => h.symbol).join(", ") || "--";
  const calcTotalCost = useMemo(() => (data?.holdings || []).reduce((sum, h) => sum + Number(h.totalCost || 0), 0), [data]);
  const calcLiveTotalCost = useMemo(() => (data?.holdings || [])
    .filter((h) => Number(h.quantity) > 0 && h.quantitySource === "bsc_rpc_balanceOf_live")
    .reduce((sum, h) => sum + Number(h.totalCost || 0), 0), [data]);

  const dc = data?.debugCounts || {};
  const amdInLiveBalanceSymbols = (dc.liveBalanceSymbols || []).includes("AMDON");
  const amdInSelectedLiveBalanceSymbols = (dc.selectedLiveBalanceSymbols || []).includes("AMDON");
  const amdInMetadata = (dc.liveTokenMetadata || []).some((t) => String(t.symbol || "").toUpperCase() === "AMDON");
  const amdMetadata = (dc.liveTokenMetadata || []).filter((t) => String(t.symbol || "").toUpperCase() === "AMDON");
  const pipelineConclusion = amdInLiveBalanceSymbols
    ? amdInSelectedLiveBalanceSymbols
      ? "AMD reached selected live balances; check merge/holdings only if holdings still says NO."
      : "AMD reached liveBalanceSymbols but was removed by selectBestLiveContracts."
    : amdInMetadata
      ? "AMD metadata exists but liveBalanceSymbols is missing AMD: problem is inside fetchWalletBalancesViaRpc balance aggregation/RPC result."
      : "AMD metadata missing: problem is token list / verified contract / watchlist input before RPC.";

  const rowStyle = { display: "flex", justifyContent: "space-between", gap: 12, borderBottom: "1px solid rgba(255,255,255,.1)", padding: "9px 0" };
  const labelStyle = { color: "rgba(226,232,240,.72)", fontSize: 13 };
  const valueStyle = { color: "#f8fafc", fontSize: 13, fontWeight: 800, textAlign: "right", wordBreak: "break-all" };
  const preStyle = { margin: "8px 0 0", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12, color: "#cbd5e1" };

  return <main style={{ minHeight: "100vh", padding: 16, background: "#050816", color: "#f8fafc", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
    <h1 style={{ margin: "0 0 6px", color: "#facc15" }}>Wallet Debug</h1>
    <p style={{ margin: "0 0 14px", color: "rgba(226,232,240,.72)", fontSize: 13 }}>只用來驗證 sync-wallet，同步後截圖這頁。</p>
    <button onClick={load} disabled={loading} style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(250,204,21,.45)", background: loading ? "#334155" : "#854d0e", color: "#fff", fontWeight: 900 }}>
      {loading ? "同步中..." : "重新同步"}
    </button>
    {error && <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "rgba(239,68,68,.18)", color: "#fecaca" }}>{error}</div>}

    <section style={{ marginTop: 16, padding: 14, borderRadius: 16, background: "rgba(15,23,42,.92)", border: "1px solid rgba(250,204,21,.25)" }}>
      <h2 style={{ margin: "0 0 10px", fontSize: 18 }}>總表</h2>
      <div style={rowStyle}><span style={labelStyle}>loadedAt</span><span style={valueStyle}>{loadedAt || "--"}</span></div>
      <div style={rowStyle}><span style={labelStyle}>version</span><span style={valueStyle}>{data?.version || "--"}</span></div>
      <div style={rowStyle}><span style={labelStyle}>fullWalletAddress</span><span style={valueStyle}>{data?.fullWalletAddress || "--"}</span></div>
      <div style={rowStyle}><span style={labelStyle}>portfolioTotalCost</span><span style={valueStyle}>{money(data?.portfolioTotalCost)}</span></div>
      <div style={rowStyle}><span style={labelStyle}>actualTotalInvested</span><span style={valueStyle}>{money(data?.actualTotalInvested)}</span></div>
      <div style={rowStyle}><span style={labelStyle}>calc holdings totalCost</span><span style={valueStyle}>{money(calcTotalCost)}</span></div>
      <div style={rowStyle}><span style={labelStyle}>calc live totalCost</span><span style={valueStyle}>{money(calcLiveTotalCost)}</span></div>
      <div style={rowStyle}><span style={labelStyle}>holdingsCount</span><span style={valueStyle}>{data?.holdings?.length ?? "--"}</span></div>
      <div style={rowStyle}><span style={labelStyle}>debug holdingsCount</span><span style={valueStyle}>{dc.holdingsCount ?? "--"}</span></div>
      <div style={rowStyle}><span style={labelStyle}>liveBalanceHoldingsCount</span><span style={valueStyle}>{dc.liveBalanceHoldingsCount ?? "--"}</span></div>
      <div style={rowStyle}><span style={labelStyle}>estimatedCostBasisCount</span><span style={valueStyle}>{dc.estimatedCostBasisCount ?? "--"}</span></div>
      <div style={rowStyle}><span style={labelStyle}>estimatedCostBasisSymbols</span><span style={valueStyle}>{joinList(dc.estimatedCostBasisSymbols)}</span></div>
      <div style={rowStyle}><span style={labelStyle}>holdingSymbols</span><span style={valueStyle}>{holdingSymbols}</span></div>
    </section>

    <section style={{ marginTop: 16, padding: 14, borderRadius: 16, background: "rgba(15,23,42,.92)", border: "1px solid rgba(96,165,250,.45)" }}>
      <h2 style={{ margin: "0 0 10px", fontSize: 18 }}>Live Balance Pipeline</h2>
      <div style={rowStyle}><span style={labelStyle}>AMD in liveBalanceSymbols</span><span style={valueStyle}>{amdInLiveBalanceSymbols ? "YES" : "NO"}</span></div>
      <div style={rowStyle}><span style={labelStyle}>AMD in selectedLiveBalanceSymbols</span><span style={valueStyle}>{amdInSelectedLiveBalanceSymbols ? "YES" : "NO"}</span></div>
      <div style={rowStyle}><span style={labelStyle}>AMD in liveTokenMetadata</span><span style={valueStyle}>{amdInMetadata ? "YES" : "NO"}</span></div>
      <div style={rowStyle}><span style={labelStyle}>pipelineConclusion</span><span style={valueStyle}>{pipelineConclusion}</span></div>
      <div style={rowStyle}><span style={labelStyle}>liveBalanceSymbols</span><span style={valueStyle}>{joinList(dc.liveBalanceSymbols)}</span></div>
      <div style={rowStyle}><span style={labelStyle}>selectedLiveBalanceSymbols</span><span style={valueStyle}>{joinList(dc.selectedLiveBalanceSymbols)}</span></div>
      <div style={rowStyle}><span style={labelStyle}>liveBalanceErrors</span><span style={valueStyle}>{joinList(dc.liveBalanceErrors)}</span></div>
      <details style={{ marginTop: 10 }}><summary style={{ cursor: "pointer", color: "#bfdbfe", fontWeight: 900 }}>liveTokenMetadata JSON</summary><pre style={preStyle}>{jsonText(dc.liveTokenMetadata)}</pre></details>
      <details style={{ marginTop: 10 }}><summary style={{ cursor: "pointer", color: "#bfdbfe", fontWeight: 900 }}>AMD metadata only</summary><pre style={preStyle}>{jsonText(amdMetadata)}</pre></details>
    </section>

    <section style={{ marginTop: 16, padding: 14, borderRadius: 16, background: "rgba(15,23,42,.92)", border: amd ? "1px solid rgba(34,197,94,.45)" : "1px solid rgba(239,68,68,.45)" }}>
      <h2 style={{ margin: "0 0 10px", fontSize: 18 }}>AMDON</h2>
      <div style={rowStyle}><span style={labelStyle}>exists in holdings</span><span style={valueStyle}>{amd ? "YES" : "NO"}</span></div>
      <div style={rowStyle}><span style={labelStyle}>quantity</span><span style={valueStyle}>{n(amd?.quantity, 18)}</span></div>
      <div style={rowStyle}><span style={labelStyle}>totalCost</span><span style={valueStyle}>{money(amd?.totalCost)}</span></div>
      <div style={rowStyle}><span style={labelStyle}>rawTotalCost</span><span style={valueStyle}>{money(amd?.rawTotalCost)}</span></div>
      <div style={rowStyle}><span style={labelStyle}>currentValue</span><span style={valueStyle}>{money(amd?.currentValue)}</span></div>
      <div style={rowStyle}><span style={labelStyle}>costBasisSource</span><span style={valueStyle}>{amd?.costBasisSource || "--"}</span></div>
      <div style={rowStyle}><span style={labelStyle}>costBasisEstimated</span><span style={valueStyle}>{String(amd?.costBasisEstimated ?? "--")}</span></div>
      <div style={rowStyle}><span style={labelStyle}>costBasisWarning</span><span style={valueStyle}>{amd?.costBasisWarning || "--"}</span></div>
      <div style={rowStyle}><span style={labelStyle}>quantitySource</span><span style={valueStyle}>{amd?.quantitySource || "--"}</span></div>
      <div style={rowStyle}><span style={labelStyle}>liveBalanceContractAddress</span><span style={valueStyle}>{amd?.liveBalanceContractAddress || "--"}</span></div>
      <div style={rowStyle}><span style={labelStyle}>liveBalanceDetails</span><span style={valueStyle}>{amd?.liveBalanceDetails ? JSON.stringify(amd.liveBalanceDetails) : "--"}</span></div>
    </section>

    <section style={{ marginTop: 16, padding: 14, borderRadius: 16, background: "rgba(15,23,42,.92)", border: "1px solid rgba(148,163,184,.22)", overflowX: "auto" }}>
      <h2 style={{ margin: "0 0 10px", fontSize: 18 }}>逐檔成本</h2>
      <pre style={preStyle}>{JSON.stringify((data?.holdings || []).map((h) => ({ symbol: h.symbol, quantity: h.quantity, totalCost: h.totalCost, rawTotalCost: h.rawTotalCost, costBasisSource: h.costBasisSource, costBasisEstimated: h.costBasisEstimated })), null, 2)}</pre>
    </section>
  </main>;
}
