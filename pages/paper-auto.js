function n(value, digits = 2) {
  const x = Number(value || 0);
  return Number.isFinite(x) ? x.toFixed(digits) : "0.00";
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

function tierStatus(row = {}) {
  const rs = rules(row).map((x) => Math.abs(x));
  const discount = Math.abs(Number(row.discountFromHighPct ?? row.discount ?? 0));
  if (!rs.length) return { label: "觀察中", pct: Math.max(0, Math.min(100, Number(row.highProgress?.progressPct || 0))), discount };
  let completedIndex = -1;
  for (let i = 0; i < rs.length; i += 1) if (discount >= rs[i]) completedIndex = i;
  const prev = completedIndex >= 0 ? rs[completedIndex] : 0;
  const next = completedIndex + 1 < rs.length ? rs[completedIndex + 1] : rs[completedIndex] || rs[0];
  const segment = next > prev ? ((discount - prev) / (next - prev)) * 100 : 100;
  const pct = completedIndex >= rs.length - 1 ? 100 : Math.max(2, Math.min(98, segment));
  return { label: completedIndex >= 0 ? `已完成：D${completedIndex + 1}` : "未達：D1", pct, discount };
}

function cleanReason(reason = "") {
  return String(reason || "").replace(/已有\s*7\s*天內\s*OPEN\s*紙上測試；防重複建倉/g, "已有進行中的 OPEN 紙上部位；防重複建倉");
}

function runCoverage(lastRun = {}, total = 0) {
  const scanned = Number(lastRun?.eligibleCount || lastRun?.scanScope?.total || 14);
  const all = Number(total || lastRun?.coverage?.currentOpenSymbolCount || lastRun?.paperCoverage?.currentOpenSymbolCount || 28);
  return {
    scanned,
    total: all,
    independent: Math.max(0, all - scanned),
    created: Number(lastRun?.createdCount || 0),
    skipped: Number(lastRun?.skippedCount || 0),
  };
}

function Box({ title, children, tone = "blue" }) {
  const border = tone === "green" ? "rgba(34,197,94,.38)" : tone === "red" ? "rgba(248,113,113,.36)" : tone === "yellow" ? "rgba(245,158,11,.34)" : "rgba(59,130,246,.30)";
  return <section style={{ marginTop: 12, border: `1px solid ${border}`, background: "rgba(15,23,42,.78)", borderRadius: 20, padding: 14 }}>
    <h2 style={{ margin: "0 0 10px", color: "#f8fafc", fontSize: 17, fontWeight: 1000 }}>{title}</h2>
    {children}
  </section>;
}

function LinkButton({ href, children, tone = "green" }) {
  const color = tone === "blue" ? "#bfdbfe" : "#bbf7d0";
  const border = tone === "blue" ? "rgba(59,130,246,.35)" : "rgba(34,197,94,.45)";
  const bg = tone === "blue" ? "rgba(59,130,246,.12)" : "rgba(34,197,94,.18)";
  return <a href={href} style={{ display: "block", width: "100%", boxSizing: "border-box", textAlign: "center", padding: "13px 10px", borderRadius: 14, border: `1px solid ${border}`, background: bg, color, fontWeight: 1000, textDecoration: "none", marginTop: tone === "blue" ? 8 : 0 }}>{children}</a>;
}

function PositionCard({ row, paperOnly = false }) {
  const pnl = Number(row.pnl || 0);
  const pnlColor = pnl >= 0 ? "#bbf7d0" : "#fecaca";
  const tier = tierStatus(row);
  const hp = row.highProgress || {};
  return <div style={{ padding: 13, borderRadius: 22, background: "linear-gradient(180deg,rgba(6,78,59,.28),rgba(2,6,23,.72))", border: "1px solid rgba(34,197,94,.28)", boxShadow: "0 18px 40px rgba(0,0,0,.20)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
      <div><div style={{ color: "#f8fafc", fontSize: 22, fontWeight: 1000 }}>{row.symbol}</div><div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 850 }}>{row.name || row.bucket || "—"}</div></div>
      <div style={{ textAlign: "right" }}><div style={{ color: "#bbf7d0", fontSize: 11, fontWeight: 1000 }}>{isCore(row) ? "核心10檔" : "預備名單"}</div><div style={{ color: pnlColor, fontSize: 13, fontWeight: 1000 }}>{n((row.pnlPct || 0) * 100)}%</div></div>
    </div>
    {paperOnly ? <div style={{ marginTop: 9, padding: "8px 10px", borderRadius: 14, background: "rgba(245,158,11,.12)", color: "#fde68a", fontSize: 12, fontWeight: 1000, lineHeight: 1.45 }}>{validationText(row)}｜進折扣獵人必須 Josh 明確同意</div> : null}
    <div style={{ marginTop: 10, borderRadius: 17, border: "1px solid rgba(6,182,212,.18)", background: "rgba(2,6,23,.50)", padding: 12 }}>
      <div style={{ padding: "10px 12px", borderRadius: 14, background: "rgba(34,197,94,.10)", border: "1px solid rgba(34,197,94,.24)", color: "#bbf7d0", fontSize: 18, fontWeight: 1000 }}>{tier.label}</div>
      <div style={{ height: 10, borderRadius: 999, background: "rgba(8,47,73,.9)", marginTop: 10, overflow: "hidden" }}><div style={{ width: `${Math.max(0, Math.min(100, Number(tier.pct || 0)))}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#00ffa3,#00e5ff,#facc15)" }} /></div>
      <div style={{ marginTop: 8, color: "#22d3ee", fontWeight: 1000, fontSize: 14 }}>{n(tier.pct, 0)}%｜目前折價 {n(tier.discount, 1)}%</div>
      {hp?.enabled ? <div style={{ marginTop: 8, color: "#94a3b8", fontWeight: 850, fontSize: 11 }}>52週高點絕對值：{n(hp.progressPct, 1)}%｜現價 ${n(hp.currentPrice)}｜52週高 ${n(hp.high52w)}</div> : null}
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginTop: 10, color: "#cbd5e1", fontSize: 11, fontWeight: 900 }}>
      <div>成本<br />${n(row.amountUSDT)}</div><div>市值<br />${n(row.currentValue)}</div><div style={{ color: pnlColor }}>損益<br />${n(row.pnl)}</div><div>現價<br />${n(row.currentPrice)}</div>
      <div>均價<br />${n(row.price)}</div><div>股數<br />{n(row.quantity, 4)}</div><div>批次<br />{row.lotCount || 1}</div><div>真倉<br />禁止</div>
    </div>
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

async function readJson(url) {
  const res = await fetch(url, { headers: { "cache-control": "no-store" } });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  if (!res.ok || json?.ok === false || !json) throw new Error(json?.error || json?.message || `讀取失敗 ${res.status}`);
  return json;
}

export async function getServerSideProps({ req, query }) {
  const host = req?.headers?.host || process.env.VERCEL_URL || "discount-hunter-sigma.vercel.app";
  const proto = host.includes("localhost") ? "http" : "https";
  const base = `${proto}://${host}`;
  let initialRun = null;
  let runError = "";
  try {
    if (query?.action === "run") {
      initialRun = await readJson(`${base}/api/v17/paper-auto-run?ssr=1&t=${Date.now()}`);
    }
  } catch (err) {
    runError = `執行檢查失敗：${err?.message || "unknown"}`;
  }
  try {
    const json = await readJson(`${base}/api/v17/paper-summary?ssr=1&t=${Date.now()}`);
    return { props: { initialSummary: json, initialRun, initialError: runError } };
  } catch (err) {
    return { props: { initialSummary: null, initialRun, initialError: runError || `SSR資料讀取失敗：${err?.message || "unknown"}` } };
  }
}

export default function PaperAutoPage({ initialSummary = null, initialRun = null, initialError = "" }) {
  const summary = initialSummary;
  const lastRun = initialRun;
  const error = initialError || "";
  const openRows = getOpenRows(summary);
  const grouped = aggregatePositions(openRows);
  const core = grouped.filter(isCore);
  const prepared = grouped.filter((row) => !isCore(row));
  const portfolio = sumRows(grouped);
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
  const displayTotal = grouped.length || Number(summary?.summary?.symbolCount || 0);
  const coverage = runCoverage(lastRun, displayTotal);
  const now = Date.now();

  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "linear-gradient(180deg,#020617 0%,#07111f 55%,#0f172a 100%)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "22px 14px 40px" }}>
      <a href="/v17" style={{ color: "#93c5fd", textDecoration: "none", fontWeight: 900 }}>← 返回折價獵人 V17</a>
      <header style={{ marginTop: 18, marginBottom: 14 }}>
        <div style={{ color: "#22c55e", letterSpacing: 3, fontWeight: 1000, fontSize: 13 }}>V17 紙上交易自動測試</div>
        <h1 style={{ fontSize: 30, lineHeight: 1.05, margin: "10px 0", fontWeight: 1000 }}>紙上交易總控台</h1>
        <p style={{ color: "#cbd5e1", lineHeight: 1.5, fontWeight: 850, margin: 0 }}>折扣獵人主頁只放正式上線 10 檔；預備名單只能在本頁驗證，升格必須 Josh 明確同意。</p>
      </header>

      {error ? <Box title="錯誤" tone="red"><div style={{ color: "#fecaca", fontWeight: 850 }}>{error}</div></Box> : null}

      <Box title="總覽" tone="green">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, color: "#cbd5e1", fontWeight: 850, fontSize: 13 }}>
          <div>模式：{summary?.settings?.mode || "AUTO_PAPER"}</div><div>驗證期：4 週</div>
          <div>核心正式：{displayCoreCount} 檔</div><div>預備名單：{displayPreparedCount} 檔</div>
          <div>紙上批次：{rawLotCount} 筆</div><div>進度條：{progressCount}/{displayPreparedCount}</div>
          <div>投入成本：${n(displayCost)}</div><div>目前市值：${n(displayValue)}</div>
          <div>損益：<strong style={{ color: pnlColor }}>${n(displayPnl)}</strong></div><div>報酬率：<strong style={{ color: pnlColor }}>{n(displayPnlPct * 100)}%</strong></div>
          <div>真實下單：禁止</div>
        </div>
        <div style={{ marginTop: 10, padding: 10, borderRadius: 14, background: "rgba(2,6,23,.38)", border: "1px solid rgba(148,163,184,.12)", color: "#cbd5e1", fontWeight: 850, fontSize: 12, lineHeight: 1.6 }}>紙上交易總名單 {displayTotal} 檔｜核心10檔 {displayCoreCount}｜預備名單 {displayPreparedCount}｜Market91 / Market10 已在線，不是沒上紙上交易｜資料源：/api/v17/paper-summary</div>
      </Box>

      <Box title="操作">
        <LinkButton href={`/paper-auto?action=run&t=${now}`}>檢查今日紙上交易狀態</LinkButton>
        <LinkButton href={`/paper-auto?refresh=${now}`} tone="blue">重新整理</LinkButton>
        <div style={{ marginTop: 9, color: "#94a3b8", fontSize: 12, fontWeight: 850, lineHeight: 1.45 }}>這兩個控制已改成網址觸發，不依賴手機瀏覽器的前端 onClick；按下去一定會重新載入頁面。</div>
        {lastRun ? <div style={{ marginTop: 10, color: "#bbf7d0", fontWeight: 900, lineHeight: 1.55 }}>
          <div>今日紙上交易檢查完成。</div><div>紙上交易總名單：{coverage.total} 檔。</div>
          <div>本按鈕掃描：{coverage.scanned} 檔（既有10檔 + Market45候選）。</div>
          <div>已由獨立批次在線：{coverage.independent} 檔（Market91審核10檔 + Market10候選4檔）。</div>
          <div>本次新增 {coverage.created} 筆，略過 {coverage.skipped} 筆；略過通常代表已有 OPEN 紙上部位，防止重複建倉。</div>
        </div> : null}
        {lastRun?.skipped?.length ? <details style={{ marginTop: 8, color: "#fde68a", fontSize: 12, fontWeight: 850, lineHeight: 1.45 }}><summary>查看略過明細</summary>{lastRun.skipped.slice(0, 28).map((x) => <div key={`${x.symbol}-${x.existingId || x.reason}`}>{x.symbol}：{cleanReason(x.reason)}</div>)}</details> : null}
      </Box>

      <Box title="收斂規則" tone="yellow"><div style={{ color: "#cbd5e1", fontWeight: 850, lineHeight: 1.6, fontSize: 13 }}><div>折扣獵人主頁：只放目前正式上線 10 檔。</div><div>預備名單：必須先在本頁跑滿 4 週。</div><div>滿 4 週：只取得提案資格；進折扣獵人必須 Josh 明確同意。</div><div>禁止真實下單、禁止自動交易。</div></div></Box>
      <PositionSection title="核心正式10檔紙上追蹤" rows={core} tone="blue" defaultOpen={false} />
      <PositionSection title="預備名單 4週紙上驗證區" rows={prepared} tone="green" defaultOpen paperOnly />
    </div>
  </main>;
}
