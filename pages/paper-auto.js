import { useEffect, useMemo, useState } from "react";

function Box({ title, children, tone = "blue" }) {
  const border = tone === "green" ? "rgba(34,197,94,.38)" : tone === "red" ? "rgba(248,113,113,.36)" : tone === "yellow" ? "rgba(245,158,11,.34)" : "rgba(59,130,246,.30)";
  return <section style={{ marginTop: 14, border: `1px solid ${border}`, background: "rgba(15,23,42,.78)", borderRadius: 22, padding: 16 }}>
    <h2 style={{ margin: "0 0 10px", color: "#f8fafc", fontSize: 18, fontWeight: 1000 }}>{title}</h2>
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
  if (status === "consolidated") return "已完成收斂";
  if (status === "partial_consolidation") return "已收斂部分資料";
  return "待收斂";
}

function normalizeKey(symbol) {
  return String(symbol || "").toUpperCase().replace(/ON$/, "");
}

function groupRows(rows = []) {
  return rows.reduce((acc, row) => {
    const key = row.group || row.paperGroup || "未分類";
    acc[key] = acc[key] || [];
    acc[key].push(row);
    return acc;
  }, {});
}

function InfoLine({ label, value, strong = false }) {
  return <div style={{ minWidth: 0 }}>
    <div style={{ color: "#94a3b8", fontSize: 10, fontWeight: 900, letterSpacing: .5 }}>{label}</div>
    <div style={{ color: strong ? "#f8fafc" : "#cbd5e1", fontSize: 12, fontWeight: strong ? 1000 : 850, overflowWrap: "anywhere" }}>{value ?? "—"}</div>
  </div>;
}

function PlaybookBlock({ playbook }) {
  if (!playbook) return null;
  const rows = [
    ["投資假設", playbook.thesis],
    ["進場規則", playbook.entryRule],
    ["資金配置", playbook.sizing],
    ["出場 / 檢查", playbook.exitRule],
    ["風控規則", playbook.riskRule],
    ["入選理由", playbook.whyIncluded],
    ["禁止真倉原因", playbook.whyNotReal],
  ];
  return <details style={{ marginTop: 10, borderTop: "1px solid rgba(148,163,184,.14)", paddingTop: 8 }}>
    <summary style={{ cursor: "pointer", color: "#bfdbfe", fontWeight: 1000, fontSize: 13 }}>📘 Playbook</summary>
    <div style={{ display: "grid", gap: 7, marginTop: 9 }}>
      {rows.map(([label, value]) => <div key={label} style={{ padding: 9, borderRadius: 12, background: "rgba(15,23,42,.72)", border: "1px solid rgba(148,163,184,.10)" }}>
        <div style={{ color: "#fde68a", fontSize: 11, fontWeight: 1000 }}>{label}</div>
        <div style={{ color: "#cbd5e1", fontSize: 12, lineHeight: 1.55, fontWeight: 800 }}>{value || "—"}</div>
      </div>)}
    </div>
  </details>;
}

