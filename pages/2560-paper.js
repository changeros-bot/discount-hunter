import { useEffect, useMemo, useState } from "react";

const money = (v) => v === null || v === undefined ? "—" : `$${Number(v).toFixed(2)}`;
const statusZh = { PENDING: "等待隔日開盤", OPEN: "紙上交易運行中", CLOSED: "已結案" };
const gateZh = { PASS: "通過", REJECTED: "排除", CONDITIONAL: "條件通過", LEGACY: "舊版紀錄" };
const patternZh = {
  RUSH_VOLUME: "衝量",
  BUILT_VOLUME: "做量",
  VOLUME_PIT: "縮量坑",
  NONE: "尚無模式",
  "縮量黑馬": "縮量坑（舊版）",
  "弱量續攻": "舊版訊號",
};
const stageZh = {
  WATCH: "正常觀察",
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
const reasonZh = {
  WAITING_FOR_PRICE_SETUP: "等待價格結構成立",
  WAITING_FOR_VOLUME_CONFIRM: "價格條件成立，等待量能確認",
  VOLUME_STRUCTURE_INCOMPLETE: "量能結構尚未完整",
  MA25_NOT_UP: "25 日均線尚未向上或走平",
  STRUCTURE_BROKEN: "回踩結構已破壞或出現明顯派發",
  PRICE_EXTENDED: "股價距離 25 日均線過遠，不追價",
  PRICE_TOO_DEEP: "股價跌破 25 日均線過深，結構受損",
  VOLUME_BELOW_60_FALSE_START: "5 日均量仍低於 60 日均量，疑似假啟動",
  VMA5_CROSS_VMA60: "5 日均量上穿 60 日均量，形成衝量",
  PRIOR_VOLUME_BUILT: "前波量能已建立，形成做量模式",
  ESTABLISHED_VOLUME_WITH_PIT: "量能結構成熟並出現縮量坑",
  LEGACY_RECORD: "舊版紙上交易紀錄",
  MARKET_DATA_SOURCE_PENDING: "等待可用的 OHLCV 行情資料源",
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
const sourceZh = {
  yfinance: "Yahoo Finance 價格與成交量",
  csv: "CSV 歷史資料",
  binance: "Binance 原生資料",
  "binance_rwa_ohlc+yahoo_underlying_volume": "Binance RWA 價格＋原股票歷史成交量",
  github_actions_market_worker: "GitHub Actions 市場資料工作器",
};

function pick(row, keys, fallback = "") {
  for (const key of keys) if (row?.[key] !== undefined && row?.[key] !== "") return row[key];
  return fallback;
}

function tickerOf(row) {
  return String(pick(row, ["ticker", "股票"], "")).trim().toUpperCase();
}

function tradePriority(row) {
  const hasEntry = Number.isFinite(Number(row?.entry_price)) && Number(row?.entry_price) > 0 ? 100 : 0;
  const status = row?.status === "OPEN" ? 20 : row?.status === "PENDING" ? 10 : 0;
  const updated = Date.parse(row?.updated_at || row?.created_at || row?.signal_date || "") || 0;
  return hasEntry + status + updated / 1e15;
}

function uniqueByTicker(rows, priority = () => 0) {
  const best = new Map();
  for (const row of rows || []) {
    const ticker = tickerOf(row);
    if (!ticker) continue;
    const current = best.get(ticker);
    if (!current || priority(row) > priority(current)) best.set(ticker, row);
  }
  return [...best.values()];
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
    <div style={{ marginTop: 8, color: "#93c5fd", fontSize: 13, lineHeight: 1.45, fontWeight: 900 }}>狀態：{item.scan_enabled ? "等待下一次掃描" : "等待可用的 OHLCV 行情資料源"}</div>
  </div>;
}

function TradeCard({ row }) {
  const ticker = tickerOf(row) || "—";
  const statusRaw = pick(row, ["status"], "");
  const status = statusZh[statusRaw] || exitZh[pick(row, ["exit_reason"], "")] || "—";
  const patternRaw = pick(row, ["pattern_zh", "型態", "pattern"], "—");
  const pattern = patternZh[patternRaw] || patternRaw;
  const entry = pick(row, ["進場價", "entry_price"], "等待隔日開盤");
  const last = pick(row, ["最後價格", "last_price", "出場價", "exit_price"], "—");
  const ret = pick(row, ["報酬率", "return_pct"], "—");
  const isPending = statusRaw === "PENDING";
  const reason = reasonZh[row.signal_reason] || row.signal_reason || "—";
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
    <div style={{ marginTop: 8, color: "#94a3b8", fontSize: 12, lineHeight: 1.45, fontWeight: 800 }}>目前原因：{reason}</div>
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
      <div>門檻<br /><b style={{ color: row.gate_status === "PASS" ? "#4ade80" : "#f87171" }}>{gateZh[row.gate_status] || row.gate_status || "—"}</b></div>
      <div>模式<br /><b style={{ color: "#f8fafc" }}>{row.pattern_zh || patternZh[row.pattern_type] || "尚無模式"}</b></div>
      <div>風險<br /><b style={{ color: "#f8fafc" }}>{riskZh[row.risk_status] || row.risk_status || "—"}</b></div>
      <div>MA25 距離<br /><b style={{ color: "#f8fafc" }}>{row.distance_to_ma25_atr ?? "—"} ATR</b></div>
      <div>價格 5／25<br /><b style={{ color: "#f8fafc" }}>{row.ma5_price ?? "—"}／{row.ma25_price ?? "—"}</b></div>
      <div>量能 5／60<br /><b style={{ color: "#f8fafc" }}>{row.vma5 ?? "—"}／{row.vma60 ?? "—"}</b></div>
    </div>
    <div style={{ marginTop: 10, color: "#94a3b8", fontSize: 12, lineHeight: 1.45, fontWeight: 800 }}>原因：{reasonZh[row.reason] || row.reason || "—"}</div>
  </div>;
}

function ScanProof({ scan }) {
  const runAt = scan?.run_at_utc ? new Date(scan.run_at_utc).toLocaleString("zh-TW", { hour12: false }) : "尚無巡查紀錄";
  const ok = scan?.ok;
  const source = sourceZh[scan?.source] || scan?.source || "—";
  return <section style={{ marginTop: 14, border: `1px solid ${ok ? "#22c55e55" : "#f59e0b55"}`, background: ok ? "rgba(20,83,45,.16)" : "rgba(120,53,15,.16)", borderRadius: 22, padding: 14 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
      <div style={{ color: "#f8fafc", fontWeight: 1000 }}>後台巡查證據</div>
      <Pill color={ok ? "#22c55e" : "#f59e0b"}>{scan?.engine_version || (ok ? "通過" : "待確認")}</Pill>
    </div>
    <div style={{ marginTop: 8, color: "#cbd5e1", fontSize: 13, lineHeight: 1.55, fontWeight: 850 }}>
      最後巡查：{runAt}<br />
      資料源：{source}<br />
      已掃描：{scan?.scanned_count ?? "—"}/{scan?.universe_count ?? "—"}｜新訊號：{scan?.new_signal_count ?? "—"}｜錯誤：{scan?.error_count ?? "—"}
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
  const rawActiveRows = data ? [...(data.open || []), ...(data.pending || [])] : [];
  const activeRows = useMemo(() => uniqueByTicker(rawActiveRows, tradePriority), [data]);
  const activeTickers = useMemo(() => new Set(activeRows.map(tickerOf)), [activeRows]);
  const allScans = useMemo(() => uniqueByTicker(data?.scans || []), [data]);
  const scans = useMemo(() => allScans.filter((row) => !activeTickers.has(tickerOf(row))), [allScans, activeTickers]);
  const scanTickers = useMemo(() => new Set(allScans.map(tickerOf)), [allScans]);
  const profiles = useMemo(() => uniqueByTicker(s?.universeProfiles || []), [s]);
  const waitingProfiles = useMemo(
    () => profiles.filter((x) => !activeTickers.has(tickerOf(x)) && !scanTickers.has(tickerOf(x))),
    [profiles, activeTickers, scanTickers]
  );
  const triggeredScans = scans.filter((x) => x.stage_status === "TRIGGERED" && x.gate_status === "PASS" && x.risk_status === "NORMAL");
  const setupScans = scans.filter((x) => ["PRICE_SETUP", "VOLUME_SETUP"].includes(x.stage_status) && x.gate_status === "PASS" && x.risk_status === "NORMAL");
  const riskScans = scans.filter((x) => x.gate_status === "REJECTED" || !["NORMAL", undefined, null].includes(x.risk_status));
  const classifiedTickers = new Set([...triggeredScans, ...setupScans, ...riskScans].map(tickerOf));
  const normalScans = scans.filter((x) => !classifiedTickers.has(tickerOf(x)));
  const classifiedTotal = triggeredScans.length + setupScans.length + normalScans.length + riskScans.length;
  const openExposure = activeRows.length * 100;

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
          <Stat label="本次已掃描" value={scans.length} sub={`四類合計 ${classifiedTotal} 檔`} color="#f8fafc" />
          <Stat label="正式觸發" value={triggeredScans.length} sub="門檻通過＋風險正常" color="#22c55e" />
          <Stat label="結構準備中" value={setupScans.length} sub="價格／量能準備" color="#38bdf8" />
          <Stat label="正常觀察" value={normalScans.length} sub="門檻通過，尚未形成結構" color="#60a5fa" />
          <Stat label="風險／排除" value={riskScans.length} sub="排除／過度延伸／跌深" color="#f59e0b" />
          <Stat label="模擬曝險" value={money(openExposure)} sub={`不重複部位 ${activeRows.length} 檔`} color="#a78bfa" />
        </section>

        <ScanProof scan={s.lastScan} />

        <Zone title="今日觀察／掃描狀態" sub="已排除正在紙上交易的標的，三區不重複" count={scans.length} color="#38bdf8">
          {scans.length ? <div style={{ display: "grid", gap: 10 }}>{scans.map((row) => <ScanCard key={tickerOf(row)} row={row} />)}</div> : <div style={{ color: "#64748b", fontWeight: 900 }}>目前沒有單純觀察中的標的。</div>}
        </Zone>

        <Zone title="紙上交易運行中" sub="同一股票只保留一筆有效部位顯示" count={activeRows.length} color="#22c55e">
          {activeRows.length ? <div style={{ display: "grid", gap: 10 }}>{activeRows.map((r) => <TradeCard key={tickerOf(r)} row={r} />)}</div> : <div style={{ color: "#64748b", fontWeight: 900 }}>目前沒有運行中的紙上交易。</div>}
        </Zone>

        <Zone title="研究母池／等待資料" sub="僅顯示未進入線上交易、也沒有當日掃描資料的標的" count={waitingProfiles.length} color="#a78bfa">
          {waitingProfiles.length ? <div style={{ display: "grid", gap: 10 }}>{waitingProfiles.map((x) => <SymbolCard key={tickerOf(x)} item={x} />)}</div> : <div style={{ color: "#64748b", fontWeight: 900 }}>所有母池標的皆已進入掃描或紙上交易。</div>}
        </Zone>
      </>}
    </div>
  </main>;
}
