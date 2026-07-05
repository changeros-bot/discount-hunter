import { useEffect, useState } from "react";

function tone(status) {
  if (["PASS", "PASS_API_SYNCED", "VERIFIED_TX_REGISTRY_PASS", "PASS_WITH_VERIFIED_TX_REGISTRY"].includes(status)) {
    return { color: "#86efac", border: "rgba(34,197,94,.35)", bg: "rgba(34,197,94,.12)" };
  }
  if (["PARTIAL_COST_BASIS", "ONLY_TRANSFER_IN_NO_BUY_PATTERN", "NO_BUY_RECORDS", "TRANSFER_API_RETURNED_ZERO", "ZERO", "OFF", "MISSING", "VERIFIED_TX_REGISTRY_PARTIAL_LIVE_BALANCE"].includes(status)) {
    return { color: "#fde68a", border: "rgba(245,158,11,.35)", bg: "rgba(245,158,11,.12)" };
  }
  return { color: "#fca5a5", border: "rgba(239,68,68,.35)", bg: "rgba(239,68,68,.12)" };
}

function Card({ children, style }) {
  return <section style={{ background: "rgba(17,24,39,.92)", border: "1px solid rgba(148,163,184,.18)", borderRadius: 22, padding: 16, marginBottom: 12, boxShadow: "0 12px 34px rgba(0,0,0,.26)", ...style }}>{children}</section>;
}

function Title({ title, right }) {
  return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12 }}>
    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 1000 }}>{title}</h2>
    {right ? <span style={{ color: "#94a3b8", fontSize: 12, fontWeight: 850 }}>{right}</span> : null}
  </div>;
}

