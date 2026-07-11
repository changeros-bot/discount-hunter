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

function dedupePositions(rows = []) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = row.id || `${normalizeKey(row.symbol)}-${row.group || row.sourceType || "paper"}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

function PlaybookBlock({ playbook }) {
  if (!playbook) return null;
  const rows = [
    ["假設", playbook.thesis],
    ["買點", playbook.entryRule || playbook.buyPointRule],
    ["資金", playbook.sizing],
    ["風控", playbook.riskRule],
    ["檢查", playbook.exitRule],
    ["不上真倉", playbook.whyNotReal],
  ];
  return <details style={{ marginTop: 8, borderTop: "1px solid rgba(148,163,184,.12)", paddingTop: 7 }}>
    <summary style={{ cursor: "pointer", color: "#93c5fd", fontWeight: 1000, fontSize: 12 }}>📘 Playbook</summary>
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
      {row.tier ? <span style={{ color: "#bfdbfe", background: "rgba(59,130,246,.10)", padding: "3px 7px", borderRadius: 999, fontSize: 10, fontWeight: 1000 }}>{row.tier}</span> : null}
      {row.quality ? <span style={{ color: "#bbf7d0", background: "rgba(34,197,94,.10)", padding: "3px 7px", borderRadius: 999, fontSize: 10, fontWeight: 1000 }}>{row.quality}</span> : null}
      {score ? <span style={{ color: "#fde68a", background: "rgba(245,158,11,.12)", padding: "3px 7px", borderRadius: 999, fontSize: 10, fontWeight: 1000 }}>{score}分</span> : null}
      {row.bucket ? <span style={{ color: "#ddd6fe", background: "rgba(168,85,247,.12)", padding: "3px 7px", borderRadius: 999, fontSize: 10, fontWeight: 1000 }}>{row.bucket}</span> : null}
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginTop: 9, color: "#cbd5e1" }}>
      <MiniStat label="成本" value={`$${n(row.amountUSDT)}`} />
      <MiniStat label="市值" value={`$${n(row.currentValue)}`} />
      <MiniStat label="損益" value={`$${n(row.pnl)}`} color={pnlColor} />
      <MiniStat label="現價" value={`$${n(row.currentPrice, 2)}`} />
    </div>

    <PlaybookBlock playbook={row.playbook} />
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
  return <Box title={`${title}（${rows.length}）`} tone={tone}>
    <details open={defaultOpen}>
      <summary style={{ cursor: "pointer", color: "#bfdbfe", fontWeight: 1000, fontSize: 13 }}>展開 / 收合卡片</summary>
      <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
        {rows.map((row) => <CompactPositionCard key={row.id || row.symbol} row={row} />)}
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

  const s = summary?.summary || {};
  const pnlColor = Number(s.pnl || 0) >= 0 ? "#bbf7d0" : "#fecaca";
  const positions = useMemo(() => dedupePositions(summary?.positions || []), [summary?.positions]);
  const corePositions = useMemo(() => positions.filter(isCorePosition), [positions]);
  const candidatePositions = useMemo(() => positions.filter((row) => !isCorePosition(row)), [positions]);
  const market45PaperCount = summary?.market45PaperCandidates?.length || s.market45CandidateCount || 0;
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
        <p style={{ color: "#cbd5e1", lineHeight: 1.5, fontWeight: 850, margin: 0 }}>已瘦身：只看核心、候選、封鎖三類；Playbook 預設收合；不會送出任何真實訂單。</p>
      </header>

      {error && <Box title="錯誤" tone="red"><div style={{ color: "#fecaca", fontWeight: 850 }}>{error}</div></Box>}

      <Box title="總覽" tone="green">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, color: "#cbd5e1", fontWeight: 850, fontSize: 13 }}>
          <div>模式：{summary?.settings?.mode || "AUTO_PAPER"}</div>
          <div>週期：{summary?.settings?.testDays || 7} 天</div>
          <div>開放部位：{s.openTrades || positions.length || 0}</div>
          <div>投入成本：${n(s.cost)}</div>
          <div>目前市值：${n(s.value)}</div>
          <div>損益：<strong style={{ color: pnlColor }}>${n(s.pnl)}</strong></div>
          <div>報酬率：<strong style={{ color: pnlColor }}>{n((s.pnlPct || 0) * 100)}%</strong></div>
          <div>真實下單：禁止</div>
        </div>
        <div style={{ marginTop: 10, padding: 10, borderRadius: 14, background: "rgba(2,6,23,.38)", border: "1px solid rgba(148,163,184,.12)", color: "#cbd5e1", fontWeight: 850, fontSize: 12, lineHeight: 1.6 }}>
          核心 {corePositions.length} 檔｜新增候選 {candidatePositions.length} 檔｜Market45 {market45PaperCount} 檔｜M91 {sourceCounts.M91 || 0}｜M10 {sourceCounts.M10 || 0}｜產業 {sourceCounts["產業"] || 0}
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
          <div>頁面規則：不再重複顯示候選卡片，只顯示實際紙上部位。</div>
        </div>
      </Box>

      <PositionSection title="核心持倉紙上測試" rows={corePositions} tone="blue" defaultOpen={false} />
      <PositionSection title="新增候選紙上測試" rows={candidatePositions} tone="green" defaultOpen />
      <BlockedList market45={market45} />
    </div>
  </main>;
}