function PaperAssetCard({ asset, position }) {
  const row = position || asset || {};
  const playbook = row.playbook || asset?.playbook;
  const pnl = Number(row.pnl || 0);
  const pnlColor = pnl >= 0 ? "#bbf7d0" : "#fecaca";
  const hasPosition = Boolean(position);
  return <div style={{ padding: 12, borderRadius: 18, background: "rgba(2,6,23,.50)", border: "1px solid rgba(34,197,94,.18)", boxShadow: "0 10px 30px rgba(0,0,0,.15)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
      <div>
        <div style={{ color: "#f8fafc", fontSize: 18, fontWeight: 1000 }}>{row.symbol}</div>
        <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 850 }}>{row.name || row.bucket || "—"}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ color: hasPosition ? "#bbf7d0" : "#fde68a", fontSize: 12, fontWeight: 1000 }}>{hasPosition ? "測試中" : "待建倉"}</div>
        <div style={{ color: "#c4b5fd", fontSize: 11, fontWeight: 900 }}>{row.group || row.paperGroup || "紙上交易"}</div>
      </div>
    </div>

    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
      {row.tier ? <span style={{ color: "#bfdbfe", background: "rgba(59,130,246,.12)", padding: "4px 7px", borderRadius: 999, fontSize: 11, fontWeight: 1000 }}>{row.tier}</span> : null}
      {row.quality ? <span style={{ color: "#bbf7d0", background: "rgba(34,197,94,.12)", padding: "4px 7px", borderRadius: 999, fontSize: 11, fontWeight: 1000 }}>{row.quality}</span> : null}
      {row.score || row.totalScore ? <span style={{ color: "#fde68a", background: "rgba(245,158,11,.12)", padding: "4px 7px", borderRadius: 999, fontSize: 11, fontWeight: 1000 }}>{row.score || row.totalScore}分</span> : null}
      {row.bucket ? <span style={{ color: "#ddd6fe", background: "rgba(168,85,247,.12)", padding: "4px 7px", borderRadius: 999, fontSize: 11, fontWeight: 1000 }}>{row.bucket}</span> : null}
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginTop: 10 }}>
      <InfoLine label="買入價" value={hasPosition ? `$${n(row.price, 4)}` : "待建立"} />
      <InfoLine label="現價" value={hasPosition ? `$${n(row.currentPrice, 4)}` : "待建立"} />
      <InfoLine label="成本" value={hasPosition ? `$${n(row.amountUSDT)}` : "5U 預設"} />
      <InfoLine label="市值" value={hasPosition ? `$${n(row.currentValue)}` : "—"} />
      <InfoLine label="損益" value={hasPosition ? `$${n(row.pnl)}` : "—"} strong />
      <div>
        <div style={{ color: "#94a3b8", fontSize: 10, fontWeight: 900, letterSpacing: .5 }}>報酬率</div>
        <div style={{ color: hasPosition ? pnlColor : "#cbd5e1", fontSize: 12, fontWeight: 1000 }}>{hasPosition ? `${n((row.pnlPct || 0) * 100)}%` : "—"}</div>
      </div>
    </div>

    <div style={{ marginTop: 9, color: "#94a3b8", fontSize: 11, fontWeight: 850, lineHeight: 1.45 }}>
      {hasPosition ? `${row.trigger}｜${row.source}` : "尚未建立紙上部位；按「今天跑一次紙上交易」後建立。"}
    </div>
    <PlaybookBlock playbook={playbook} />
  </div>;
}

function CandidateList({ rows = [], assets = [], positions = [] }) {
  if (!rows.length && !assets.length) return <div style={{ color: "#94a3b8", fontWeight: 850 }}>目前沒有候選。</div>;
  const positionMap = new Map((positions || []).map((row) => [normalizeKey(row.symbol), row]));
  const assetMap = new Map((assets || []).map((row) => [normalizeKey(row.symbol), row]));
  const merged = (rows.length ? rows : assets).map((row) => ({ ...row, ...(assetMap.get(normalizeKey(row.symbol)) || {}) }));
  return <div style={{ display: "grid", gap: 10 }}>
    {merged.map((asset) => <PaperAssetCard key={asset.symbol} asset={asset} position={positionMap.get(normalizeKey(asset.symbol))} />)}
  </div>;
}

