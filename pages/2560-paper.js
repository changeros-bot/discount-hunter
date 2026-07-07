import { useEffect, useMemo, useState } from "react";

const pct = (v) => v === null || v === undefined ? "—" : `${(Number(v) * 100).toFixed(2)}%`;
const money = (v) => v === null || v === undefined ? "—" : `$${Number(v).toFixed(2)}`;
const statusZh = { PENDING: "等待隔日開盤", OPEN: "紙上交易運行中", CLOSED: "已結案" };
const exitZh = { stop_loss_8pct: "停損 -8%", take_profit_15pct: "停利 +15%", max_30d: "滿 30 個交易日" };

function pick(row, keys, fallback = "") {
  for (const key of keys) if (row?.[key] !== undefined && row?.[key] !== "") return row[key];
  return fallback;
}

function Pill({ children, color = "#38bdf8" }) {
  return <span style={{ color, border: `1px solid ${color}55`, background: `${color}14`, padding: "6px 10px", borderRadius: 999, fontWeight: 950, fontSize: 12, whiteSpace: "nowrap" }}>{children}</span>;
}

function Stat({ label, value, sub, color = "#f8fafc" }) {
  return <section style={{ border: "1px solid rgba(148,163,184,.18)", background: "linear-gradient(180deg,rgba(15,23,42,.92),rgba(2,6,23,.76))", borderRadius: 22, padding: 15 }}>
    <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 900 }}>{label}</div>
    <div style={{ color, fontSize: 28, fontWeight: 1000, marginTop: 8 }}>{value}</div>
    {sub && <div style={{ color: "#64748b", fontSize: 12, fontWeight: 850, marginTop: 5 }}>{sub}</div>}
  </section>;
}

