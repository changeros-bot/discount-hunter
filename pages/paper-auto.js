import { useEffect, useMemo, useState } from "react";

function Box({ title, children, tone = "blue" }) {
  const border = tone === "green" ? "rgba(34,197,94,.38)" : tone === "red" ? "rgba(248,113,113,.36)" : tone === "yellow" ? "rgba(245,158,11,.34)" : "rgba(59,130,246,.30)";
  return <section style={{ marginTop: 12, border: `1px solid ${border}`, background: "rgba(15,23,42,.78)", borderRadius: 20, padding: 14 }}>
    <h2 style={{ margin: "0 0 10px", color: "#f8fafc", fontSize: 17, fontWeight: 1000 }}>{title}</h2>
    {children}
  </section>;
}

function n(value, digits = 2) {
  const x = Number(value || 0);
  return Number.isFinite(x) ? x.toFixed(digits) : "0.00";
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, { cache: "no-store", ...options });
  const json = await res.json();
  if (!res.ok || json.ok === false) throw new Error(json.error || "讀取失敗");
  return json;
}

function marketMapFromRows(rows = []) {
  return Object.fromEntries((rows || []).map((row) => [row.symbol, row]));
}

function statusText(status) {
  if (status === "final_screened") return "45 檔已收斂";
  if (status === "consolidated") return "已完成收斂";
  if (status === "partial_consolidation") return "已收斂部分資料";
  return "待收斂";
}

function normalizeKey(symbol) {
  return String(symbol || "").toUpperCase().replace(/ON$/, "");
}

function isCorePosition(row = {}) {
  const text = `${row.group || ""} ${row.sourceType || ""} ${row.source || ""}`;
  return /既有V17十檔|既有10檔|existing_ten/i.test(text);
}

function compactSource(row = {}) {
  if (isCorePosition(row)) return "核心";
  if (/market10/i.test(`${row.group || ""} ${row.sourceType || ""}`)) return "M10";
  if (/market91/i.test(`${row.group || ""} ${row.sourceType || ""}`)) return "M91";
  if (/產業|sector/i.test(`${row.group || ""} ${row.sourceType || ""}`)) return "產業";
  if (/market45/i.test(`${row.group || ""} ${row.sourceType || ""}`)) return "M45";
  return "紙上";
}

function playbookScore(row = {}) {
  const pb = row.playbook || {};
  let score = 0;
  if (row.discountModel) score += 4;
  if (Array.isArray(row.rules) && row.rules.length) score += 4;
  if (pb.buyPointRule) score += 3;
  if (/折價層級|D1|參考高點/i.test(String(pb.entryRule || ""))) score += 2;
  if (/不等待正式折價層級/i.test(String(pb.entryRule || ""))) score -= 10;
  if (/sector|產業/i.test(`${row.sourceType || ""} ${row.group || ""}`)) score += 1;
  return score;
}

function betterMeta(a = {}, b = {}) {
  return playbookScore(b) >= playbookScore(a) ? b : a;
}

function aggregatePositionsBySymbol(rows = []) {
  const map = new Map();
  for (const row of rows || []) {
    const key = normalizeKey(row.symbol);
    if (!key) continue;
    const cost = Number(row.amountUSDT || 0);
    const qty = Number(row.quantity || 0);
    const currentPrice = Number(row.currentPrice || row.price || 0);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        ...row,
        id: `AGG-${key}`,
        lots: [row],
        lotCount: 1,
        amountUSDT: cost,
        quantity: qty,
        currentPrice,
        price: qty > 0 ? cost / qty : Number(row.price || 0),
      });
      continue;
    }
    const meta = betterMeta(existing, row);
    const amountUSDT = Number(existing.amountUSDT || 0) + cost;
    const quantity = Number(existing.quantity || 0) + qty;
    const merged = {
      ...existing,
      ...meta,
      id: `AGG-${key}`,
      symbol: existing.symbol || row.symbol,
      name: meta.name || existing.name || row.name,
      group: meta.group || existing.group || row.group,
      sourceType: meta.sourceType || existing.sourceType || row.sourceType,
      tier: meta.tier || existing.tier || row.tier,
      quality: meta.quality || existing.quality || row.quality,
      score: meta.score || meta.totalScore || existing.score || existing.totalScore || row.score || row.totalScore,
      bucket: meta.bucket || existing.bucket || row.bucket,
      playbook: meta.playbook || existing.playbook || row.playbook,
      discountModel: meta.discountModel || existing.discountModel || row.discountModel,
      referenceMode: meta.referenceMode || existing.referenceMode || row.referenceMode,
      profile: meta.profile || existing.profile || row.profile,
      rules: meta.rules || existing.rules || row.rules,
      amounts: meta.amounts || existing.amounts || row.amounts,
      ruleNote: meta.ruleNote || existing.ruleNote || row.ruleNote,
      lots: [...(existing.lots || []), row],
      lotCount: Number(existing.lotCount || 1) + 1,
      amountUSDT,
      quantity,
      currentPrice: currentPrice || existing.currentPrice,
      price: quantity > 0 ? amountUSDT / quantity : existing.price,
    };
    map.set(key, merged);
  }
  return [...map.values()].map((row) => {
    const currentValue = Number(row.currentPrice || 0) * Number(row.quantity || 0);
    const cost = Number(row.amountUSDT || 0);
    const pnl = currentValue - cost;
    const pnlPct = cost > 0 ? pnl / cost : 0;
    return { ...row, currentValue, pnl, pnlPct };
  });
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