function PositionList({ rows = [], assets = [] }) {
  const assetMap = new Map((assets || []).map((row) => [normalizeKey(row.symbol), row]));
  const groups = groupRows(rows);
  if (!rows.length) return <CandidateList rows={assets} assets={assets} positions={[]} />;
  return <div style={{ display: "grid", gap: 14 }}>
    {Object.entries(groups).map(([group, items]) => <div key={group}>
      <div style={{ color: "#bfdbfe", fontWeight: 1000, marginBottom: 8 }}>{group}（{items.length}）</div>
      <div style={{ display: "grid", gap: 10 }}>
        {items.map((row) => <PaperAssetCard key={row.id} asset={assetMap.get(normalizeKey(row.symbol))} position={row} />)}
      </div>
    </div>)}
  </div>;
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
  const market45Candidates = summary?.market45PaperCandidates || market45?.buckets?.["紙上交易候選"] || [];
  const paperAssets = summary?.paperAssets || [];
  const existingAssets = useMemo(() => paperAssets.filter((x) => x.paperGroup === "既有V17十檔"), [paperAssets]);
  const marketAssets = useMemo(() => paperAssets.filter((x) => x.paperGroup === "Market45紙上候選"), [paperAssets]);

  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "linear-gradient(180deg,#020617 0%,#07111f 55%,#0f172a 100%)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "22px 14px 40px" }}>
      <a href="/v17" style={{ color: "#93c5fd", textDecoration: "none", fontWeight: 900 }}>← 返回折價獵人 V17</a>
      <header style={{ marginTop: 18, marginBottom: 18 }}>
        <div style={{ color: "#22c55e", letterSpacing: 3, fontWeight: 1000, fontSize: 13 }}>V17 紙上交易自動測試</div>
        <h1 style={{ fontSize: 34, lineHeight: 1.05, margin: "10px 0", fontWeight: 1000 }}>紙上交易自動測試</h1>
        <p style={{ color: "#cbd5e1", lineHeight: 1.55, fontWeight: 850, margin: 0 }}>每個入選紙上交易標的都有獨立卡片與 Playbook。這裡不會送出任何真實訂單。</p>
      </header>

      {error && <Box title="錯誤" tone="red"><div style={{ color: "#fecaca", fontWeight: 850 }}>{error}</div></Box>}

      <Box title="目前規則" tone="green">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, color: "#cbd5e1", fontWeight: 850 }}>
          <div>模式：{summary?.settings?.mode || "AUTO_PAPER"}</div>
          <div>測試天數：{summary?.settings?.testDays || 7} 天</div>
          <div>既有V17：{s.existingTenCount || existingAssets.length || 10} 檔</div>
          <div>Market45：{s.market45CandidateCount || marketAssets.length || market45Candidates.length || 0} 檔</div>
          <div>每筆金額：{summary?.settings?.perTradeUSDT || 5}U</div>
          <div>每日上限：{summary?.settings?.dailyMaxTrades || 15} 筆</div>
          <div>真實下單：禁止</div>
          <div>Playbook：已啟用</div>
        </div>
      </Box>

      <Box title="紙上交易績效" tone="blue">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, color: "#cbd5e1", fontWeight: 850 }}>
          <div>累積筆數：{s.totalTrades || 0}</div>
          <div>開放部位：{s.openTrades || 0}</div>
          <div>投入成本：${n(s.cost)}</div>
          <div>目前市值：${n(s.value)}</div>
          <div>損益：<strong style={{ color: pnlColor }}>${n(s.pnl)}</strong></div>
          <div>報酬率：<strong style={{ color: pnlColor }}>{n((s.pnlPct || 0) * 100)}%</strong></div>
        </div>
      </Box>

      <Box title="操作">
        <button disabled={busy} onClick={runPaper} style={{ width: "100%", padding: "13px 10px", borderRadius: 14, border: "1px solid rgba(34,197,94,.45)", background: "rgba(34,197,94,.18)", color: "#bbf7d0", fontWeight: 1000 }}>今天跑一次紙上交易</button>
        <button disabled={busy} onClick={load} style={{ width: "100%", marginTop: 8, padding: "12px 10px", borderRadius: 14, border: "1px solid rgba(59,130,246,.35)", background: "rgba(59,130,246,.12)", color: "#bfdbfe", fontWeight: 1000 }}>重新整理</button>
        {lastRun && <div style={{ marginTop: 10, color: "#bbf7d0", fontWeight: 900 }}>本次可測 {lastRun.eligibleCount || 0} 檔，新增 {lastRun.createdCount} 筆，略過 {lastRun.skippedCount} 筆。</div>}
        {lastRun?.skipped?.length ? <div style={{ marginTop: 8, color: "#fde68a", fontSize: 12, fontWeight: 850, lineHeight: 1.45 }}>略過原因：{lastRun.skipped.slice(0, 6).map((x) => `${x.symbol}:${x.reason}`).join("；")}</div> : null}
      </Box>

      <Box title="45 檔收斂進度" tone="yellow">
        <div style={{ color: "#cbd5e1", fontWeight: 850, lineHeight: 1.6 }}>
          <div>總數：{market45?.total || 45} 檔</div>
          <div>已收斂：{market45?.covered || 0} 檔</div>
          <div>缺資料：{market45?.missingCount ?? 45} 檔</div>
          <div>狀態：{statusText(market45?.status)}</div>
          <div>紙上交易候選：{market45Candidates.length} 檔</div>
          <div>測試週期：7 天</div>
        </div>
      </Box>

      <Box title="既有V17十檔紙上卡片" tone="blue">
        <CandidateList rows={existingAssets} assets={existingAssets} positions={summary?.positions || []} />
      </Box>

      <Box title="Market45 紙上候選卡片" tone="green">
        <CandidateList rows={market45Candidates} assets={marketAssets} positions={summary?.positions || []} />
      </Box>

      <Box title="紙上部位總覽">
        <PositionList rows={summary?.positions || []} assets={paperAssets} />
      </Box>
    </div>
  </main>;
}
