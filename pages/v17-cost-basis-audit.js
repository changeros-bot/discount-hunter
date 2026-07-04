import { useEffect, useState } from "react";

function money(n) { return `$${Number(n || 0).toFixed(2)}`; }
function tone(status) {
  if (["PASS", "PASS_API_SYNCED"].includes(status)) return { color: "#86efac", border: "rgba(34,197,94,.35)", bg: "rgba(34,197,94,.12)" };
  if (["PARTIAL_COST_BASIS", "ONLY_TRANSFER_IN_NO_BUY_PATTERN", "NO_BUY_RECORDS", "TRANSFER_API_RETURNED_ZERO"].includes(status)) return { color: "#fde68a", border: "rgba(245,158,11,.35)", bg: "rgba(245,158,11,.12)" };
  return { color: "#fca5a5", border: "rgba(239,68,68,.35)", bg: "rgba(239,68,68,.12)" };
}
function Card({ children, style }) { return <section style={{ background: "rgba(17,24,39,.92)", border: "1px solid rgba(148,163,184,.18)", borderRadius: 22, padding: 16, marginBottom: 12, boxShadow: "0 12px 34px rgba(0,0,0,.26)", ...style }}>{children}</section>; }
function Title({ title, right }) { return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12 }}><h2 style={{ margin: 0, fontSize: 18, fontWeight: 1000 }}>{title}</h2>{right ? <span style={{ color: "#94a3b8", fontSize: 12, fontWeight: 850 }}>{right}</span> : null}</div>; }
function Pill({ children, status }) { const t = tone(status); return <span style={{ color: t.color, border: `1px solid ${t.border}`, background: t.bg, borderRadius: 999, padding: "6px 9px", fontSize: 12, fontWeight: 1000 }}>{children}</span>; }
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
        <Row title="Moralis" value={data?.moralisConfigured ? "ON" : "OFF"} status={data?.moralisConfigured ? "PASS" : "FAIL"} />
        <Row title="MegaNode / NodeReal" value={data?.megaNodeConfigured ? "ON" : "OFF"} status={data?.megaNodeConfigured ? "PASS" : "FAIL"} />
        <Row title="規則" sub="同一 tx hash 內 stablecoin OUT + xStock IN 才算 BUY" value="STRICT" />
      </Card>

      <Card>
        <Title title="核心計數" right="Transfer → BuyRecord" />
        <Row title="Transfer Count" sub="Moralis / MegaNode 回傳的 ERC20 transfer 數" value={data?.transferCount ?? "—"} status={(data?.transferCount || 0) > 0 ? "PASS" : "TRANSFER_API_RETURNED_ZERO"} />
        <Row title="Unique Tx Hash" value={data?.transferSummary?.uniqueHashCount ?? "—"} />
        <Row title="xStock Transfer" value={data?.transferSummary?.xstockTransferCount ?? "—"} status={(data?.transferSummary?.xstockTransferCount || 0) > 0 ? "PASS" : "FAIL"} />
        <Row title="Stablecoin Transfer" value={data?.transferSummary?.stableTransferCount ?? "—"} status={(data?.transferSummary?.stableTransferCount || 0) > 0 ? "PASS" : "FAIL"} />
        <Row title="BUY Pattern Hash" sub="stablecoin OUT + xStock IN" value={data?.transferSummary?.possibleBuyHashCount ?? "—"} status={(data?.transferSummary?.possibleBuyHashCount || 0) > 0 ? "PASS" : "NO_BUY_RECORDS"} />
        <Row title="Official BUY Records" value={data?.officialBuyRecordCount ?? "—"} status={(data?.officialBuyRecordCount || 0) > 0 ? "PASS" : "NO_BUY_RECORDS"} />
        <Row title="TRANSFER_IN Records" value={data?.transferInRecordCount ?? "—"} />
      </Card>

      <Card>
        <Title title="鏈上持倉成本狀態" right={`${data?.liveBalanceCount ?? 0} 檔`} />
        {(data?.liveHoldings || []).map((h) => <Row key={h.symbol} title={h.symbol} sub={`${h.quantity}｜${h.contractAddress || "no contract"}`} value={h.costStatus} status={h.costStatus === "PASS" ? "PASS" : "MISSING_API_COST"} />)}
      </Card>

      <Card>
        <Title title="Sample Tx Diagnosis" right="最多 20 筆" />
        {(data?.transferSummary?.sample || []).length ? data.transferSummary.sample.map((s) => <div key={s.hash} style={{ padding: "10px 0", borderBottom: "1px solid rgba(148,163,184,.12)" }}>
          <div style={{ fontSize: 13, fontWeight: 1000, color: tone(s.diagnosis).color }}>{s.diagnosis}</div>
          <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 4, wordBreak: "break-all" }}>{s.hash}</div>
          <div style={{ color: "#cbd5e1", fontSize: 12, lineHeight: 1.5, marginTop: 6 }}>xIn {s.xstockInflows?.length || 0}｜stableOut {s.stableOutflows?.length || 0}｜xOut {s.xstockOutflows?.length || 0}｜stableIn {s.stableInflows?.length || 0}</div>
        </div>) : <div style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.6 }}>目前沒有可展示的 xStock / stablecoin 交易樣本。若 Transfer Count 為 0，代表 transfer API 沒回資料。</div>}
      </Card>

      <Card>
        <Title title="下一步判斷" />
        <div style={{ color: "#cbd5e1", lineHeight: 1.75, fontSize: 14, fontWeight: 800 }}>
          如果 Transfer Count = 0：先查 Moralis / MegaNode endpoint。<br />
          如果有 xStock IN 但沒有 stablecoin OUT：代表目前錢包看到的是轉入，不是買入交易。<br />
          如果有 stablecoin OUT 但沒有 xStock IN：可能買入發生在另一個合約或 symbol mapping 缺失。<br />
          如果 BUY Pattern 有數字但 Official BUY = 0：代表 costBasis parser 有 bug。
        </div>
      </Card>
    </div>
  </main>;
}