function PlaybookBlock({ row }) {
  const playbook = row?.playbook;
  if (!playbook) return null;
  const entry = playbook.buyPointRule || playbook.entryRule;
  const rows = [
    ["買點", entry],
    ["資金", playbook.sizing],
    ["風控", playbook.riskRule],
    ["檢查", playbook.exitRule],
    ["不上真倉", playbook.whyNotReal],
  ];
  return <details style={{ marginTop: 8, borderTop: "1px solid rgba(148,163,184,.12)", paddingTop: 7 }}>
    <summary style={{ cursor: "pointer", color: "#93c5fd", fontWeight: 1000, fontSize: 12 }}>📘 Playbook / 買點規則</summary>
    <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
      {rows.map(([label, value]) => <div key={label} style={{ padding: 8, borderRadius: 10, background: "rgba(15,23,42,.70)", border: "1px solid rgba(148,163,184,.10)" }}>
        <div style={{ color: "#fde68a", fontSize: 10, fontWeight: 1000 }}>{label}</div>
        <div style={{ color: "#cbd5e1", fontSize: 11, lineHeight: 1.5, fontWeight: 800 }}>{value || "—"}</div>
      </div>)}
    </div>
  </details>;
}

function CompactPositionCard({ row }) {
  const pnl = Number(row.pnl || 0);
  const pnlColor = pnl >= 0 ? "#bbf7d0" : "#fecaca";
  const score = row.score || row.totalScore;
  return <div style={{ padding: 11, borderRadius: 16, background: "rgba(2,6,23,.50)", border: "1px solid rgba(34,197,94,.15)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: "#f8fafc", fontSize: 18, fontWeight: 1000, lineHeight: 1.05 }}>{row.symbol}</div>
        <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 850, marginTop: 2 }}>{row.name || row.bucket || "—"}</div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ color: "#bbf7d0", fontSize: 11, fontWeight: 1000 }}>測試中</div>
        <div style={{ color: pnlColor, fontSize: 13, fontWeight: 1000 }}>{n((row.pnlPct || 0) * 100)}%</div>
      </div>
    </div>

    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
      <span style={{ color: "#bfdbfe", background: "rgba(59,130,246,.12)", padding: "3px 7px", borderRadius: 999, fontSize: 10, fontWeight: 1000 }}>{compactSource(row)}</span>
      <span style={{ color: "#fde68a", background: "rgba(245,158,11,.12)", padding: "3px 7px", borderRadius: 999, fontSize: 10, fontWeight: 1000 }}>{row.lotCount || 1}筆</span>
      {row.tier ? <span style={{ color: "#bfdbfe", background: "rgba(59,130,246,.10)", padding: "3px 7px", borderRadius: 999, fontSize: 10, fontWeight: 1000 }}>{row.tier}</span> : null}
      {row.quality ? <span style={{ color: "#bbf7d0", background: "rgba(34,197,94,.10)", padding: "3px 7px", borderRadius: 999, fontSize: 10, fontWeight: 1000 }}>{row.quality}</span> : null}
      {score ? <span style={{ color: "#fde68a", background: "rgba(245,158,11,.12)", padding: "3px 7px", borderRadius: 999, fontSize: 10, fontWeight: 1000 }}>{score}分</span> : null}
      {row.bucket ? <span style={{ color: "#ddd6fe", background: "rgba(168,85,247,.12)", padding: "3px 7px", borderRadius: 999, fontSize: 10, fontWeight: 1000 }}>{row.bucket}</span> : null}
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginTop: 9, color: "#cbd5e1" }}>
      <MiniStat label="總成本" value={`$${n(row.amountUSDT)}`} />
      <MiniStat label="市值" value={`$${n(row.currentValue)}`} />
      <MiniStat label="損益" value={`$${n(row.pnl)}`} color={pnlColor} />
      <MiniStat label="現價" value={`$${n(row.currentPrice, 2)}`} />
      <MiniStat label="均價" value={`$${n(row.price, 2)}`} />
      <MiniStat label="股數" value={n(row.quantity, 4)} />
      <MiniStat label="批次" value={`${row.lotCount || 1}`} />
      <MiniStat label="真倉" value="禁止" />
    </div>

    <PlaybookBlock row={row} />
  </div>;
}

