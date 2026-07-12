import { useEffect, useMemo, useState } from "react";

function n(value, digits = 2) {
  const x = Number(value || 0);
  return Number.isFinite(x) ? x.toFixed(digits) : "0.00";
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs || 20000);
  try {
    const { timeoutMs, ...fetchOptions } = options;
    const res = await fetch(url, { cache: "no-store", ...fetchOptions, signal: controller.signal });
    const text = await res.text();
    let json = {};
    try { json = text ? JSON.parse(text) : {}; } catch { throw new Error(`API 回傳不是 JSON：${url}`); }
    if (!res.ok || json.ok === false) throw new Error(json.error || json.message || `讀取失敗：${url}`);
    return json;
  } catch (err) {
    if (err?.name === "AbortError") throw new Error(`讀取逾時：${url}`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function key(symbol) {
  return String(symbol || "").toUpperCase().replace(/ON$/, "");
}

function getOpenRows(summary = {}) {
  const rows = Array.isArray(summary?.positions)
    ? summary.positions
    : Array.isArray(summary?.openPositions)
      ? summary.openPositions
      : Array.isArray(summary?.trades)
        ? summary.trades
        : [];
  return rows.filter((row) => String(row?.status || "OPEN").toUpperCase() === "OPEN");
}

function isCore(row = {}) {
  const text = `${row.group || ""} ${row.sourceType || ""} ${row.source || ""}`;
  return /既有V17十檔|既有10檔|existing_ten/i.test(text);
}

function groupLabel(row = {}) {
  return isCore(row) ? "核心10檔" : "預備名單";
}

function sumRows(rows = []) {
  return rows.reduce((acc, row) => {
    acc.cost += Number(row.amountUSDT || 0);
    acc.value += Number(row.currentValue || 0);
    acc.pnl += Number(row.pnl || 0);
    acc.lots += Number(row.lotCount || 1);
    return acc;
  }, { cost: 0, value: 0, pnl: 0, lots: 0 });
}

function aggregatePositions(rows = []) {
  const map = new Map();
  for (const row of rows || []) {
    const k = key(row.symbol);
    if (!k) continue;
    const current = map.get(k);
    const amountUSDT = Number(row.amountUSDT || 0);
    const quantity = Number(row.quantity || 0);
    const currentPrice = Number(row.currentPrice || row.tokenPrice || row.stockPrice || row.price || 0);
    if (!current) {
      map.set(k, { ...row, id: `AGG-${k}`, lotCount: 1, amountUSDT, quantity, currentPrice, price: quantity > 0 ? amountUSDT / quantity : Number(row.price || 0) });
      continue;
    }
    const totalAmount = Number(current.amountUSDT || 0) + amountUSDT;
    const totalQuantity = Number(current.quantity || 0) + quantity;
    const highProgress = row.highProgress?.enabled ? row.highProgress : current.highProgress;
    map.set(k, {
      ...current,
      ...row,
      id: `AGG-${k}`,
      symbol: current.symbol || row.symbol,
      group: isCore(current) ? current.group : row.group,
      sourceType: isCore(current) ? current.sourceType : row.sourceType,
      amountUSDT: totalAmount,
      quantity: totalQuantity,
      currentPrice: currentPrice || current.currentPrice,
      price: totalQuantity > 0 ? totalAmount / totalQuantity : current.price,
      lotCount: Number(current.lotCount || 1) + 1,
      highProgress,
      high52w: highProgress?.high52w || row.high52w || current.high52w,
      discountFromHighPct: highProgress?.discountFromHighPct ?? row.discountFromHighPct ?? current.discountFromHighPct,
      gapToHigh: highProgress?.gapToHigh ?? row.gapToHigh ?? current.gapToHigh,
    });
  }
  return [...map.values()].map((row) => {
    const currentValue = Number(row.currentPrice || 0) * Number(row.quantity || 0);
    const cost = Number(row.amountUSDT || 0);
    const pnl = Number.isFinite(currentValue) && currentValue > 0 ? currentValue - cost : Number(row.pnl || 0);
    return { ...row, currentValue: currentValue || Number(row.currentValue || 0), pnl, pnlPct: cost > 0 ? pnl / cost : 0 };
  });
}

function daysSince(row = {}) {
  const raw = row.baselineResetAt || row.repairedAt || row.createdAt || row.dateKey;
  const t = Date.parse(raw);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

function validationText(row = {}) {
  const d = daysSince(row);
  const remain = Math.max(0, 28 - d);
  return remain > 0 ? `4週驗證中｜已 ${d} 天｜剩 ${remain} 天` : "已滿4週，只取得升格提案資格";
}

function rules(row = {}) {
  return Array.isArray(row.rules) ? row.rules.map(Number).filter(Number.isFinite) : [];
}

function amounts(row = {}) {
  const rs = rules(row);
  const arr = Array.isArray(row.amounts) ? row.amounts.map(Number) : [];
  return rs.map((_, i) => Number.isFinite(arr[i]) ? arr[i] : Number(row.amountUSDT || 5));
}

function tierStatus(row = {}) {
  const rs = rules(row).map((x) => Math.abs(x));
  const discount = Math.abs(Number(row.discountFromHighPct ?? row.discount ?? 0));
  if (!rs.length) return { label: "觀察中", left: "52W", right: "D1", pct: Math.max(0, Math.min(100, Number(row.highProgress?.progressPct || 0))), completedIndex: -1, discount };
  let completedIndex = -1;
  for (let i = 0; i < rs.length; i += 1) if (discount >= rs[i]) completedIndex = i;
  const prev = completedIndex >= 0 ? rs[completedIndex] : 0;
  const next = completedIndex + 1 < rs.length ? rs[completedIndex + 1] : rs[completedIndex] || rs[0];
  const segment = next > prev ? ((discount - prev) / (next - prev)) * 100 : 100;
  const pct = completedIndex >= rs.length - 1 ? 100 : Math.max(2, Math.min(98, segment));
  return {
    label: completedIndex >= 0 ? `已完成：D${completedIndex + 1}` : "未達：D1",
    left: completedIndex >= 0 ? `D${completedIndex + 1}` : "52W",
    right: completedIndex + 1 < rs.length ? `D${completedIndex + 2}` : `D${rs.length}`,
    pct,
    completedIndex,
    discount,
  };
}

function Box({ title, children, tone = "blue" }) {
  const border = tone === "green" ? "rgba(34,197,94,.38)" : tone === "red" ? "rgba(248,113,113,.36)" : tone === "yellow" ? "rgba(245,158,11,.34)" : "rgba(59,130,246,.30)";
  return <section style={{ marginTop: 12, border: `1px solid ${border}`, background: "rgba(15,23,42,.78)", borderRadius: 20, padding: 14 }}>
    <h2 style={{ margin: "0 0 10px", color: "#f8fafc", fontSize: 17, fontWeight: 1000 }}>{title}</h2>
    {children}
  </section>;
}

function MiniStat({ label, value, color = "#cbd5e1" }) {
  return <div style={{ minWidth: 0 }}>
    <div style={{ color: "#64748b", fontSize: 9, fontWeight: 1000 }}>{label}</div>
    <div style={{ color, fontSize: 11, fontWeight: 1000, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
  </div>;
}

function ProgressBar({ row }) {
  const tier = tierStatus(row);
  const pct = Math.max(0, Math.min(100, Number(tier.pct || 0)));
  const hp = row.highProgress;
  return <div style={{ marginTop: 10, borderRadius: 17, border: "1px solid rgba(6,182,212,.18)", background: "rgba(2,6,23,.50)", padding: 12 }}>
    <div style={{ padding: "10px 12px", borderRadius: 14, background: "rgba(34,197,94,.10)", border: "1px solid rgba(34,197,94,.24)", color: "#bbf7d0", fontSize: 18, fontWeight: 1000 }}>{tier.label}</div>
    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, color: "#e2e8f0", fontSize: 13, fontWeight: 1000 }}><span>{tier.left}</span><span>{tier.right}</span></div>
    <div style={{ height: 10, borderRadius: 999, background: "rgba(8,47,73,.9)", marginTop: 10, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#00ffa3,#00e5ff,#facc15)" }} />
    </div>
    <div style={{ marginTop: 8, color: "#22d3ee", fontWeight: 1000, fontSize: 14 }}>{n(tier.pct, 0)}%｜目前折價 {n(tier.discount, 1)}%</div>
    {hp?.enabled ? <div style={{ marginTop: 8, color: "#94a3b8", fontWeight: 850, fontSize: 11 }}>52週高點絕對值：{n(hp.progressPct, 1)}%｜現價 ${n(hp.currentPrice)}｜52週高 ${n(hp.high52w)}</div> : null}
  </div>;
}

function TierRules({ row }) {
  const rs = rules(row);
  const amts = amounts(row);
  const high = Number(row.highProgress?.high52w || row.high52w || 0);
  if (!rs.length) return null;
  return <div style={{ marginTop: 10 }}>
    <div style={{ color: "#22d3ee", fontSize: 15, fontWeight: 1000, marginBottom: 7 }}>層級規則</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 7 }}>
      {rs.map((rule, i) => <div key={`${row.symbol}-${i}`} style={{ borderRadius: 13, padding: 8, textAlign: "center", border: "1px solid rgba(148,163,184,.18)", background: "rgba(15,23,42,.58)", color: "#cbd5e1" }}>
        <div style={{ fontSize: 16, fontWeight: 1000 }}>D{i + 1}</div>
        <div style={{ fontSize: 11, fontWeight: 1000 }}>{rule}%</div>
        <div style={{ fontSize: 11, fontWeight: 1000 }}>{amts[i]}U</div>
        <div style={{ marginTop: 3, fontSize: 10, color: "#64748b", fontWeight: 900 }}>${n(high * (1 + Number(rule) / 100), 0)}</div>
      </div>)}
    </div>
  </div>;
}

function PositionCard({ row, paperOnly = false }) {
  const pnl = Number(row.pnl || 0);
  const pnlColor = pnl >= 0 ? "#bbf7d0" : "#fecaca";
  return <div style={{ padding: 13, borderRadius: 22, background: "linear-gradient(180deg,rgba(6,78,59,.28),rgba(2,6,23,.72))", border: "1px solid rgba(34,197,94,.28)", boxShadow: "0 18px 40px rgba(0,0,0,.20)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
      <div><div style={{ color: "#f8fafc", fontSize: 22, fontWeight: 1000 }}>{row.symbol}</div><div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 850 }}>{row.name || row.bucket || "—"}</div></div>
      <div style={{ textAlign: "right" }}><div style={{ color: "#bbf7d0", fontSize: 11, fontWeight: 1000 }}>{groupLabel(row)}</div><div style={{ color: pnlColor, fontSize: 13, fontWeight: 1000 }}>{n((row.pnlPct || 0) * 100)}%</div></div>
    </div>
    {paperOnly ? <div style={{ marginTop: 9, padding: "8px 10px", borderRadius: 14, background: "rgba(245,158,11,.12)", color: "#fde68a", fontSize: 12, fontWeight: 1000, lineHeight: 1.45 }}>{validationText(row)}｜進折扣獵人必須 Josh 明確同意</div> : null}
    <ProgressBar row={row} />
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginTop: 10 }}>
      <MiniStat label="總成本" value={`$${n(row.amountUSDT)}`} />
      <MiniStat label="市值" value={`$${n(row.currentValue)}`} />
      <MiniStat label="損益" value={`$${n(row.pnl)}`} color={pnlColor} />
      <MiniStat label="現價" value={`$${n(row.currentPrice)}`} />
      <MiniStat label="均價" value={`$${n(row.price)}`} />
      <MiniStat label="股數" value={n(row.quantity, 4)} />
      <MiniStat label="批次" value={`${row.lotCount || 1}`} />
      <MiniStat label="真倉" value="禁止" />
    </div>
    <TierRules row={row} />
  </div>;
}

function PositionSection({ title, rows = [], tone = "blue", defaultOpen = true, paperOnly = false }) {
  if (!rows.length) return null;
  const sums = sumRows(rows);
  const pnlPct = sums.cost > 0 ? sums.pnl / sums.cost : 0;
  const progressCount = rows.filter((row) => row.highProgress?.enabled).length;
  return <Box title={`${title}（${rows.length}檔 / ${sums.lots}筆）`} tone={tone}>
    <div style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 900, marginBottom: 8 }}>成本 ${n(sums.cost)}｜市值 ${n(sums.value)}｜損益 ${n(sums.pnl)}｜報酬 {n(pnlPct * 100)}%</div>
    {paperOnly ? <div style={{ marginBottom: 8, color: "#fde68a", background: "rgba(245,158,11,.10)", border: "1px solid rgba(245,158,11,.22)", borderRadius: 12, padding: 9, fontSize: 12, fontWeight: 950, lineHeight: 1.5 }}>預備名單只在本頁跑滿 4 週；滿 4 週也只取得提案資格。52週高點進度條：{progressCount}/{rows.length} 檔已啟用。</div> : null}
    <details open={defaultOpen}><summary style={{ cursor: "pointer", color: "#bfdbfe", fontWeight: 1000, fontSize: 13 }}>展開 / 收合卡片</summary><div style={{ display: "grid", gap: 12, marginTop: 10 }}>{rows.map((row) => <PositionCard key={row.symbol} row={row} paperOnly={paperOnly} />)}</div></details>
  </Box>;
}

