// RESTORE_LOCK_20260709: /v17 is the live Discount Hunter page only. Do not add paper trading UI here.
import { useEffect, useState } from "react";

function Box({ title, children, tone = "blue" }) {
  const border = tone === "green" ? "rgba(34,197,94,.38)" : tone === "red" ? "rgba(248,113,113,.36)" : tone === "yellow" ? "rgba(245,158,11,.34)" : "rgba(59,130,246,.30)";
  return <section style={{ marginTop: 14, border: `1px solid ${border}`, background: "rgba(15,23,42,.76)", borderRadius: 22, padding: 16 }}>
    <h2 style={{ margin: "0 0 10px", color: "#f8fafc", fontSize: 18, fontWeight: 1000 }}>{title}</h2>
    {children}
  </section>;
}
function Pill({ children, tone = "blue" }) {
  const map = { green: ["#bbf7d0", "rgba(34,197,94,.14)"], red: ["#fecaca", "rgba(248,113,113,.14)"], yellow: ["#fde68a", "rgba(245,158,11,.14)"], blue: ["#bfdbfe", "rgba(59,130,246,.13)"] };
  const [color, bg] = map[tone] || map.blue;
  return <span style={{ display: "inline-flex", margin: "3px 4px 3px 0", padding: "5px 8px", borderRadius: 999, color, background: bg, fontSize: 12, fontWeight: 1000 }}>{children}</span>;
}
function LinkButton({ href, children }) {
  return <a href={href} style={{ display: "block", marginTop: 10, padding: "12px 10px", borderRadius: 14, border: "1px solid rgba(59,130,246,.38)", background: "rgba(59,130,246,.13)", color: "#bfdbfe", fontWeight: 1000, textAlign: "center", textDecoration: "none" }}>{children}</a>;
}
function num(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}
function money(value) {
  if (value === null || value === undefined) return "N/A";
  return `$${num(value).toFixed(2)}`;
}
function signedMoney(value) {
  if (value === null || value === undefined) return "N/A";
  const n = num(value);
  return `${n > 0 ? "+" : n < 0 ? "-" : ""}$${Math.abs(n).toFixed(2)}`;
}
function signedPct(value) {
  if (value === null || value === undefined) return "N/A";
  const n = Number(value || 0) * 100;
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
}
async function readJson(url, options = {}) {
  const res = await fetch(url, { cache: "no-store", ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
  return data;
}
function Row({ row, right, tone = "blue" }) {
  return <article style={{ marginTop: 8, padding: 10, borderRadius: 16, background: "rgba(2,6,23,.48)", border: "1px solid rgba(148,163,184,.18)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
      <strong style={{ color: "#f8fafc", fontSize: 18 }}>{row.symbol || row.name || "—"}</strong>
      {right ? <Pill tone={tone}>{right}</Pill> : null}
    </div>
    <div style={{ marginTop: 6, color: "#cbd5e1", fontSize: 12, fontWeight: 850, lineHeight: 1.55 }}>
      {row.name ? <>{row.name}<br /></> : null}
      {row.tier || row.signalTier || row.statusLabel || row.discountText || "—"}
      {row.amountUsd !== undefined ? <>｜{Number(row.amountUsd || 0).toFixed(2)}U</> : null}
      {row.actionGate ? <>｜Action Gate：{row.actionGate}</> : null}
      {row.reason ? <><br />{row.reason}</> : null}
    </div>
  </article>;
}

export default function V17Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  async function load() {
    const [truth, sections, readiness, gate] = await Promise.all([
      readJson(`/api/v17/portfolio-truth?t=${Date.now()}`),
      readJson(`/api/v17/section-summary?t=${Date.now()}`),
      readJson(`/api/v17/trade-readiness?t=${Date.now()}`),
      readJson(`/api/v17/semi-auto-drafts?t=${Date.now()}`),
    ]);
    setData({ truth, sections, readiness, gate, updatedAt: new Date().toISOString() });
  }

  useEffect(() => {
    load().catch((e) => setError(e.message || "讀取失敗"));
  }, []);

  const summary = data?.truth?.summary || {};
  const cash = data?.truth?.cash || {};
  const holdingRows = data?.sections?.holdingRows || [];
  const watchRows = data?.sections?.watchRows || [];
  const allowed = data?.gate?.discountAddAllowed || [];
  const noAction = data?.gate?.noAction || [];
  const readiness = data?.readiness?.readiness || {};
  const readyTone = readiness.status === "READY_FOR_MANUAL_CONFIRMATION" ? "green" : readiness.status === "NEEDS_MANUAL_REVIEW" ? "red" : "yellow";

  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "linear-gradient(180deg,#020617 0%,#07111f 55%,#0f172a 100%)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "22px 14px 40px" }}>
      <header style={{ marginTop: 8, marginBottom: 18 }}>
        <div style={{ color: "#38bdf8", letterSpacing: 3, fontWeight: 1000, fontSize: 13 }}>MARKET 91 / XSTOCKS V17.4</div>
        <h1 style={{ fontSize: 34, lineHeight: 1.05, margin: "10px 0", fontWeight: 1000 }}>折價獵人</h1>
        <p style={{ color: "#cbd5e1", lineHeight: 1.55, fontWeight: 850, margin: 0 }}>主線：Universe Integrity → Strategy Bucket → Action Gate。Market 91 只處理個股 / xStocks 逢低輔助；富邦 0050 / VOO / QQQM 是另一個長期 DCA 主系統。</p>
      </header>

      {error && <Box title="讀取失敗" tone="red"><div style={{ color: "#fecaca" }}>{error}</div></Box>}
      {!data && !error && <Box title="讀取中"><div style={{ color: "#94a3b8" }}>同步 Market 91 狀態中…</div></Box>}

      {data && <>
        <Box title="系統邊界" tone="yellow">
          <div><Pill tone="green">Action Gate ON</Pill><Pill tone="red">Auto Trade OFF</Pill><Pill tone="red">Drafts OFF</Pill><Pill tone="red">Whitelist OFF</Pill></div>
          <div style={{ marginTop: 8, color: "#cbd5e1", fontWeight: 850, lineHeight: 1.65 }}>允許輸出只有：No Action / Discount Add Allowed / Watch Only / Blocked。這裡不決定 0050 / VOO / QQQM。</div>
        </Box>

        <Box title="今日 Action Gate" tone={allowed.length ? "green" : "yellow"}>
          <div><Pill tone="green">Discount Add Allowed {allowed.length}</Pill><Pill tone="yellow">No Action / Watch / Blocked {noAction.length}</Pill></div>
          {allowed.length ? allowed.map((row) => <Row key={`${row.symbol}-${row.tier}`} row={row} right="可人工確認" tone="green" />) : <div style={{ marginTop: 8, color: "#94a3b8", fontWeight: 850 }}>目前沒有符合折價、thesis、現金與倉位上限的加碼候選。</div>}
          <LinkButton href="/semi-auto-drafts">查看 Action Gate 明細</LinkButton>
        </Box>

        <Box title="現金與預算" tone={readyTone}>
          <div><Pill tone={readyTone}>{readiness.label || readiness.status || "—"}</Pill><Pill>Market 91 逢低預算</Pill></div>
          <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, color: "#cbd5e1", fontWeight: 850 }}>
            <div>可用 USDT：{num(cash.totalUSDT).toFixed(2)}U</div>
            <div>候選合計：{num(data.readiness?.summary?.totalCandidateAmountUsdt).toFixed(2)}U</div>
            <div>候選後現金：{num(data.readiness?.summary?.cashAfterCandidatesUsdt).toFixed(2)}U</div>
            <div>單日上限：{num(data.readiness?.budget?.dailyActionCapUsdt).toFixed(2)}U</div>
          </div>
          <LinkButton href="/trade-readiness">查看現金與預算檢查</LinkButton>
        </Box>

        <Box title="真實持倉">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, color: "#cbd5e1", fontWeight: 850 }}>
            <div>總投入：{money(summary.totalCost)}</div>
            <div>目前市值：{money(summary.currentValue)}</div>
            <div>未實現損益：{signedMoney(summary.pnl)}</div>
            <div>報酬率：{signedPct(summary.pnlPct)}</div>
          </div>
          {holdingRows.length ? holdingRows.map((row) => <Row key={`h-${row.symbol}-${row.tier}`} row={row} right="持倉" tone="green" />) : <div style={{ marginTop: 8, color: "#94a3b8", fontWeight: 850 }}>目前沒有買點區持倉。</div>}
        </Box>

        <Box title={`觀察區（${watchRows.length}）`}>
          {watchRows.length ? watchRows.slice(0, 12).map((row) => <Row key={`w-${row.symbol}-${row.tier}`} row={row} right="Watch Only" tone="yellow" />) : <div style={{ color: "#94a3b8", fontWeight: 850 }}>目前沒有觀察項目。</div>}
        </Box>

        <Box title="入口">
          <LinkButton href="/market-91-shortlist">Market 91 候選池</LinkButton>
          <LinkButton href="/v17-quality">Quality Audit Center</LinkButton>
          <LinkButton href="/auto-whitelist">已凍結流程狀態</LinkButton>
        </Box>
      </>}
    </div>
  </main>;
}
