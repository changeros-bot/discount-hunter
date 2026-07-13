import { useEffect, useMemo, useState } from "react";

const money = (v) => v === null || v === undefined ? "—" : `$${Number(v).toFixed(2)}`;
const statusZh = { PENDING: "等待隔日開盤", OPEN: "紙上交易運行中", CLOSED: "已結案" };
const patternZh = {
  RUSH_VOLUME: "衝量",
  BUILT_VOLUME: "做量",
  VOLUME_PIT: "縮量坑",
  NONE: "尚無模式",
};
const stageZh = {
  WATCH: "觀察",
  PRICE_SETUP: "價格結構成立",
  VOLUME_SETUP: "等待量能確認",
  TRIGGERED: "正式觸發",
  FAILED: "結構失效",
};
const riskZh = {
  NORMAL: "正常",
  EXTENDED: "過度延伸",
  TOO_DEEP: "跌深受損",
  FAILED: "失效",
  EXPIRED: "時間失效",
  DISTRIBUTION_WARNING: "出貨警告",
};
const exitZh = {
  structure_or_atr_stop: "結構／ATR 停損",
  paper_target_15pct: "紙上目標 +15%",
  expired_30d: "30 日時間失效",
  risk_state_exit: "風險狀態退出",
  stop_loss_8pct: "舊版停損 -8%",
  take_profit_15pct: "舊版停利 +15%",
  max_30d: "舊版 30 日到期",
};

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

function SymbolCard({ item }) {
  const color = item.group?.includes("高波動") ? "#f59e0b" : item.group?.includes("半導體") ? "#38bdf8" : item.group?.includes("基礎") ? "#a78bfa" : "#94a3b8";
  return <div style={{ border: "1px solid rgba(148,163,184,.14)", background: "rgba(2,6,23,.42)", borderRadius: 19, padding: 14 }}>
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
  const statusRaw = pick(row, ["status"], "");
  const status = statusZh[statusRaw] || exitZh[pick(row, ["exit_reason"], "")] || "—";
  const pattern = pick(row, ["pattern_zh", "型態", "pattern"], "—");
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
      <div>模式<br /><b style={{ color: "#f8fafc" }}>{pattern}</b></div>
      <div>風險<br /><b style={{ color: "#f8fafc" }}>{riskZh[row.risk_status] || row.risk_status || "—"}</b></div>
      <div>進場價<br /><b style={{ color: "#f8fafc" }}>{entry}</b></div>
      <div>現價／出場<br /><b style={{ color: "#f8fafc" }}>{last}</b></div>
    </div>
    <div style={{ marginTop: 10, color: String(ret).startsWith("-") ? "#f87171" : "#4ade80", fontWeight: 1000 }}>報酬：{ret}</div>
  </div>;
}

function ScanCard({ row }) {
  const triggered = row.stage_status === "TRIGGERED" && row.gate_status === "PASS" && row.risk_status === "NORMAL";
  const failed = row.gate_status === "REJECTED" || row.risk_status === "FAILED" || row.stage_status === "FAILED";
  const color = triggered ? "#22c55e" : failed ? "#f87171" : row.risk_status !== "NORMAL" ? "#f59e0b" : "#38bdf8";
  return <div style={{ border: `1px solid ${color}44`, background: `${color}0d`, borderRadius: 20, padding: 14 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
      <div style={{ color: "#f8fafc", fontWeight: 1000, fontSize: 20 }}>{row.ticker}</div>
      <Pill color={color}>{stageZh[row.stage_status] || row.stage_status || "等待掃描"}</Pill>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginTop: 11, color: "#cbd5e1", fontSize: 12, fontWeight: 850 }}>
      <div>Gate<br /><b style={{ color: row.gate_status === "PASS" ? "#4ade80" : "#f87171" }}>{row.gate_status || "—"}</b></div>
      <div>模式<br /><b style={{ color: "#f8fafc" }}>{row.pattern_zh || patternZh[row.pattern_type] || "尚無"}</b></div>
      <div>風險<br /><b style={{ color: "#f8fafc" }}>{riskZh[row.risk_status] || row.risk_status || "—"}</b></div>
      <div>MA25 距離<br /><b style={{ color: "#f8fafc" }}>{row.distance_to_ma25_atr ?? "—"} ATR</b></div>
      <div>價格 5／25<br /><b style={{ color: "#f8fafc" }}>{row.ma5_price ?? "—"}／{row.ma25_price ?? "—"}</b></div>
      <div>量能 5／60<br /><b style={{ color: "#f8fafc" }}>{row.vma5 ?? "—"}／{row.vma60 ?? "—"}</b></div>
    </div>
    <div style={{ marginTop: 10, color: "#94a3b8", fontSize: 12, lineHeight: 1.45, fontWeight: 800 }}>原因：{row.reason || "—"}</div>
  </div>;
}