function MiniStat({ label, value, color = "#cbd5e1" }) {
  return <div style={{ minWidth: 0 }}>
    <div style={{ color: "#64748b", fontSize: 9, fontWeight: 1000 }}>{label}</div>
    <div style={{ color, fontSize: 11, fontWeight: 1000, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
  </div>;
}

function PositionSection({ title, rows = [], tone = "blue", defaultOpen = true }) {
  if (!rows.length) return null;
  const sums = sumRows(rows);
  const pnlPct = sums.cost > 0 ? sums.pnl / sums.cost : 0;
  return <Box title={`${title}（${rows.length}檔 / ${sums.lots}筆）`} tone={tone}>
    <div style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 900, marginBottom: 8 }}>
      成本 ${n(sums.cost)}｜市值 ${n(sums.value)}｜損益 ${n(sums.pnl)}｜報酬 {n(pnlPct * 100)}%
    </div>
    <details open={defaultOpen}>
      <summary style={{ cursor: "pointer", color: "#bfdbfe", fontWeight: 1000, fontSize: 13 }}>展開 / 收合卡片</summary>
      <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
        {rows.map((row) => <CompactPositionCard key={row.symbol} row={row} />)}
      </div>
    </details>
  </Box>;
}

function BlockedList({ market45 }) {
  const blocked = market45?.finalBuckets?.["封鎖"] || market45?.buckets?.["封鎖"] || [];
  if (!blocked.length) return null;
  const symbols = blocked.map((row) => row.symbol).filter(Boolean);
  return <Box title={`封鎖 / 不進紙上（${symbols.length}）`} tone="red">
    <div style={{ color: "#fecaca", fontWeight: 900, fontSize: 12, lineHeight: 1.6 }}>
      {symbols.slice(0, 24).join(" / ")}{symbols.length > 24 ? " ..." : ""}
    </div>
    <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 850, marginTop: 6 }}>這區只提示風險，不再展開卡片，避免頁面膨脹。</div>
  </Box>;
}

