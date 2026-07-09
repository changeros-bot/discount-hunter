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
function gateColor(actionGate) {
  if (actionGate === "Discount Add Allowed") return "#bbf7d0";
  if (actionGate === "Watch Only") return "#fde68a";
  if (actionGate === "Blocked") return "#fecaca";
  return "#cbd5e1";
}
function CandidateCard({ item, onRecord, busy }) {
  const color = gateColor(item.actionGate);
  return <section style={{ marginTop: 12, border: `1px solid ${color}55`, background: "rgba(2,6,23,.48)", borderRadius: 18, padding: 14 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
      <div style={{ color: "#f8fafc", fontSize: 24, fontWeight: 1000 }}>{item.symbol}</div>
      <div style={{ color, fontWeight: 1000 }}>{item.tier}</div>
    </div>
    <div style={{ marginTop: 8, padding: 9, borderRadius: 14, background: "rgba(2,6,23,.50)", border: `1px solid ${color}55`, color, fontSize: 12, fontWeight: 1000, lineHeight: 1.5 }}>
      Action Gate：{item.actionGate}<div style={{ color: "#94a3b8", fontWeight: 850 }}>Bucket：{item.bucket}｜{item.reason}</div>
    </div>
    <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, color: "#cbd5e1", fontSize: 13, fontWeight: 850 }}>
      <div>候選金額：{Number(item.amountUsd || 0).toFixed(2)} USDT</div>
      <div>價格：${Number(item.price || 0).toFixed(4)}</div>
      <div>跌幅：{item.discountText || "—"}</div>
      <div>狀態：{item.statusLabel || item.status || "—"}</div>
    </div>
    {item.allowAction ? <>
      <ActionButton tone="green" disabled={busy} onClick={() => onRecord("complete", item)}>我已人工確認並完成，記錄本層完成</ActionButton>
      <ActionButton tone="yellow" disabled={busy} onClick={() => onRecord("skip", item)}>今天不加碼，略過本層</ActionButton>
    </> : null}
  </section>;
}

export default function SemiAutoDraftsDeprecated() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  async function load() {
    const prices = await fetch(`/api/prices?t=${Date.now()}`, { cache: "no-store" }).then((r) => r.json());
    const rows = Array.isArray(prices.data) ? prices.data : [];
    const markets = Object.fromEntries(rows.map((row) => [row.symbol, { symbol: row.symbol, price: row.price, high: row.high, cycleHigh: row.high || row.cycleHigh, discount: row.discount }]));
    const gate = await fetch(`/api/v17/semi-auto-drafts?t=${Date.now()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ markets }) }).then((r) => r.json());
    if (!gate.ok) throw new Error(gate.error || "讀取失敗");
    setData(gate);
  }
  useEffect(() => {
    load().catch((e) => setError(e.message || "讀取失敗"));
  }, []);
  async function record(action, item) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v17/action-event", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, symbol: item.symbol, tier: item.tier, layer: item.level || item.tier, amount: item.amountUsd, price: item.price, note: action === "complete" ? "market91_action_gate_manual_executed" : "market91_action_gate_user_skipped" }) }).then((r) => r.json());
      if (!res.ok) throw new Error(res.error || "記錄失敗");
      await load();
    } catch (e) {
      setError(e.message || "記錄失敗");
    } finally {
      setBusy(false);
    }
  }
  const allowed = data?.discountAddAllowed || [];
  const noAction = data?.noAction || [];
  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "linear-gradient(180deg,#020617 0%,#07111f 55%,#0f172a 100%)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "22px 14px 40px" }}>
      <a href="/v17" style={{ color: "#93c5fd", textDecoration: "none", fontWeight: 900 }}>← 返回折價獵人</a>
      <header style={{ marginTop: 18, marginBottom: 18 }}>
        <div style={{ color: "#f59e0b", letterSpacing: 3, fontWeight: 1000, fontSize: 13 }}>MARKET 91 V17.4 ACTION GATE</div>
        <h1 style={{ fontSize: 34, lineHeight: 1.05, margin: "10px 0", fontWeight: 1000 }}>Action Gate</h1>
        <p style={{ color: "#cbd5e1", lineHeight: 1.55, fontWeight: 850, margin: 0 }}>這個頁面已不再產生半自動草稿。Market 91 只回答 No Action / Discount Add Allowed / Watch Only / Blocked。0050 / VOO / QQQM 屬富邦主 DCA，不在這裡處理。</p>
        <LinkButton href="/trade-readiness">查看現金與預算檢查</LinkButton>
        <LinkButton href="/v17-quality">查看 Quality Audit Center</LinkButton>
        <LinkButton href="/v17">回主頁看持倉區 / 觀察區</LinkButton>
      </header>
      {error && <Box title="讀取 / 記錄失敗"><div style={{ color: "#fecaca" }}>{error}</div></Box>}
      {!data && !error && <Box title="讀取中"><div style={{ color: "#94a3b8" }}>產生 Action Gate 判斷中…</div></Box>}
      {data && <>
        <Box title="安全邊界"><div style={{ color: "#cbd5e1", lineHeight: 1.7, fontWeight: 850 }}>Discount Add Allowed：{data.discountAddAllowedCount}｜No Action / Watch / Blocked：{data.noActionCount}<br />Auto Trade：OFF｜Creates Drafts：OFF｜Whitelist：OFF｜Manual Confirm：ON<br />主線：Universe Integrity → Strategy Bucket → Action Gate</div></Box>
        {allowed.length === 0 ? <Box title="目前沒有可加碼"><div style={{ color: "#94a3b8", lineHeight: 1.6, fontWeight: 850 }}>這是正常狀態：目前沒有符合折價、thesis、現金、倉位上限的標的。</div></Box> : <Box title="Discount Add Allowed">{allowed.map((item) => <CandidateCard key={`${item.symbol}-${item.tier}`} item={item} onRecord={record} busy={busy} />)}</Box>}
        {noAction.length > 0 ? <Box title="No Action / Watch / Blocked">{noAction.map((item) => <CandidateCard key={`${item.symbol}-${item.tier}`} item={item} onRecord={record} busy={busy} />)}</Box> : null}
      </>}
    </div>
  </main>;
}