function ScanProof({ scan }) {
  const runAt = scan?.run_at_utc ? new Date(scan.run_at_utc).toLocaleString("zh-TW", { hour12: false }) : "尚無巡查紀錄";
  const ok = scan?.ok;
  return <section style={{ marginTop: 14, border: `1px solid ${ok ? "#22c55e55" : "#f59e0b55"}`, background: ok ? "rgba(20,83,45,.16)" : "rgba(120,53,15,.16)", borderRadius: 22, padding: 14 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
      <div style={{ color: "#f8fafc", fontWeight: 1000 }}>後台巡查證據</div>
      <Pill color={ok ? "#22c55e" : "#f59e0b"}>{scan?.engine_version || (ok ? "PASS" : "待確認")}</Pill>
    </div>
    <div style={{ marginTop: 8, color: "#cbd5e1", fontSize: 13, lineHeight: 1.55, fontWeight: 850 }}>
      最後巡查：{runAt}<br />
      資料源：{scan?.source || "—"}｜已掃描：{scan?.scanned_count ?? "—"}/{scan?.universe_count ?? "—"}｜新訊號：{scan?.new_signal_count ?? "—"}｜錯誤：{scan?.error_count ?? "—"}
    </div>
  </section>;
}

export default function Paper2560() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/2560-paper")
      .then((r) => r.json())
      .then((j) => j.ok ? setData(j) : setError(j.error || "讀取失敗"))
      .catch((e) => setError(e.message));
  }, []);

  const s = data?.summary;
  const activeRows = data ? [...data.open, ...data.pending] : [];
  const scans = data?.scans || [];
  const triggeredScans = scans.filter((x) => x.stage_status === "TRIGGERED" && x.gate_status === "PASS" && x.risk_status === "NORMAL");
  const setupScans = scans.filter((x) => ["PRICE_SETUP", "VOLUME_SETUP"].includes(x.stage_status) && x.gate_status === "PASS");
  const riskScans = scans.filter((x) => x.gate_status === "REJECTED" || !["NORMAL", undefined, null].includes(x.risk_status));
  const profiles = s?.universeProfiles || [];
  const activeTickers = useMemo(() => new Set(activeRows.map((r) => pick(r, ["ticker", "股票"], ""))), [activeRows]);
  const waitingProfiles = profiles.filter((x) => !activeTickers.has(x.ticker));
  const openExposure = ((s?.open || 0) + (s?.pending || 0)) * 100;

  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "radial-gradient(circle at top,#0f2a44 0%,#020617 42%,#020617 100%)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "22px 14px 44px" }}>
      <a href="/" style={{ color: "#93c5fd", textDecoration: "none", fontWeight: 900 }}>← 返回專案首頁</a>
      <header style={{ marginTop: 18, marginBottom: 16, border: "1px solid rgba(56,189,248,.22)", background: "linear-gradient(180deg,rgba(8,47,73,.42),rgba(2,6,23,.52))", borderRadius: 28, padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ color: "#38bdf8", letterSpacing: 2, fontWeight: 1000, fontSize: 13 }}>研究專案</div>
          <Pill color="#22c55e">憲法 V{s?.version || "1.0"}</Pill>
        </div>
        <h1 style={{ fontSize: 35, lineHeight: 1.05, margin: "12px 0 8px", fontWeight: 1000 }}>2560 技術研究室</h1>
        <p style={{ color: "#cbd5e1", lineHeight: 1.55, fontWeight: 850, margin: 0 }}>價格 MA5／MA25＋量能 VMA5／VMA60｜衝量、做量、縮量坑三分支｜只記錄，不執行真實下單。</p>
      </header>

      {error && <section style={{ border: "1px solid #ef444455", background: "#ef444414", color: "#fecaca", borderRadius: 20, padding: 16, fontWeight: 850 }}>讀取失敗：{error}</section>}
      {!data && !error && <section style={{ border: "1px solid rgba(148,163,184,.18)", background: "rgba(15,23,42,.76)", borderRadius: 22, padding: 18, color: "#94a3b8", fontWeight: 900 }}>讀取紙上交易狀態中…</section>}

      {s && <>
        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Stat label="正式觸發" value={triggeredScans.length} sub="Gate PASS＋Risk NORMAL" color="#22c55e" />
          <Stat label="結構準備中" value={setupScans.length} sub="價格／量能 Setup" color="#38bdf8" />
          <Stat label="風險／排除" value={riskScans.length} sub="Rejected／Extended／Too Deep" color="#f59e0b" />
          <Stat label="模擬曝險" value={money(openExposure)} sub={`OPEN ${s.open}｜PENDING ${s.pending}`} color="#a78bfa" />
        </section>

        <ScanProof scan={s.lastScan} />

        <Zone title="今日掃描狀態" sub="Gate、Stage、Pattern、Risk 四軸分離" count={scans.length} color="#38bdf8">
          {scans.length ? <div style={{ display: "grid", gap: 10 }}>{scans.map((row) => <ScanCard key={row.ticker} row={row} />)}</div> : <div style={{ color: "#64748b", fontWeight: 900 }}>等待新版引擎完成第一次掃描。</div>}
        </Zone>

        <Zone title="紙上交易運行中" sub="正式觸發後，隔日開盤建立紙上紀錄" count={activeRows.length} color="#22c55e">
          {activeRows.length ? <div style={{ display: "grid", gap: 10 }}>{activeRows.map((r, i) => <TradeCard key={pick(r, ["trade_id"], i)} row={r} />)}</div> : <div style={{ color: "#64748b", fontWeight: 900 }}>目前沒有運行中的紙上交易。</div>}
        </Zone>

        <Zone title="研究母池" sub="母池資格不等於今日買點；必須等待完整 2560 觸發" count={waitingProfiles.length} color="#a78bfa">
          <div style={{ display: "grid", gap: 10 }}>{waitingProfiles.map((x) => <SymbolCard key={x.ticker} item={x} />)}</div>
        </Zone>
      </>}
    </div>
  </main>;
}
