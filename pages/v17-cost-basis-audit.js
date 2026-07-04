import { useEffect, useState } from "react";

function tone(status) {
  if (["PASS", "PASS_API_SYNCED"].includes(status)) return { color: "#86efac", border: "rgba(34,197,94,.35)", bg: "rgba(34,197,94,.12)" };
  if (["PARTIAL_COST_BASIS", "ONLY_TRANSFER_IN_NO_BUY_PATTERN", "NO_BUY_RECORDS", "TRANSFER_API_RETURNED_ZERO", "ZERO", "OFF"].includes(status)) return { color: "#fde68a", border: "rgba(245,158,11,.35)", bg: "rgba(245,158,11,.12)" };
  return { color: "#fca5a5", border: "rgba(239,68,68,.35)", bg: "rgba(239,68,68,.12)" };
}
function Card({ children, style }) { return <section style={{ background: "rgba(17,24,39,.92)", border: "1px solid rgba(148,163,184,.18)", borderRadius: 22, padding: 16, marginBottom: 12, boxShadow: "0 12px 34px rgba(0,0,0,.26)", ...style }}>{children}</section>; }
function Title({ title, right }) { return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12 }}><h2 style={{ margin: 0, fontSize: 18, fontWeight: 1000 }}>{title}</h2>{right ? <span style={{ color: "#94a3b8", fontSize: 12, fontWeight: 850 }}>{right}</span> : null}</div>; }
function Row({ title, sub, value, status }) { const t = tone(status); return <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center", borderBottom: "1px solid rgba(148,163,184,.12)", padding: "11px 0" }}><div><div style={{ fontSize: 14, fontWeight: 950 }}>{title}</div>{sub ? <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4, lineHeight: 1.4 }}>{sub}</div> : null}</div><div style={{ color: status ? t.color : "#f8fafc", fontSize: 14, fontWeight: 1000, whiteSpace: "nowrap" }}>{value}</div></div>; }

export default function CostBasisAuditPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/v17/xstocks-cost-basis-audit?t=${Date.now()}`, { cache: "no-store" });
      const json = await res.json();
      setData(json);
      setError("");
    } catch (err) {
      setError(err.message || "Audit failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  const t = tone(data?.status);

  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "linear-gradient(180deg,#020617 0%,#0f172a 55%,#111827 100%)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 430, margin: "0 auto", padding: "18px 14px 40px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 900 }}>V17 Cost Basis Audit</div>
          <h1 style={{ margin: "5px 0 0", fontSize: 27, lineHeight: 1.1, fontWeight: 1000 }}>xStocks 成本診斷</h1>
        </div>
        <a href="/v17" style={{ color: "#bae6fd", textDecoration: "none", border: "1px solid rgba(56,189,248,.35)", borderRadius: 999, padding: "7px 10px", fontSize: 12, fontWeight: 950 }}>返回 V17</a>
      </header>

      {error ? <Card style={{ borderColor: "rgba(239,68,68,.45)", color: "#fca5a5" }}>{error}</Card> : null}

      <Card style={{ borderColor: t.border }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
          <h2 style={{ margin: 0, color: t.color, fontSize: 20, fontWeight: 1000 }}>{data?.status || "LOADING"}</h2>
          <button onClick={load} disabled={loading} style={{ border: `1px solid ${t.border}`, background: t.bg, color: t.color, borderRadius: 999, padding: "7px 10px", fontSize: 12, fontWeight: 950 }}>{loading ? "檢查中" : "重新檢查"}</button>
        </div>
        <div style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.7, fontWeight: 800, marginTop: 10 }}>{data?.diagnosis || "正在讀取 cost basis audit..."}</div>
      </Card>

      <Card>
        <Title title="來源設定" right={data?.walletAddress || "wallet"} />
        <Row title="WALLET_ADDRESS" value={data?.walletConfigured ? "PASS" : "FAIL"} status={data?.walletConfigured ? "PASS" : "FAIL"} />
        <Row title="Moralis" value={data?.moralisConfigured ? "ON" : "OFF"} status={data?.moralisConfigured ? "PASS" : "OFF"} />
        <Row title="MegaNode / NodeReal" value={data?.megaNodeConfigured ? "ON" : "OFF"} status={data?.megaNodeConfigured ? "PASS" : "OFF"} />
        <Row title="BscScan / Etherscan V2" value={data?.bscScanConfigured ? "ON" : "OFF"} status={data?.bscScanConfigured ? "PASS" : "OFF"} />
        <Row title="最後使用來源" sub="有資料的第一個 transfer source" value={data?.transferSourceUsed || "—"} status={data?.transferSourceUsed && data.transferSourceUsed !== "none" ? "PASS" : "ZERO"} />
        <Row title="規則" sub="同一 tx hash 內 stablecoin OUT + xStock IN 才算 BUY" value="STRICT" />
      </Card>

      <Card>
        <Title title="Transfer Source Diagnostics" right="逐一檢查" />
        {(data?.sourceDiagnostics || []).map((s) => <Row key={s.name} title={s.name} sub={s.error ? s.error : s.configured ? `Transfer Count ${s.transferCount}` : "未設定 API key / endpoint"} value={s.status} status={s.status} />)}
        {!(data?.sourceDiagnostics || []).length ? <div style={{ color: "#94a3b8", fontSize: 13 }}>尚未取得來源診斷。</div> : null}
      </Card>

      <Card>
        <Title title="核心計數" right="Transfer → BuyRecord" />
        <Row title="Transfer Count" sub="最後使用來源回傳的 ERC20 transfer 數" value={data?.transferCount ?? "—"} status={(data?.transferCount || 0) > 0 ? "PASS" : "TRANSFER_API_RETURNED_ZERO