function Row({ title, sub, value, status }) {
  const t = tone(status);
  return <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center", borderBottom: "1px solid rgba(148,163,184,.12)", padding: "11px 0" }}>
    <div>
      <div style={{ fontSize: 14, fontWeight: 950 }}>{title}</div>
      {sub ? <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4, lineHeight: 1.4, wordBreak: "break-word" }}>{sub}</div> : null}
    </div>
    <div style={{ color: status ? t.color : "#f8fafc", fontSize: 14, fontWeight: 1000, whiteSpace: "nowrap" }}>{value}</div>
  </div>;
}

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
  const expectedCount = data?.expectedSymbolCount ?? data?.watchlist?.length ?? 0;
  const liveCount = data?.liveSymbolCount ?? data?.liveBalanceCount ?? 0;
  const missingLive = data?.missingLiveSymbols || [];

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
        <Title title="Universe 覆蓋檢查" right={`${liveCount} / ${expectedCount}`} />
        <Row title="Sealed xStocks Universe" sub={(data?.expectedSymbols || data?.watchlist || []).join(" / ")} value={expectedCount} status={expectedCount === 9 ? "PASS" : "FAIL"} />
        <Row title="Live Balance Symbols" sub={(data?.liveSymbols || []).join(" / ") || "沒有正數 balance"} value={liveCount} status={liveCount === expectedCount ? "PASS" : "VERIFIED_TX_REGISTRY_PARTIAL_LIVE_BALANCE"} />
        <Row title="Missing From Live Balance" sub="有在 sealed universe，但 balanceOf 正數持倉沒有出現" value={missingLive.length ? missingLive.join(", ") : "NONE"} status={missingLive.length ? "MISSING" : "PASS"} />
      </Card>

      <Card>
        <Title title="來源設定" right={data?.walletAddress || "wallet"} />
        <Row title="WALLET_ADDRESS" value={data?.walletConfigured ? "PASS" : "FAIL"} status={data?.walletConfigured ? "PASS" : "FAIL"} />
        <Row title="Moralis" value={data?.moralisConfigured ? "ON" : "OFF"} status={data?.moralisConfigured ? "PASS" : "OFF"} />
        <Row title="MegaNode / NodeReal" value={data?.megaNodeConfigured ? "ON" : "OFF"} status={data?.megaNodeConfigured ? "PASS" : "OFF"} />
        <Row title="BscScan / Etherscan V2" value={data?.bscScanConfigured ? "ON" : "OFF"} status={data?.bscScanConfigured ? "PASS" : "OFF"} />
        <Row title="最後使用來源" sub="有資料的第一個 transfer source" value={data?.transferSourceUsed || "—"} status={data?.transferSourceUsed && data.transferSourceUsed !== "none" ? "PASS" : "ZERO"} />
        <Row title="Verified Tx Registry" sub="tx hash receipt/log 驗證成本來源" value={data?.verifiedTxRegistryCount ?? 0} status={(data?.verifiedTxRegistryCount || 0) > 0 ? "PASS" : "MISSING"} />
        <Row title="規則" sub="同一 tx hash 內 stablecoin OUT + xStock IN 才算 BUY" value="STRICT" />
      </Card>

      <Card>
        <Title title="Transfer Source Diagnostics" right="逐一檢查" />
        {(data?.sourceDiagnostics || []).map((s) => <Row key={s.name} title={s.name} sub={s.error ? s.error : s.configured ? `Transfer Count ${s.transferCount}` : "未設定 API key / endpoint"} value={s.status} status={s.status} />)}
        {!(data?.sourceDiagnostics || []).length ? <div style={{ color: "#94a3b8", fontSize: 13 }}>尚未取得來源診斷。</div> : null}
      </Card>

      <Card>
        <Title title="核心計數" right="Transfer → BuyRecord" />
        <Row title="Transfer Count" sub="最後使用來源回傳的 ERC20 transfer 數" value={data?.transferCount ?? "—"} status={(data?.transferCount || 0) > 0 ? "PASS" : "TRANSFER_API_RETURNED_ZERO"} />
        <Row title="Unique Tx Hash" value={data?.transferSummary?.uniqueHashCount ?? "—"} />
        <Row title="xStock Transfer" value={data?.transferSummary?.xstockTransferCount ?? "—"} status={(data?.transferSummary?.xstockTransferCount || 0) > 0 ? "PASS" : "FAIL"} />
        <Row title="Stablecoin Transfer" value={data?.transferSummary?.stableTransferCount ?? "—"} status={(data?.transferSummary?.stableTransferCount || 0) > 0 ? "PASS" : "FAIL"} />
        <Row title="BUY Pattern Hash" sub="stablecoin OUT + xStock IN" value={data?.transferSummary?.possibleBuyHashCount ?? "—"} status={(data?.transferSummary?.possibleBuyHashCount || 0) > 0 ? "PASS" : "NO_BUY_RECORDS"} />
        <Row title="Official BUY Records" value={data?.officialBuyRecordCount ?? "—"} status={(data?.officialBuyRecordCount || 0) > 0 ? "PASS" : "NO_BUY_RECORDS"} />
        <Row title="TRANSFER_IN Records" value={data?.transferInRecordCount ?? "—"} />
      </Card>

      <Card>
        <Title title="鏈上正數持倉成本狀態" right={`${data?.liveBalanceCount ?? 0} 檔`} />
        {(data?.liveHoldings || []).map((h) => <Row key={h.symbol} title={h.symbol} sub={`${h.quantity}｜${h.contractAddress || "no contract"}｜${h.costBasisSource || "source?"}`} value={h.costStatus} status={h.costStatus === "PASS" ? "PASS" : "MISSING"} />)}
      </Card>

      <Card>
        <Title title="Sample Tx Diagnosis" right="最多 20 筆" />
        {(data?.transferSummary?.sample || []).length ? data.transferSummary.sample.map((s) => <div key={s.hash} style={{ padding: "10px 0", borderBottom: "1px solid rgba(148,163,184,.12)" }}>
          <div style={{ fontSize: 13, fontWeight: 1000, color: tone(s.diagnosis).color }}>{s.diagnosis}</div>
          <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 4, wordBreak: "break-all" }}>{s.hash}</div>
          <div style={{ color: "#cbd5e1", fontSize: 12, lineHeight: 1.5, marginTop: 6 }}>xIn {s.xstockInflows?.length || 0}｜stableOut {s.stableOutflows?.length || 0}｜xOut {s.xstockOutflows?.length || 0}｜stableIn {s.stableInflows?.length || 0}</div>
        </div>) : <div style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.6 }}>目前沒有可展示的 xStock / stablecoin 交易樣本。若 Transfer Count 為 0，代表所有 transfer source 都沒回資料。</div>}
      </Card>

      <Card>
        <Title title="下一步判斷" />
        <div style={{ color: "#cbd5e1", lineHeight: 1.75, fontSize: 14, fontWeight: 800 }}>
          先看 Universe 覆蓋檢查：sealed universe 應為 9 檔。若 live balance 只有 8 檔，要先查缺的 symbol 是 0 balance、合約錯誤，還是 balanceOf 失敗。<br />
          Transfer providers 失敗不等於成本無效；verified tx registry 可作為已驗證 tx hash 成本來源。<br />
          但不能把 8 檔說成 9 檔，也不能把沒有正數 balance 的 symbol 當成已持倉。
        </div>
      </Card>
    </div>
  </main>;
}
