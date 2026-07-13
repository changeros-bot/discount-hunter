function n(value, digits = 2) {
  const x = Number(value || 0);
  return Number.isFinite(x) ? x.toFixed(digits) : "0.00";
}

function key(symbol) {
  return String(symbol || "").toUpperCase().replace(/ON$/, "");
}

function isCore(row = {}) {
  const text = `${row.group || ""} ${row.sourceType || ""} ${row.source || ""}`;
  return /既有V17十檔|既有10檔|existing_ten/i.test(text);
}

function isReady2(row = {}) {
  const text = `${row.group || ""} ${row.sourceType || ""} ${row.source || ""}`;
  return /預備名單2|prepared_list_2/i.test(text);
}

function groupLabel(row = {}) {
  if (isCore(row)) return "核心10檔";
  if (isReady2(row)) return "預備名單2";
  return "預備名單";
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

function cleanReason(reason = "") {
  return String(reason || "").replace(/已有\s*7\s*天內\s*OPEN\s*紙上測試；防重複建倉/g, "已有進行中的 OPEN 紙上部位；防重複建倉");
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

function tierStatus(row = {}) {
  const rules = Array.isArray(row.rules) ? row.rules.map((x) => Math.abs(Number(x))).filter(Number.isFinite) : [];
  const discount = Math.abs(Number(row.discountFromHighPct ?? row.discount ?? 0));
  if (!rules.length) return { label: "觀察中", pct: Number(row.highProgress?.progressPct || 0), discount };
  let completedIndex = -1;
  for (let i = 0; i < rules.length; i += 1) if (discount >= rules[i]) completedIndex = i;
  const prev = completedIndex >= 0 ? rules[completedIndex] : 0;
  const next = completedIndex + 1 < rules.length ? rules[completedIndex + 1] : rules[completedIndex] || rules[0];
  const pct = completedIndex >= rules.length - 1 ? 100 : Math.max(2, Math.min(98, next > prev ? ((discount - prev) / (next - prev)) * 100 : 100));
  return { label: completedIndex >= 0 ? `已完成：D${completedIndex + 1}` : "未達：D1", pct, discount };
}

function aggregatePositions(rows = []) {
  const map = new Map();
  for (const row of rows || []) {
    const k = `${groupLabel(row)}:${key(row.symbol)}`;
    if (!key(row.symbol)) continue;
    const current = map.get(k);
    const amountUSDT = Number(row.amountUSDT || 0);
    const quantity = Number(row.quantity || 0);
    const currentPrice = Number(row.currentPrice || row.price || 0);
    if (!current) {
      map.set(k, { ...row, lotCount: 1, amountUSDT, quantity, currentPrice, price: quantity > 0 ? amountUSDT / quantity : Number(row.price || 0) });
      continue;
    }
    const totalAmount = Number(current.amountUSDT || 0) + amountUSDT;
    const totalQuantity = Number(current.quantity || 0) + quantity;
    const highProgress = row.highProgress?.enabled ? row.highProgress : current.highProgress;
    map.set(k, {
      ...current,
      amountUSDT: totalAmount,
      quantity: totalQuantity,
      currentPrice: currentPrice || current.currentPrice,
      price: totalQuantity > 0 ? totalAmount / totalQuantity : current.price,
      lotCount: Number(current.lotCount || 1) + 1,
      highProgress,
      discountFromHighPct: highProgress?.discountFromHighPct ?? row.discountFromHighPct ?? current.discountFromHighPct,
    });
  }
  return [...map.values()].map((row) => {
    const currentValue = Number(row.currentPrice || 0) * Number(row.quantity || 0);
    const cost = Number(row.amountUSDT || 0);
    const pnl = currentValue > 0 ? currentValue - cost : Number(row.pnl || 0);
    return { ...row, currentValue: currentValue || Number(row.currentValue || 0), pnl, pnlPct: cost > 0 ? pnl / cost : 0 };
  });
}

function slimPosition(row = {}) {
  const hp = row.highProgress || {};
  return {
    symbol: row.symbol,
    name: row.name || row.bucket || "",
    group: isCore(row) ? "既有V17十檔" : "預備名單",
    sourceType: isCore(row) ? "existing_ten" : "prepared_list",
    status: row.status || "OPEN",
    amountUSDT: Number(row.amountUSDT || 0),
    quantity: Number(row.quantity || 0),
    price: Number(row.price || 0),
    currentPrice: Number(row.currentPrice || row.price || 0),
    currentValue: Number(row.currentValue || 0),
    pnl: Number(row.pnl || 0),
    pnlPct: Number(row.pnlPct || 0),
    discountFromHighPct: Number(row.discountFromHighPct ?? row.discount ?? 0),
    rules: Array.isArray(row.rules) ? row.rules.slice(0, 5) : [],
    highProgress: hp.enabled ? {
      enabled: true,
      progressPct: Number(hp.progressPct || 0),
      currentPrice: Number(hp.currentPrice || row.currentPrice || 0),
      high52w: Number(hp.high52w || row.high52w || 0),
      discountFromHighPct: Number(hp.discountFromHighPct ?? row.discountFromHighPct ?? 0),
    } : null,
    baselineResetAt: row.baselineResetAt || null,
    repairedAt: row.repairedAt || null,
    createdAt: row.createdAt || null,
    dateKey: row.dateKey || null,
  };
}

function slimSummary(json = {}) {
  const rawRows = Array.isArray(json.positions) ? json.positions : [];
  return {
    ok: true,
    settings: { mode: json.settings?.mode || "AUTO_PAPER", testDays: 28 },
    summary: {
      openTrades: Number(json.summary?.openTrades || 0),
      symbolCount: Number(json.summary?.symbolCount || 0),
      cost: Number(json.summary?.cost || 0),
      value: Number(json.summary?.value || 0),
      pnl: Number(json.summary?.pnl || 0),
      pnlPct: Number(json.summary?.pnlPct || 0),
      existingTenCount: Number(json.summary?.existingTenCount || 10),
      preparedListCount: Number(json.summary?.preparedListCount || 18),
      groups: json.summary?.groups || {},
    },
    highProgressHealth: json.highProgressHealth || null,
    positions: rawRows.map(slimPosition),
  };
}

function slimRun(json = {}) {
  return {
    ok: Boolean(json.ok),
    eligibleCount: Number(json.eligibleCount || json.scanScope?.total || 14),
    createdCount: Number(json.createdCount || 0),
    skippedCount: Number(json.skippedCount || 0),
    skipped: Array.isArray(json.skipped) ? json.skipped.slice(0, 28).map((x) => ({ symbol: x.symbol, reason: cleanReason(x.reason || "") })) : [],
  };
}

function normalizeReady2(position = {}, labRow = {}) {
  const entryPrice = Number(position.entry_price || 0);
  const currentPrice = Number(labRow.price || entryPrice);
  const high52w = Number(labRow.high52w || labRow.high_52w || labRow.quoteAudit?.high52w || 0);
  const discount = Number(labRow.discountFromHighPct ?? labRow.discount ?? (high52w > 0 ? ((currentPrice / high52w) - 1) * 100 : 0));
  const rules = Array.isArray(labRow.rules) ? labRow.rules : [-15, -25, -35, -45];
  const quantity = Number(position.quantity || 0);
  const cost = Number(position.invested_usd || 0);
  return {
    symbol: position.symbol,
    name: position.token_symbol || "",
    group: "預備名單2",
    sourceType: "prepared_list_2",
    status: position.status || "OPEN",
    amountUSDT: cost,
    quantity,
    price: entryPrice,
    currentPrice,
    currentValue: currentPrice * quantity,
    pnl: currentPrice * quantity - cost,
    pnlPct: cost > 0 ? (currentPrice * quantity - cost) / cost : 0,
    discountFromHighPct: discount,
    rules,
    highProgress: high52w > 0 ? {
      enabled: true,
      progressPct: Math.max(0, Math.min(100, (currentPrice / high52w) * 100)),
      currentPrice,
      high52w,
      discountFromHighPct: discount,
    } : null,
    createdAt: position.opened_at || null,
    dateKey: position.opened_at || null,
  };
}

async function readJson(url) {
  const res = await fetch(url, { headers: { "cache-control": "no-store" } });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  if (!res.ok || json?.ok === false || !json) throw new Error(json?.error || json?.message || `讀取失敗 ${res.status}`);
  return json;
}

function Box({ title, children, tone = "blue" }) {
  const border = tone === "green" ? "rgba(34,197,94,.38)" : tone === "red" ? "rgba(248,113,113,.36)" : tone === "yellow" ? "rgba(245,158,11,.34)" : tone === "purple" ? "rgba(168,85,247,.38)" : "rgba(59,130,246,.30)";
  return <section style={{ marginTop: 12, border: `1px solid ${border}`, background: "rgba(15,23,42,.78)", borderRadius: 20, padding: 14 }}><h2 style={{ margin: "0 0 10px", color: "#f8fafc", fontSize: 17, fontWeight: 1000 }}>{title}</h2>{children}</section>;
}

function LinkButton({ href, children, tone = "green" }) {
  const color = tone === "blue" ? "#bfdbfe" : "#bbf7d0";
  const border = tone === "blue" ? "rgba(59,130,246,.35)" : "rgba(34,197,94,.45)";
  const bg = tone === "blue" ? "rgba(59,130,246,.12)" : "rgba(34,197,94,.18)";
  return <a href={href} style={{ display: "block", width: "100%", boxSizing: "border-box", textAlign: "center", padding: "13px 10px", borderRadius: 14, border: `1px solid ${border}`, background: bg, color, fontWeight: 1000, textDecoration: "none", marginTop: tone === "blue" ? 8 : 0 }}>{children}</a>;
}

function PositionCard({ row, paperOnly = false }) {
  const pnlColor = Number(row.pnl || 0) >= 0 ? "#bbf7d0" : "#fecaca";
  const tier = tierStatus(row);
  const hp = row.highProgress || {};
  return <div style={{ padding: 13, borderRadius: 22, background: "linear-gradient(180deg,rgba(6,78,59,.28),rgba(2,6,23,.72))", border: "1px solid rgba(34,197,94,.28)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><div><div style={{ color: "#f8fafc", fontSize: 22, fontWeight: 1000 }}>{row.symbol}</div><div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 850 }}>{row.name || "—"}</div></div><div style={{ textAlign: "right" }}><div style={{ color: "#bbf7d0", fontSize: 11, fontWeight: 1000 }}>{groupLabel(row)}</div><div style={{ color: pnlColor, fontSize: 13, fontWeight: 1000 }}>{n((row.pnlPct || 0) * 100)}%</div></div></div>
    {paperOnly ? <div style={{ marginTop: 9, padding: "8px 10px", borderRadius: 14, background: "rgba(245,158,11,.12)", color: "#fde68a", fontSize: 12, fontWeight: 1000, lineHeight: 1.45 }}>{validationText(row)}｜進折扣獵人必須 Josh 明確同意</div> : null}
    <div style={{ marginTop: 10, borderRadius: 17, border: "1px solid rgba(6,182,212,.18)", background: "rgba(2,6,23,.50)", padding: 12 }}><div style={{ padding: "10px 12px", borderRadius: 14, background: "rgba(34,197,94,.10)", border: "1px solid rgba(34,197,94,.24)", color: "#bbf7d0", fontSize: 18, fontWeight: 1000 }}>{tier.label}</div><div style={{ height: 10, borderRadius: 999, background: "rgba(8,47,73,.9)", marginTop: 10, overflow: "hidden" }}><div style={{ width: `${Math.max(0, Math.min(100, Number(tier.pct || 0)))}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#00ffa3,#00e5ff,#facc15)" }} /></div><div style={{ marginTop: 8, color: "#22d3ee", fontWeight: 1000, fontSize: 14 }}>{n(tier.pct, 0)}%｜目前折價 {n(tier.discount, 1)}%</div>{hp?.enabled ? <div style={{ marginTop: 8, color: "#94a3b8", fontWeight: 850, fontSize: 11 }}>52週高點：{n(hp.progressPct, 1)}%｜現價 ${n(hp.currentPrice)}｜高點 ${n(hp.high52w)}</div> : null}</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginTop: 10, color: "#cbd5e1", fontSize: 11, fontWeight: 900 }}><div>成本<br />${n(row.amountUSDT)}</div><div>市值<br />${n(row.currentValue)}</div><div style={{ color: pnlColor }}>損益<br />${n(row.pnl)}</div><div>現價<br />${n(row.currentPrice)}</div><div>均價<br />${n(row.price)}</div><div>股數<br />{n(row.quantity, 4)}</div><div>批次<br />{row.lotCount || 1}</div><div>真倉<br />禁止</div></div>
  </div>;
}

function PositionSection({ title, rows = [], tone = "blue", defaultOpen = true, paperOnly = false }) {
  if (!rows.length) return null;
  const sums = sumRows(rows);
  const progressCount = rows.filter((row) => row.highProgress?.enabled).length;
  return <Box title={`${title}（${rows.length}檔 / ${sums.lots}筆）`} tone={tone}><div style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 900, marginBottom: 8 }}>成本 ${n(sums.cost)}｜市值 ${n(sums.value)}｜損益 ${n(sums.pnl)}</div>{paperOnly ? <div style={{ marginBottom: 8, color: "#fde68a", background: "rgba(245,158,11,.10)", border: "1px solid rgba(245,158,11,.22)", borderRadius: 12, padding: 9, fontSize: 12, fontWeight: 950, lineHeight: 1.5 }}>{title}只在本頁跑滿 4 週；52週高點進度條：{progressCount}/{rows.length} 檔已啟用。</div> : null}<details open={defaultOpen}><summary style={{ cursor: "pointer", color: "#bfdbfe", fontWeight: 1000, fontSize: 13 }}>展開 / 收合卡片</summary><div style={{ display: "grid", gap: 12, marginTop: 10 }}>{rows.map((row) => <PositionCard key={`${groupLabel(row)}-${row.symbol}`} row={row} paperOnly={paperOnly} />)}</div></details></Box>;
}

export async function getServerSideProps({ req, query }) {
  const host = req?.headers?.host || process.env.VERCEL_URL || "discount-hunter-sigma.vercel.app";
  const proto = host.includes("localhost") ? "http" : "https";
  const base = `${proto}://${host}`;
  let initialRun = null;
  let runError = "";
  try {
    if (query?.action === "run") initialRun = slimRun(await readJson(`${base}/api/v17/paper-auto-run?ssr=1&t=${Date.now()}`));
  } catch (err) {
    runError = `執行檢查失敗：${err?.message || "unknown"}`;
  }
  try {
    const [paperJson, ready2Json, labJson] = await Promise.all([
      readJson(`${base}/api/v17/paper-summary?ssr=1&t=${Date.now()}`),
      readJson(`${base}/api/v17/candidate-paper-bootstrap?t=${Date.now()}`),
      readJson(`${base}/api/v17/candidate-lab?t=${Date.now()}`),
    ]);
    const labRows = Array.isArray(labJson.rows) ? labJson.rows : [];
    const labMap = Object.fromEntries(labRows.map((row) => [row.symbol === "DRAMB" ? "DRAM" : row.symbol, row]));
    const ready2 = (ready2Json.positions || []).map((position) => normalizeReady2(position, labMap[position.symbol] || {}));
    return { props: { initialSummary: slimSummary(paperJson), initialReady2: ready2, initialRun, initialError: runError } };
  } catch (err) {
    return { props: { initialSummary: null, initialReady2: [], initialRun, initialError: runError || `SSR資料讀取失敗：${err?.message || "unknown"}` } };
  }
}

export default function PaperAutoPage({ initialSummary = null, initialReady2 = [], initialRun = null, initialError = "" }) {
  const summary = initialSummary || {};
  const groupedOld = aggregatePositions(Array.isArray(summary.positions) ? summary.positions : []);
  const core = groupedOld.filter(isCore);
  const prepared = groupedOld.filter((row) => !isCore(row));
  const ready2 = aggregatePositions(initialReady2 || []);
  const all = [...core, ...prepared, ...ready2];
  const portfolio = sumRows(all);
  const pnlColor = Number(portfolio.pnl || 0) >= 0 ? "#bbf7d0" : "#fecaca";
  const rawLotCount = portfolio.lots;
  const progressCount = prepared.filter((row) => row.highProgress?.enabled).length;
  const ready2ProgressCount = ready2.filter((row) => row.highProgress?.enabled).length;
  const displayPnlPct = portfolio.cost > 0 ? portfolio.pnl / portfolio.cost : 0;
  const coverageTotal = all.length || 46;
  const scanned = Number(initialRun?.eligibleCount || 14);
  const now = Date.now();

  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "linear-gradient(180deg,#020617 0%,#07111f 55%,#0f172a 100%)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}><div style={{ maxWidth: 560, margin: "0 auto", padding: "22px 14px 40px" }}>
    <a href="/v17" style={{ color: "#93c5fd", textDecoration: "none", fontWeight: 900 }}>← 返回折價獵人 V17</a>
    <header style={{ marginTop: 18, marginBottom: 14 }}><div style={{ color: "#22c55e", letterSpacing: 3, fontWeight: 1000, fontSize: 13 }}>V17 紙上交易自動測試</div><h1 style={{ fontSize: 30, lineHeight: 1.05, margin: "10px 0", fontWeight: 1000 }}>紙上交易總控台</h1><p style={{ color: "#cbd5e1", lineHeight: 1.5, fontWeight: 850, margin: 0 }}>折扣獵人主頁只放正式上線 10 檔；預備名單與預備名單2只能在本頁驗證，升格必須 Josh 明確同意。</p></header>
    {initialError ? <Box title="錯誤" tone="red"><div style={{ color: "#fecaca", fontWeight: 850 }}>{initialError}</div></Box> : null}
    <Box title="總覽" tone="green"><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, color: "#cbd5e1", fontWeight: 850, fontSize: 13 }}><div>模式：{summary?.settings?.mode || "AUTO_PAPER"}</div><div>驗證期：4 週</div><div>核心正式：{core.length} 檔</div><div>預備名單：{prepared.length} 檔</div><div>預備名單2：{ready2.length} 檔</div><div>紙上批次：{rawLotCount} 筆</div><div>進度條1：{progressCount}/{prepared.length}</div><div>進度條2：{ready2ProgressCount}/{ready2.length}</div><div>投入成本：${n(portfolio.cost)}</div><div>目前市值：${n(portfolio.value)}</div><div>損益：<strong style={{ color: pnlColor }}>${n(portfolio.pnl)}</strong></div><div>報酬率：<strong style={{ color: pnlColor }}>{n(displayPnlPct * 100)}%</strong></div><div>真實下單：禁止</div></div><div style={{ marginTop: 10, padding: 10, borderRadius: 14, background: "rgba(2,6,23,.38)", border: "1px solid rgba(148,163,184,.12)", color: "#cbd5e1", fontWeight: 850, fontSize: 12, lineHeight: 1.6 }}>紙上交易總名單 {all.length} 檔｜核心10檔 {core.length}｜預備名單 {prepared.length}｜預備名單2 {ready2.length}</div></Box>
    <Box title="操作"><LinkButton href={`/paper-auto?action=run&t=${now}`}>檢查今日紙上交易狀態</LinkButton><LinkButton href={`/paper-auto?refresh=${now}`} tone="blue">重新整理</LinkButton><div style={{ marginTop: 9, color: "#94a3b8", fontSize: 12, fontWeight: 850, lineHeight: 1.45 }}>維持原本卡片、折價層級、52週高點與4週驗證顯示。</div>{initialRun ? <div style={{ marginTop: 10, color: "#bbf7d0", fontWeight: 900, lineHeight: 1.55 }}><div>今日紙上交易檢查完成。</div><div>紙上交易總名單：{coverageTotal} 檔。</div><div>本按鈕掃描：{scanned} 檔。</div><div>已由獨立批次在線：{Math.max(0, coverageTotal - scanned)} 檔。</div><div>本次新增 {initialRun.createdCount} 筆，略過 {initialRun.skippedCount} 筆。</div></div> : null}{initialRun?.skipped?.length ? <details style={{ marginTop: 8, color: "#fde68a", fontSize: 12, fontWeight: 850, lineHeight: 1.45 }}><summary>查看略過明細</summary>{initialRun.skipped.map((x) => <div key={`${x.symbol}-${x.reason}`}>{x.symbol}：{x.reason}</div>)}</details> : null}</Box>
    <Box title="收斂規則" tone="yellow"><div style={{ color: "#cbd5e1", fontWeight: 850, lineHeight: 1.6, fontSize: 13 }}><div>折扣獵人主頁：只放目前正式上線 10 檔。</div><div>預備名單與預備名單2：必須先在本頁跑滿 4 週。</div><div>滿 4 週：只取得提案資格；進折扣獵人必須 Josh 明確同意。</div><div>禁止真實下單、禁止自動交易。</div></div></Box>
    <PositionSection title="核心正式10檔紙上追蹤" rows={core} tone="blue" defaultOpen={false} />
    <PositionSection title="預備名單 4週紙上驗證區" rows={prepared} tone="green" defaultOpen paperOnly />
    <PositionSection title="預備名單2 4週紙上驗證區" rows={ready2} tone="purple" defaultOpen paperOnly />
  </div></main>;
}