function Zone({ title, sub, count, color = "#38bdf8", children }) {
  return <section style={{ marginTop: 16, border: `1px solid ${color}33`, background: "rgba(15,23,42,.72)", borderRadius: 26, overflow: "hidden" }}>
    <div style={{ padding: 16, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", background: `linear-gradient(90deg,${color}18,transparent)` }}>
      <div>
        <h2 style={{ margin: 0, color: "#f8fafc", fontSize: 19, fontWeight: 1000 }}>{title}</h2>
        {sub && <div style={{ marginTop: 4, color: "#94a3b8", fontSize: 12, fontWeight: 850 }}>{sub}</div>}
      </div>
      <Pill color={color}>{count}</Pill>
    </div>
    <div style={{ padding: 14 }}>{children}</div>
  </section>;
}

function SymbolCard({ item, active }) {
  const color = item.group?.includes("高波動") ? "#f59e0b" : item.group?.includes("半導體") ? "#38bdf8" : item.group?.includes("基礎") ? "#a78bfa" : item.group?.includes("國防") ? "#22c55e" : "#94a3b8";
  return <div style={{ border: `1px solid ${active ? "#22c55e55" : "rgba(148,163,184,.14)"}`, background: active ? "rgba(20,83,45,.18)" : "rgba(2,6,23,.42)", borderRadius: 19, padding: 14 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
      <div style={{ color: "#f8fafc", fontWeight: 1000, fontSize: 20 }}>{item.ticker}</div>
      <Pill color={color}>{item.group}</Pill>
    </div>
    <div style={{ marginTop: 9, color: "#cbd5e1", fontSize: 13, lineHeight: 1.45, fontWeight: 820 }}>{item.trait}</div>
    <div style={{ marginTop: 8, color: "#93c5fd", fontSize: 13, lineHeight: 1.45, fontWeight: 900 }}>策略：{item.strategy}</div>
  </div>;
}

function TradeCard({ row }) {
  const ticker = pick(row, ["股票", "ticker"], "—");
  const pattern = pick(row, ["型態", "pattern"], "—");
  const statusRaw = pick(row, ["status"], "");
  const status = statusZh[statusRaw] || exitZh[pick(row, ["exit_reason"], "")] || "—";
  const entry = pick(row, ["進場價", "entry_price"], "等待隔日開盤");
  const last = pick(row, ["最後價格", "last_price", "出場價", "exit_price"], "—");
  const ret = pick(row, ["報酬率", "return_pct"], "—");
  const isPending = statusRaw === "PENDING";
  return <div style={{ border: `1px solid ${isPending ? "#f59e0b55" : "#22c55e55"}`, background: isPending ? "rgba(120,53,15,.18)" : "rgba(20,83,45,.18)", borderRadius: 20, padding: 14 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
      <div style={{ color: "#f8fafc", fontWeight: 1000, fontSize: 20 }}>{ticker}</div>
      <Pill color={isPending ? "#f59e0b" : "#22c55e"}>{status}</Pill>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12, fontSize: 13, color: "#cbd5e1", fontWeight: 850 }}>
      <div>型態<br /><b style={{ color: "#f8fafc" }}>{pattern}</b></div>
      <div>模擬本金<br /><b style={{ color: "#f8fafc" }}>$100</b></div>
      <div>進場價<br /><b style={{ color: "#f8fafc" }}>{entry}</b></div>
      <div>現價/出場<br /><b style={{ color: "#f8fafc" }}>{last}</b></div>
    </div>
    <div style={{ marginTop: 10, color: String(ret).startsWith("-") ? "#f87171" : "#4ade80", fontWeight: 1000 }}>報酬：{ret}</div>
  </div>;
}

export default function Paper2560() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    fetch("/api/2560-paper").then((r) => r.json()).then((j) => j.ok ? setData(j) : setError(j.error || "讀取失敗")).catch((e) => setError(e.message));
  }, []);

  const s = data?.summary;
  const activeRows = data ? [...data.open, ...data.pending] : [];
  const profiles = s?.universeProfiles || [];
  const activeTickers = useMemo(() => new Set(activeRows.map((r) => pick(r, ["ticker", "股票"], ""))), [activeRows]);
  const observation = profiles.filter((x) => x.group?.includes("高波動") || x.strategy?.includes("只開"));
  const waiting = profiles.filter((x) => !activeTickers.has(x.ticker) && !observation.some((o) => o.ticker === x.ticker));
  const activeProfiles = profiles.filter((x) => activeTickers.has(x.ticker));
  const openExposure = s?.openExposure ?? ((s?.open || 0) + (s?.pending || 0)) * 100;

  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "radial-gradient(circle at top,#0f2a44 0%,#020617 42%,#020617 100%)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "22px 14px 44px" }}>
      <a href="/" style={{ color: "#93c5fd", textDecoration: "none", fontWeight: 900 }}>← 返回專案首頁</a>
      <header style={{ marginTop: 18, marginBottom: 16, border: "1px solid rgba(56,189,248,.22)", background: "linear-gradient(180deg,rgba(8,47,73,.42),rgba(2,6,23,.52))", borderRadius: 28, padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ color: "#38bdf8", letterSpacing: 2, fontWeight: 1000, fontSize: 13 }}>2560 TECHNICAL LAB</div>
          <Pill color="#f59e0b">Paper V0.7</Pill>
        </div>
        <h1 style={{ fontSize: 35, lineHeight: 1.05, margin: "12px 0 8px", fontWeight: 1000 }}>2560 紙上交易作戰板</h1>
        <p style={{ color: "#cbd5e1", lineHeight: 1.55, fontWeight: 850, margin: 0 }}>類折扣獵人版面｜紙上交易運行中 / 等待訊號區 / 觀察區｜只記錄，不下單。</p>
      </header>

      {error && <section style={{ border: "1px solid #ef444455", background: "#ef444414", color: "#fecaca", borderRadius: 20, padding: 16, fontWeight: 850 }}>讀取失敗：{error}</section>}
      {!data && !error && <section style={{ border: "1px solid rgba(148,163,184,.18)", background: "rgba(15,23,42,.76)", borderRadius: 22, padding: 18, color: "#94a3b8", fontWeight: 900 }}>讀取紙上交易狀態中…</section>}

      {s && <>
        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Stat label="紙上交易運行中" value={s.open + s.pending} sub={`OPEN ${s.open}｜PENDING ${s.pending}`} color="#38bdf8" />
          <Stat label="等待訊號" value={waiting.length} sub="合格但今日無訊號" color="#f59e0b" />
          <Stat label="觀察區" value={observation.length} sub="限制型態 / 高波動" color="#a78bfa" />
          <Stat label="模擬曝險" value={money(openExposure)} sub="未平倉模擬本金" color="#22c55e" />
        </section>

        <Zone title="紙上交易運行中" sub="已觸發訊號，等待隔日開盤或 30 天內追蹤" count={activeRows.length} color="#22c55e">
          {activeRows.length ? <div style={{ display: "grid", gap: 10 }}>{activeRows.map((r, i) => <TradeCard key={pick(r, ["trade_id"], i)} row={r} />)}</div> : <div style={{ color: "#64748b", fontWeight: 900 }}>目前沒有運行中的紙上交易。</div>}
          {activeProfiles.length > 0 && <div style={{ display: "grid", gap: 10, marginTop: 10 }}>{activeProfiles.map((x) => <SymbolCard key={x.ticker} item={x} active />)}</div>}
        </Zone>

        <Zone title="等待訊號區" sub="已通過名單，但尚未出現 2560 訊號" count={waiting.length} color="#f59e0b">
          <div style={{ display: "grid", gap: 10 }}>{waiting.map((x) => <SymbolCard key={x.ticker} item={x} />)}</div>
        </Zone>

        <Zone title="觀察區" sub="高波動或限制型態標的；只等最強訊號" count={observation.length} color="#a78bfa">
          <div style={{ display: "grid", gap: 10 }}>{observation.map((x) => <SymbolCard key={x.ticker} item={x} />)}</div>
        </Zone>
      </>}
    </div>
  </main>;
}