export default function PaperAutoPage() {
  const [summary, setSummary] = useState(null);
  const [lastRun, setLastRun] = useState(null);
  const [market45, setMarket45] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setBusy(true);
    setError("");
    try {
      const prices = await fetchJson(`/api/prices?t=${Date.now()}`);
      const markets = marketMapFromRows(prices.data || []);
      const [paper, review] = await Promise.all([
        fetchJson("/api/v17/paper-summary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ markets }) }),
        fetchJson("/api/v17/market-45-review"),
      ]);
      setSummary(paper);
      setMarket45(review);
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
      const prices = await fetchJson(`/api/prices?t=${Date.now()}`);
      const markets = marketMapFromRows(prices.data || []);
      const result = await fetchJson("/api/v17/paper-auto-run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ markets }) });
      setLastRun(result);
      await load();
    } catch (err) {
      setError(err.message || "執行失敗");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { load(); }, []);

  const groupedPositions = useMemo(() => aggregatePositionsBySymbol(summary?.positions || []), [summary?.positions]);
  const corePositions = useMemo(() => groupedPositions.filter(isCorePosition), [groupedPositions]);
  const candidatePositions = useMemo(() => groupedPositions.filter((row) => !isCorePosition(row)), [groupedPositions]);
  const portfolio = useMemo(() => sumRows(groupedPositions), [groupedPositions]);
  const pnlColor = Number(portfolio.pnl || 0) >= 0 ? "#bbf7d0" : "#fecaca";
  const portfolioPnlPct = portfolio.cost > 0 ? portfolio.pnl / portfolio.cost : 0;
  const rawLotCount = summary?.summary?.openTrades || portfolio.lots || 0;
  const market45PaperCount = summary?.market45PaperCandidates?.length || summary?.summary?.market45CandidateCount || 0;
  const sourceCounts = useMemo(() => candidatePositions.reduce((acc, row) => {
    const key = compactSource(row);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {}), [candidatePositions]);

  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "linear-gradient(180deg,#020617 0%,#07111f 55%,#0f172a 100%)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "22px 14px 40px" }}>
      <a href="/v17" style={{ color: "#93c5fd", textDecoration: "none", fontWeight: 900 }}>← 返回折價獵人 V17</a>
      <header style={{ marginTop: 18, marginBottom: 14 }}>
        <div style={{ color: "#22c55e", letterSpacing: 3, fontWeight: 1000, fontSize: 13 }}>V17 紙上交易自動測試</div>
        <h1 style={{ fontSize: 30, lineHeight: 1.05, margin: "10px 0", fontWeight: 1000 }}>紙上交易總控台</h1>
        <p style={{ color: "#cbd5e1", lineHeight: 1.5, fontWeight: 850, margin: 0 }}>績效已改為依股票代號合併：同一檔多筆 lot 只顯示一張卡，成本與損益加總計算。</p>
      </header>

      {error && <Box title="錯誤" tone="red"><div style={{ color: "#fecaca", fontWeight: 850 }}>{error}</div></Box>}

      <Box title="總覽" tone="green">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, color: "#cbd5e1", fontWeight: 850, fontSize: 13 }}>
          <div>模式：{summary?.settings?.mode || "AUTO_PAPER"}</div>
          <div>週期：{summary?.settings?.testDays || 7} 天</div>
          <div>標的數：{groupedPositions.length} 檔</div>
          <div>紙上批次：{rawLotCount} 筆</div>
          <div>投入成本：${n(portfolio.cost)}</div>
          <div>目前市值：${n(portfolio.value)}</div>
          <div>損益：<strong style={{ color: pnlColor }}>${n(portfolio.pnl)}</strong></div>
          <div>報酬率：<strong style={{ color: pnlColor }}>{n(portfolioPnlPct * 100)}%</strong></div>
          <div>真實下單：禁止</div>
        </div>
        <div style={{ marginTop: 10, padding: 10, borderRadius: 14, background: "rgba(2,6,23,.38)", border: "1px solid rgba(148,163,184,.12)", color: "#cbd5e1", fontWeight: 850, fontSize: 12, lineHeight: 1.6 }}>
          核心 {corePositions.length} 檔｜新增候選 {candidatePositions.length} 檔｜Market45 {market45PaperCount} 檔｜M91 {sourceCounts.M91 || 0}｜M10 {sourceCounts.M10 || 0}｜產業 {sourceCounts["產業"] || 0}
        </div>
        <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 850, marginTop: 8, lineHeight: 1.5 }}>
          計算：總成本 = 各 lot 金額加總；市值 = 總股數 × 現價；損益 = 市值 - 成本；報酬率 = 損益 ÷ 成本。
        </div>
      </Box>

      <Box title="操作">
        <button disabled={busy} onClick={runPaper} style={{ width: "100%", padding: "13px 10px", borderRadius: 14, border: "1px solid rgba(34,197,94,.45)", background: "rgba(34,197,94,.18)", color: "#bbf7d0", fontWeight: 1000 }}>今天跑一次紙上交易</button>
        <button disabled={busy} onClick={load} style={{ width: "100%", marginTop: 8, padding: "12px 10px", borderRadius: 14, border: "1px solid rgba(59,130,246,.35)", background: "rgba(59,130,246,.12)", color: "#bfdbfe", fontWeight: 1000 }}>重新整理</button>
        {lastRun && <div style={{ marginTop: 10, color: "#bbf7d0", fontWeight: 900 }}>本次可測 {lastRun.eligibleCount || 0} 檔，新增 {lastRun.createdCount} 筆，略過 {lastRun.skippedCount} 筆。</div>}
        {lastRun?.skipped?.length ? <div style={{ marginTop: 8, color: "#fde68a", fontSize: 12, fontWeight: 850, lineHeight: 1.45 }}>略過原因：{lastRun.skipped.slice(0, 6).map((x) => `${x.symbol}:${x.reason}`).join("；")}</div> : null}
      </Box>

      <Box title="收斂進度" tone="yellow">
        <div style={{ color: "#cbd5e1", fontWeight: 850, lineHeight: 1.6, fontSize: 13 }}>
          <div>Market45：{market45?.covered || 0}/{market45?.total || 45}，{statusText(market45?.status)}</div>
          <div>缺資料：{market45?.missingCount ?? 0} 檔</div>
          <div>紙上交易候選：{market45PaperCount} 檔</div>
          <div>頁面規則：同一股票合併顯示，不再用 lot 數灌水。</div>
        </div>
      </Box>

      <PositionSection title="核心持倉紙上測試" rows={corePositions} tone="blue" defaultOpen={false} />
      <PositionSection title="新增候選紙上測試" rows={candidatePositions} tone="green" defaultOpen />
      <BlockedList market45={market45} />
    </div>
  </main>;
}