export async function getServerSideProps({ req }) {
  const host = req?.headers?.host || process.env.VERCEL_URL || "discount-hunter-sigma.vercel.app";
  const proto = host.includes("localhost") ? "http" : "https";
  try {
    const res = await fetch(`${proto}://${host}/api/v17/paper-summary?ssr=1`, { headers: { "cache-control": "no-store" } });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = null; }
    if (!res.ok || json?.ok === false || !json) {
      return { props: { initialSummary: null, initialError: json?.error || json?.message || `SSR讀取失敗 ${res.status}` } };
    }
    return { props: { initialSummary: json, initialError: "" } };
  } catch (err) {
    return { props: { initialSummary: null, initialError: `SSR資料讀取失敗：${err?.message || "unknown"}` } };
  }
}

export default function PaperAutoPage({ initialSummary = null, initialError = "" }) {
  const [summary, setSummary] = useState(initialSummary);
  const [lastRun, setLastRun] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError || "");

  async function load() {
    setBusy(true);
    setError("");
    try {
      const paper = await fetchJson(`/api/v17/paper-summary?t=${Date.now()}`);
      setSummary(paper);
    } catch (err) {
      setError(err.message || "讀取失敗");
    } finally {
      setBusy(false);
    }
  }

  async function runPaper() {
    setBusy(true);
    setError("");
    try {
      const result = await fetchJson(`/api/v17/paper-auto-run?t=${Date.now()}`, { timeoutMs: 25000 });
      setLastRun(result);
      const paper = await fetchJson(`/api/v17/paper-summary?t=${Date.now()}`);
      setSummary(paper);
    } catch (err) {
      setError(err.message || "執行失敗");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!summary) load();
  }, []);

  const openRows = useMemo(() => getOpenRows(summary), [summary]);
  const grouped = useMemo(() => aggregatePositions(openRows), [openRows]);
  const core = useMemo(() => grouped.filter(isCore), [grouped]);
  const prepared = useMemo(() => grouped.filter((row) => !isCore(row)), [grouped]);
  const portfolio = useMemo(() => sumRows(grouped), [grouped]);
  const pnlColor = Number(portfolio.pnl || 0) >= 0 ? "#bbf7d0" : "#fecaca";
  const pnlPct = portfolio.cost > 0 ? portfolio.pnl / portfolio.cost : 0;
  const apiGroups = summary?.summary?.groups || {};
  const apiCoreCount = Number(apiGroups?.["既有V17十檔"]?.symbolCount ?? summary?.summary?.existingTenCount ?? 0);
  const apiPreparedCount = Number(apiGroups?.["預備名單"]?.symbolCount ?? summary?.summary?.preparedListCount ?? 0);
  const displayCoreCount = core.length || apiCoreCount;
  const displayPreparedCount = prepared.length || apiPreparedCount;
  const rawLotCount = Number(summary?.summary?.openTrades || portfolio.lots || 0);
  const progressCount = prepared.filter((row) => row.highProgress?.enabled).length || Number(summary?.highProgressHealth?.enabledCount || 0);
  const displayCost = portfolio.cost || Number(summary?.summary?.cost || 0);
  const displayValue = portfolio.value || Number(summary?.summary?.value || 0);
  const displayPnl = portfolio.pnl || Number(summary?.summary?.pnl || 0);
  const displayPnlPct = portfolio.cost > 0 ? pnlPct : Number(summary?.summary?.pnlPct || 0);

  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "linear-gradient(180deg,#020617 0%,#07111f 55%,#0f172a 100%)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "22px 14px 40px" }}>
      <a href="/v17" style={{ color: "#93c5fd", textDecoration: "none", fontWeight: 900 }}>← 返回折價獵人 V17</a>
      <header style={{ marginTop: 18, marginBottom: 14 }}>
        <div style={{ color: "#22c55e", letterSpacing: 3, fontWeight: 1000, fontSize: 13 }}>V17 紙上交易自動測試</div>
        <h1 style={{ fontSize: 30, lineHeight: 1.05, margin: "10px 0", fontWeight: 1000 }}>紙上交易總控台</h1>
        <p style={{ color: "#cbd5e1", lineHeight: 1.5, fontWeight: 850, margin: 0 }}>折扣獵人主頁只放正式上線 10 檔；預備名單只能在本頁驗證，升格必須 Josh 明確同意。</p>
      </header>

      {error ? <Box title="錯誤" tone="red"><div style={{ color: "#fecaca", fontWeight: 850 }}>{error}</div></Box> : null}
      {busy && !summary ? <Box title="載入中"><div style={{ color: "#bfdbfe", fontWeight: 900 }}>正在讀取紙上交易資料，不會顯示假 0。</div></Box> : null}

      <Box title="總覽" tone="green">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, color: "#cbd5e1", fontWeight: 850, fontSize: 13 }}>
          <div>模式：{summary?.settings?.mode || "AUTO_PAPER"}</div>
          <div>驗證期：4 週</div>
          <div>核心正式：{displayCoreCount} 檔</div>
          <div>預備名單：{displayPreparedCount} 檔</div>
          <div>紙上批次：{rawLotCount} 筆</div>
          <div>進度條：{progressCount}/{displayPreparedCount}</div>
          <div>投入成本：${n(displayCost)}</div>
          <div>目前市值：${n(displayValue)}</div>
          <div>損益：<strong style={{ color: pnlColor }}>${n(displayPnl)}</strong></div>
          <div>報酬率：<strong style={{ color: pnlColor }}>{n(displayPnlPct * 100)}%</strong></div>
          <div>真實下單：禁止</div>
        </div>
        <div style={{ marginTop: 10, padding: 10, borderRadius: 14, background: "rgba(2,6,23,.38)", border: "1px solid rgba(148,163,184,.12)", color: "#cbd5e1", fontWeight: 850, fontSize: 12, lineHeight: 1.6 }}>核心10檔 {displayCoreCount}｜4週紙上 {displayPreparedCount}｜總計 {grouped.length || summary?.summary?.symbolCount || 0}｜資料源：/api/v17/paper-summary</div>
      </Box>

      <Box title="操作">
        <button disabled={busy} onClick={runPaper} style={{ width: "100%", padding: "13px 10px", borderRadius: 14, border: "1px solid rgba(34,197,94,.45)", background: "rgba(34,197,94,.18)", color: "#bbf7d0", fontWeight: 1000 }}>{busy ? "執行中..." : "今天跑一次紙上交易"}</button>
        <button disabled={busy} onClick={load} style={{ width: "100%", marginTop: 8, padding: "12px 10px", borderRadius: 14, border: "1px solid rgba(59,130,246,.35)", background: "rgba(59,130,246,.12)", color: "#bfdbfe", fontWeight: 1000 }}>重新整理</button>
        {lastRun ? <div style={{ marginTop: 10, color: "#bbf7d0", fontWeight: 900 }}>掃描 {lastRun.eligibleCount || lastRun.scanScope?.total || 0} 檔，新增 {lastRun.createdCount} 筆，略過 {lastRun.skippedCount} 筆。</div> : null}
        {lastRun?.skipped?.length ? <details style={{ marginTop: 8, color: "#fde68a", fontSize: 12, fontWeight: 850, lineHeight: 1.45 }}><summary>查看略過明細</summary>{lastRun.skipped.slice(0, 28).map((x) => <div key={`${x.symbol}-${x.existingId || x.reason}`}>{x.symbol}：{x.reason}</div>)}</details> : null}
      </Box>

      <Box title="收斂規則" tone="yellow">
        <div style={{ color: "#cbd5e1", fontWeight: 850, lineHeight: 1.6, fontSize: 13 }}>
          <div>折扣獵人主頁：只放目前正式上線 10 檔。</div>
          <div>預備名單：必須先在本頁跑滿 4 週。</div>
          <div>滿 4 週：只取得提案資格；進折扣獵人必須 Josh 明確同意。</div>
          <div>禁止真實下單、禁止自動交易。</div>
        </div>
      </Box>

      <PositionSection title="核心正式10檔紙上追蹤" rows={core} tone="blue" defaultOpen={false} />
      <PositionSection title="預備名單 4週紙上驗證區" rows={prepared} tone="green" defaultOpen paperOnly />
    </div>
  </main>;
}
