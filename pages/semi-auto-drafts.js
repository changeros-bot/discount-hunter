import { useEffect, useState } from "react";

function Box({ title, children }) {
  return <section style={{ marginTop: 14, border: "1px solid rgba(148,163,184,.18)", background: "rgba(15,23,42,.76)", borderRadius: 22, padding: 16 }}>
    <h2 style={{ margin: "0 0 10px", color: "#f8fafc", fontSize: 18, fontWeight: 1000 }}>{title}</h2>
    {children}
  </section>;
}
function LinkButton({ href, children }) {
  return <a href={href} style={{ display: "block", marginTop: 10, padding: "12px 10px", borderRadius: 14, border: "1px solid rgba(59,130,246,.38)", background: "rgba(59,130,246,.13)", color: "#bfdbfe", fontWeight: 1000, textAlign: "center", textDecoration: "none" }}>{children}</a>;
}
function ActionButton({ children, tone = "green", onClick, disabled }) {
  const map = { green: ["rgba(34,197,94,.16)", "rgba(34,197,94,.45)", "#bbf7d0"], yellow: ["rgba(245,158,11,.16)", "rgba(245,158,11,.45)", "#fde68a"], blue: ["rgba(59,130,246,.16)", "rgba(59,130,246,.45)", "#bfdbfe"] };
  const [bg, border, color] = map[tone] || map.green;
  return <button disabled={disabled} onClick={onClick} style={{ marginTop: 8, width: "100%", padding: "12px 10px", borderRadius: 14, border: `1px solid ${border}`, background: disabled ? "rgba(71,85,105,.22)" : bg, color: disabled ? "#94a3b8" : color, fontWeight: 1000 }}>{children}</button>;
}
function flowState(draft) {
  if (draft.allowedAction === "DATA_NOT_READY") return { label: "資料不足", color: "#fecaca", note: "價格或金額缺失，不能確認。" };
  if (draft.qualityGate?.quality === "WATCH") return { label: "低優先人工確認", color: "#fde68a", note: "觀察標的，只能人工低優先處理。" };
  if (draft.qualityGate?.requiresManualQualityConfirmation) return { label: "需人工確認", color: "#fde68a", note: "仍是 Draft / Pending Verification，不可自動化。" };
  return { label: "可人工確認", color: "#bbf7d0", note: "仍需到 Binance 手動確認，不自動下單。" };
}
function GateBadge({ gate }) {
  const color = gate?.quality === "PASSED" ? "#bbf7d0" : gate?.quality === "WATCH" ? "#fde68a" : gate?.quality === "FAILED" ? "#fecaca" : "#cbd5e1";
  return <div style={{ marginTop: 8, padding: 9, borderRadius: 14, background: "rgba(15,23,42,.74)", border: "1px solid rgba(148,163,184,.18)", color, fontSize: 12, fontWeight: 900, lineHeight: 1.55 }}>
    Quality：{gate?.label || "—"}｜{gate?.permission || "—"}<br />Pipeline：{gate?.pipeline || "—"}｜{gate?.role || "—"}
    {gate?.note ? <div style={{ marginTop: 4, color: "#94a3b8", fontWeight: 800 }}>{gate.note}</div> : null}
  </div>;
}
function DraftCard({ draft, onRecord, busy }) {
  const flow = flowState(draft);
  async function copy() {
    try { await navigator.clipboard.writeText(draft.copyText || ""); } catch {}
  }
  return <section style={{ marginTop: 12, border: "1px solid rgba(245,158,11,.28)", background: "rgba(2,6,23,.48)", borderRadius: 18, padding: 14 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
      <div style={{ color: "#f8fafc", fontSize: 24, fontWeight: 1000 }}>{draft.symbol}</div>
      <div style={{ color: "#fbbf24", fontWeight: 1000 }}>{draft.tier}</div>
    </div>
    <div style={{ marginTop: 8, padding: 9, borderRadius: 14, background: "rgba(2,6,23,.50)", border: `1px solid ${flow.color}55`, color: flow.color, fontSize: 12, fontWeight: 1000, lineHeight: 1.5 }}>流程：{flow.label}<div style={{ color: "#94a3b8", fontWeight: 850 }}>{flow.note}</div></div>
    <GateBadge gate={draft.qualityGate} />
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
    <ActionButton tone="blue" onClick={copy}>複製下單草稿</ActionButton>
    <ActionButton tone="green" disabled={busy} onClick={() => onRecord("complete", draft)}>我已手動完成，記錄本層完成</ActionButton>
    <ActionButton tone="yellow" disabled={busy} onClick={() => onRecord("skip", draft)}>今天不買，略過本層</ActionButton>
  </section>;
}
function BlockedCard({ item }) {
  return <section style={{ marginTop: 10, border: "1px solid rgba(248,113,113,.30)", background: "rgba(127,29,29,.14)", borderRadius: 16, padding: 12 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><strong style={{ color: "#fecaca", fontSize: 18 }}>{item.symbol}</strong><span style={{ color: "#fecaca", fontWeight: 900 }}>{item.tier}</span></div>
    <div style={{ marginTop: 6, color: "#cbd5e1", fontSize: 12, fontWeight: 850 }}>被 Quality Gate 擋下：{item.reason}</div>
  </section>;
}

export default function SemiAutoDrafts() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  async function load() {
    const prices = await fetch(`/api/prices?t=${Date.now()}`, { cache: "no-store" }).then((r) => r.json());
    const rows = Array.isArray(prices.data) ? prices.data : [];
    const markets = Object.fromEntries(rows.map((row) => [row.symbol, { symbol: row.symbol, price: row.price, high: row.high, cycleHigh: row.high || row.cycleHigh, discount: row.discount }]));
    const drafts = await fetch(`/api/v17/semi-auto-drafts?t=${Date.now()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ markets }) }).then((r) => r.json());
    if (!drafts.ok) throw new Error(drafts.error || "讀取失敗");
    setData(drafts);
  }
  useEffect(() => {
    load().catch((e) => setError(e.message || "讀取失敗"));
  }, []);
  async function record(action, draft) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v17/action-event", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, symbol: draft.symbol, tier: draft.tier, layer: draft.level || draft.tier, amount: draft.amountUsd, price: draft.price, note: action === "complete" ? "semi_auto_manual_executed" : "semi_auto_user_skipped" }) }).then((r) => r.json());
      if (!res.ok) throw new Error(res.error || "記錄失敗");
      await load();
    } catch (e) {
      setError(e.message || "記錄失敗");
    } finally {
      setBusy(false);
    }
  }
  const drafts = data?.drafts || [];
  const blocked = data?.blocked || [];
  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "linear-gradient(180deg,#020617 0%,#07111f 55%,#0f172a 100%)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "22px 14px 40px" }}>
      <a href="/v17" style={{ color: "#93c5fd", textDecoration: "none", fontWeight: 900 }}>← 返回折價獵人</a>
      <header style={{ marginTop: 18, marginBottom: 18 }}>
        <div style={{ color: "#f59e0b", letterSpacing: 3, fontWeight: 1000, fontSize: 13 }}>V17.4 AUTOMATION DOORSTEP</div>
        <h1 style={{ fontSize: 36, lineHeight: 1.05, margin: "10px 0", fontWeight: 1000 }}>半自動草稿</h1>
        <p style={{ color: "#cbd5e1", lineHeight: 1.55, fontWeight: 850, margin: 0 }}>只保留必要流程：草稿、現金檢查、手動確認、記錄完成或略過。下一站才是自動化門口。</p>
        <LinkButton href="/trade-readiness">查看現金與預算檢查</LinkButton>
        <LinkButton href="/auto-whitelist">前往自動化門口</LinkButton>
        <LinkButton href="/v17-quality">查看 Quality Audit Center</LinkButton>
      </header>
      {error && <Box title="讀取 / 記錄失敗"><div style={{ color: "#fecaca" }}>{error}</div></Box>}
      {!data && !error && <Box title="讀取中"><div style={{ color: "#94a3b8" }}>產生半自動草稿中…</div></Box>}
      {data && <>
        <Box title="安全邊界"><div style={{ color: "#cbd5e1", lineHeight: 1.7, fontWeight: 850 }}>草稿數：{data.draftCount}｜被擋下：{data.blockedCount}｜總金額：{Number(data.totalDraftAmountUsd || 0).toFixed(2)} USDT<br />Quality Gate：ON｜Auto Trade：OFF｜Manual Confirm：ON｜Kill Switch：ON<br />最短路徑：草稿 → Binance 手動確認 → 記錄完成 / 略過 → 自動化門口</div></Box>
        {drafts.length === 0 ? <Box title="目前沒有草稿"><div style={{ color: "#94a3b8", lineHeight: 1.6, fontWeight: 850 }}>這是正常狀態：目前沒有新的 D 層買點需要執行，或買點已被你略過 / 完成。Quality Gate 只在「今日決策出現」時才會產生草稿或擋下原因。</div><LinkButton href="/trade-readiness">看現金與預算檢查</LinkButton><LinkButton href="/auto-whitelist">前往自動化門口</LinkButton><LinkButton href="/v17">回主頁看持倉區 / 觀察區</LinkButton></Box> : drafts.map((draft) => <DraftCard key={`${draft.symbol}-${draft.tier}`} draft={draft} onRecord={record} busy={busy} />)}
        {blocked.length > 0 ? <Box title="Quality Gate 擋下"><div>{blocked.map((item) => <BlockedCard key={`${item.symbol}-${item.tier}`} item={item} />)}</div></Box> : null}
      </>}
    </div>
  </main>;
}
