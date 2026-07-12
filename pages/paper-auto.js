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
  if (isCorePosition(row)) return "核心10檔";
  if (/market10/i.test(`${row.group || ""} ${row.sourceType || ""}`)) return "M10紙上";
  if (/market91/i.test(`${row.group || ""} ${row.sourceType || ""}`)) return "M91紙上";
  if (/產業|sector/i.test(`${row.group || ""} ${row.sourceType || ""}`)) return "產業紙上";
  if (/market45/i.test(`${row.group || ""} ${row.sourceType || ""}`)) return "M45紙上";
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

function bestHighProgress(existing = {}, row = {}) {
  return row.highProgress?.enabled ? row.highProgress : existing.highProgress?.enabled ? existing.highProgress : null;
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
      map.set(key, { ...row, id: `AGG-${key}`, lots: [row], lotCount: 1, amountUSDT: cost, quantity: qty, currentPrice, price: qty > 0 ? cost / qty : Number(row.price || 0) });
      continue;
    }
    const meta = betterMeta(existing, row);
    const amountUSDT = Number(existing.amountUSDT || 0) + cost;
    const quantity = Number(existing.quantity || 0) + qty;
    const highProgress = bestHighProgress(existing, row);
    map.set(key, {
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
      highProgress,
      high52w: highProgress?.high52w || existing.high52w || row.high52w,
      gapToHigh: highProgress?.gapToHigh ?? existing.gapToHigh ?? row.gapToHigh,
      discountFromHighPct: highProgress?.discountFromHighPct ?? existing.discountFromHighPct ?? row.discountFromHighPct,
      absoluteProgressPct: highProgress?.progressPct ?? existing.absoluteProgressPct ?? row.absoluteProgressPct,
      lots: [...(existing.lots || []), row],
      lotCount: Number(existing.lotCount || 1) + 1,
      amountUSDT,
      quantity,
      currentPrice: currentPrice || existing.currentPrice,
      price: quantity > 0 ? amountUSDT / quantity : existing.price,
    });
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

function daysSince(row = {}) {
  const raw = row.repairedAt || row.baselineResetAt || row.createdAt || row.dateKey;
  const t = Date.parse(raw);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

function validationText(row = {}) {
  const d = daysSince(row);
  const remain = Math.max(0, 28 - d);
  return remain > 0 ? `4週驗證中｜已 ${d} 天｜剩 ${remain} 天` : "已滿4週，可進下一階段覆核";
}

function getRules(row = {}) {
  return Array.isArray(row.rules) && row.rules.length ? row.rules.map(Number).filter(Number.isFinite) : [];
}

function getAmounts(row = {}) {
  const rules = getRules(row);
  const amounts = Array.isArray(row.amounts) ? row.amounts.map(Number) : [];
  return rules.map((_, i) => Number.isFinite(amounts[i]) ? amounts[i] : Number(row.amountUSDT || 5));
}

function tierName(index) {
  return `D${index + 1}`;
}

function tierStatus(row = {}) {
  const rules = getRules(row);
  const currentDiscount = Math.abs(Number(row.discountFromHighPct ?? row.discount ?? 0));
  if (!rules.length) return { label: "觀察中", left: "52W", right: "D1", pct: Math.max(0, Math.min(100, Number(row.highProgress?.progressPct || 0))), activeIndex: -1, completedIndex: -1 };
  const absRules = rules.map((r) => Math.abs(r));
  let completedIndex = -1;
  for (let i = 0; i < absRules.length; i += 1) {
    if (currentDiscount >= absRules[i]) completedIndex = i;
  }
  const nextIndex = Math.min(completedIndex + 1, absRules.length - 1);
  const leftIndex = Math.max(0, completedIndex);
  const prev = completedIndex >= 0 ? absRules[completedIndex] : 0;
  const next = completedIndex + 1 < absRules.length ? absRules[completedIndex + 1] : absRules[completedIndex] || absRules[0];
  const segment = next > prev ? ((currentDiscount - prev) / (next - prev)) * 100 : 100;
  const pct = completedIndex >= absRules.length - 1 ? 100 : Math.max(2, Math.min(98, segment));
  return {
    label: completedIndex >= 0 ? `已完成：${tierName(completedIndex)}` : `未達：${tierName(0)}`,
    left: completedIndex >= 0 ? tierName(completedIndex) : "52W",
    right: completedIndex + 1 < absRules.length ? tierName(completedIndex + 1) : tierName(absRules.length - 1),
    pct,
    activeIndex: completedIndex >= 0 ? completedIndex : 0,
    completedIndex,
    currentDiscount,
  };
}

function isNewListingWatch(row = {}) {
  return /NEW|新上市|manual|人工|觀察/i.test(`${row.quality || ""} ${row.bucket || ""} ${row.group || ""} ${row.playbook?.riskRule || ""}`) && /SOFI|ACN|CEG|NOW|CRWV/i.test(String(row.symbol || "")) === false ? false : /CRWV|SPCX/i.test(String(row.symbol || ""));
}

function cardTone(row = {}) {
  if (isNewListingWatch(row)) return { border: "rgba(245,158,11,.55)", bg: "linear-gradient(180deg,rgba(69,26,3,.42),rgba(2,6,23,.72))", accent: "#fde68a", soft: "rgba(245,158,11,.13)", label: "新上市觀察" };
  const tier = tierStatus(row);
  if (tier.completedIndex >= 0) return { border: "rgba(34,197,94,.42)", bg: "linear-gradient(180deg,rgba(6,78,59,.36),rgba(2,6,23,.72))", accent: "#bbf7d0", soft: "rgba(34,197,94,.12)", label: "通過" };
  return { border: "rgba(59,130,246,.38)", bg: "linear-gradient(180deg,rgba(8,47,73,.36),rgba(2,6,23,.72))", accent: "#67e8f9", soft: "rgba(6,182,212,.12)", label: "觀察中" };
}

function StatusCapsule({ row }) {
  const tier = tierStatus(row);
  const tone = cardTone(row);
  return <div style={{ padding: "13px 16px", borderRadius: 18, background: tone.soft, border: `1px solid ${tone.border}`, color: tone.accent, fontSize: 22, fontWeight: 1000, letterSpacing: 1 }}>
    {tier.label}
  </div>;
}

function TierProgressBar({ row }) {
  const tier = tierStatus(row);
  const tone = cardTone(row);
  return <div style={{ marginTop: 12, borderRadius: 20, border: "1px solid rgba(6,182,212,.18)", background: "rgba(2,6,23,.50)", padding: 14 }}>
    <div style={{ display: "flex", justifyContent: "space-between", color: "#e2e8f0", fontSize: 15, fontWeight: 1000 }}>
      <span>{tier.left}</span><span>{tier.right}</span>
    </div>
    <div style={{ position: "relative", height: 12, borderRadius: 999, background: "rgba(8,47,73,.90)", marginTop: 14, overflow: "visible" }}>
      <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${tier.pct}%`, borderRadius: 999, background: "linear-gradient(90deg,#00ffa3,#00e5ff,#facc15)" }} />
      <div style={{ position: "absolute", left: `calc(${tier.pct}% - 13px)`, top: -8, width: 28, height: 28, borderRadius: 999, background: "#00e5ff", boxShadow: "0 0 24px rgba(34,211,238,.85)" }} />
    </div>
    <div style={{ marginTop: 14, color: "#22d3ee", fontWeight: 1000, fontSize: 18 }}>{n(tier.pct, 0)}%</div>
    <div style={{ marginTop: 5, color: "#94a3b8", fontWeight: 850, fontSize: 11 }}>D層進度：目前折價約 {n(tier.currentDiscount, 1)}%，在 {tier.left} → {tier.right} 區間。</div>
  </div>;
}

function HighProgressBar({ row }) {
  const hp = row?.highProgress;
  if (!hp?.enabled) return null;
  const pct = Math.max(0, Math.min(100, Number(hp.progressPct || 0)));
  return <div style={{ marginTop: 10, padding: 10, borderRadius: 15, background: "rgba(15,23,42,.62)", border: "1px solid rgba(59,130,246,.18)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, color: "#bfdbfe", fontSize: 11, fontWeight: 1000 }}>
      <span>52週高點絕對值</span><span>{n(hp.progressPct, 1)}%</span>
    </div>
    <div style={{ height: 7, borderRadius: 999, overflow: "hidden", background: "rgba(30,41,59,.95)", marginTop: 6 }}>
      <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#22c55e,#eab308,#f97316)" }} />
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginTop: 7 }}>
      <MiniStat label="現價" value={`$${n(hp.currentPrice)}`} />
      <MiniStat label="52週高" value={`$${n(hp.high52w)}`} />
      <MiniStat label="差距" value={`$${n(hp.gapToHigh)}`} color={hp.gapToHigh <= 0 ? "#bbf7d0" : "#fde68a"} />
    </div>
  </div>;
}

function QualityPanel({ row }) {
  const tone = cardTone(row);
  const label = isNewListingWatch(row) ? "新上市觀察" : tone.label;
  const semi = /manual|人工|watch/i.test(`${row.quality || ""} ${row.tier || ""}`) ? "人工確認" : "可靠稿";
  const dca = isNewListingWatch(row) ? "DCA 5U｜逢低人工" : "DCA 可｜逢低可";
  return <div style={{ marginTop: 12, padding: 14, borderRadius: 18, border: `1px solid ${tone.border}`, background: tone.soft }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
      <div style={{ color: tone.accent, fontSize: 17, fontWeight: 1000 }}>Quality</div>
      <div style={{ color: tone.accent, fontSize: 16, fontWeight: 1000 }}>{label}</div>
    </div>
    <div style={{ marginTop: 10, color: "#e2e8f0", fontSize: 15, lineHeight: 1.65, fontWeight: 950 }}>
      <div>半自動：{semi}</div>
      <div>{dca}</div>
    </div>
  </div>;
}

function StrategyPanel({ row }) {
  const tone = cardTone(row);
  const strategyTitle = isNewListingWatch(row) ? "新上市觀察" : `${row.symbol} 週期核心`;
  const fixed = Number(row.amountUSDT || 5) === 3 ? "固定 DCA：每月 3U" : "固定 DCA：每月 5U";
  const dip = isNewListingWatch(row) ? "逢低買進：需人工確認" : "逢低買進：照 D 層";
  return <div style={{ marginTop: 10, padding: 14, borderRadius: 18, border: `1px solid ${tone.border}`, background: tone.soft }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
      <div style={{ color: tone.accent, fontSize: 17, fontWeight: 1000 }}>{strategyTitle}</div>
      <div style={{ color: "#e2e8f0", fontSize: 15, fontWeight: 1000 }}>策略</div>
    </div>
    <div style={{ marginTop: 10, color: tone.accent, fontSize: 15, lineHeight: 1.65, fontWeight: 950 }}>
      <div>{fixed}</div>
      <div>{dip}</div>
    </div>
  </div>;
}

function TierRules({ row }) {
  const rules = getRules(row);
  const amounts = getAmounts(row);
  const tier = tierStatus(row);
  const hp = row.highProgress || {};
  if (!rules.length) return null;
  return <div style={{ marginTop: 12 }}>
    <div style={{ color: "#22d3ee", fontSize: 18, fontWeight: 1000, marginBottom: 8 }}>層級規則</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
      {rules.map((rule, i) => {
        const active = i === tier.completedIndex || (tier.completedIndex < 0 && i === 0);
        return <div key={`${row.symbol}-${i}`} style={{ minHeight: 86, borderRadius: 15, padding: 9, textAlign: "center", border: active ? "1px solid rgba(34,211,238,.70)" : "1px solid rgba(148,163,184,.18)", background: active ? "rgba(6,182,212,.16)" : "rgba(15,23,42,.58)", color: active ? "#22d3ee" : "#94a3b8", boxShadow: active ? "0 0 18px rgba(34,211,238,.18)" : "none" }}>
          <div style={{ fontSize: 20, fontWeight: 1000 }}>{tierName(i)}</div>
          <div style={{ fontSize: 13, fontWeight: 1000 }}>{rule}%</div>
          <div style={{ fontSize: 13, fontWeight: 1000 }}>{amounts[i]}U</div>
          <div style={{ marginTop: 4, fontSize: 11, color: active ? "#e2e8f0" : "#64748b", fontWeight: 900 }}>${n(Number(hp.high52w || 0) * (1 + Number(rule) / 100), 0)}</div>
        </div>;
      })}
    </div>
  </div>;
}

function MiniStat({ label, value, color = "#cbd5e1" }) {
  return <div style={{ minWidth: 0 }}>
    <div style={{ color: "#64748b", fontSize: 9, fontWeight: 1000 }}>{label}</div>
    <div style={{ color, fontSize: 11, fontWeight: 1000, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
  </div>;
}

function CompactPositionCard({ row, paperOnly = false }) {
  const pnl = Number(row.pnl || 0);
  const pnlColor = pnl >= 0 ? "#bbf7d0" : "#fecaca";
  const score = row.score || row.totalScore;
  const tone = cardTone(row);
  return <div style={{ padding: 13, borderRadius: 24, background: tone.bg, border: `1px solid ${tone.border}`, boxShadow: "0 18px 40px rgba(0,0,0,.20)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: "#f8fafc", fontSize: 22, fontWeight: 1000, lineHeight: 1.05 }}>{row.symbol}</div>
        <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 850, marginTop: 3 }}>{row.name || row.bucket || "—"}</div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ color: tone.accent, fontSize: 11, fontWeight: 1000 }}>{compactSource(row)}</div>
        <div style={{ color: pnlColor, fontSize: 13, fontWeight: 1000 }}>{n((row.pnlPct || 0) * 100)}%</div>
      </div>
    </div>

    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 9 }}>
      <span style={{ color: "#bfdbfe", background: "rgba(59,130,246,.12)", padding: "4px 8px", borderRadius: 999, fontSize: 10, fontWeight: 1000 }}>{row.lotCount || 1}筆</span>
      {row.tier ? <span style={{ color: "#bfdbfe", background: "rgba(59,130,246,.10)", padding: "4px 8px", borderRadius: 999, fontSize: 10, fontWeight: 1000 }}>{row.tier}</span> : null}
      {row.quality ? <span style={{ color: "#bbf7d0", background: "rgba(34,197,94,.10)", padding: "4px 8px", borderRadius: 999, fontSize: 10, fontWeight: 1000 }}>{row.quality}</span> : null}
      {score ? <span style={{ color: "#fde68a", background: "rgba(245,158,11,.12)", padding: "4px 8px", borderRadius: 999, fontSize: 10, fontWeight: 1000 }}>{score}分</span> : null}
      {row.bucket ? <span style={{ color: "#ddd6fe", background: "rgba(168,85,247,.12)", padding: "4px 8px", borderRadius: 999, fontSize: 10, fontWeight: 1000 }}>{row.bucket}</span> : null}
    </div>

    {paperOnly ? <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 14, background: "rgba(245,158,11,.12)", color: "#fde68a", fontSize: 12, fontWeight: 1000, lineHeight: 1.45 }}>
      {validationText(row)}｜未滿 4 週不得進折扣獵人觀察區
    </div> : null}

    <StatusCapsule row={row} />
    <TierProgressBar row={row} />
    <QualityPanel row={row} />
    <StrategyPanel row={row} />
    <HighProgressBar row={row} />

    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginTop: 10, color: "#cbd5e1" }}>
      <MiniStat label="總成本" value={`$${n(row.amountUSDT)}`} />
      <MiniStat label="市值" value={`$${n(row.currentValue)}`} />
      <MiniStat label="損益" value={`$${n(row.pnl)}`} color={pnlColor} />
      <MiniStat label="現價" value={`$${n(row.currentPrice, 2)}`} />
      <MiniStat label="均價" value={`$${n(row.price, 2)}`} />
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
    <div style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 900, marginBottom: 8 }}>
      成本 ${n(sums.cost)}｜市值 ${n(sums.value)}｜損益 ${n(sums.pnl)}｜報酬 {n(pnlPct * 100)}%
    </div>
    {paperOnly ? <div style={{ marginBottom: 8, color: "#fde68a", background: "rgba(245,158,11,.10)", border: "1px solid rgba(245,158,11,.22)", borderRadius: 12, padding: 9, fontSize: 12, fontWeight: 950, lineHeight: 1.5 }}>
      本區只放未滿 4 週的測試標的；不得顯示在折扣獵人觀察區，不得成為真實買入或自動交易名單。52週高點進度條：{progressCount}/{rows.length} 檔已啟用。
    </div> : null}
    <details open={defaultOpen}>
      <summary style={{ cursor: "pointer", color: "#bfdbfe", fontWeight: 1000, fontSize: 13 }}>展開 / 收合卡片</summary>
      <div style={{ display: "grid", gap: 12, marginTop: 10 }}>
        {rows.map((row) => <CompactPositionCard key={row.symbol} row={row} paperOnly={paperOnly} />)}
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
  const paperValidationPositions = useMemo(() => groupedPositions.filter((row) => !isCorePosition(row)), [groupedPositions]);
  const portfolio = useMemo(() => sumRows(groupedPositions), [groupedPositions]);
  const pnlColor = Number(portfolio.pnl || 0) >= 0 ? "#bbf7d0" : "#fecaca";
  const portfolioPnlPct = portfolio.cost > 0 ? portfolio.pnl / portfolio.cost : 0;
  const rawLotCount = summary?.summary?.openTrades || portfolio.lots || 0;
  const highProgressCount = paperValidationPositions.filter((row) => row.highProgress?.enabled).length;
  const sourceCounts = useMemo(() => paperValidationPositions.reduce((acc, row) => {
    const key = compactSource(row);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {}), [paperValidationPositions]);

  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "linear-gradient(180deg,#020617 0%,#07111f 55%,#0f172a 100%)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "22px 14px 40px" }}>
      <a href="/v17" style={{ color: "#93c5fd", textDecoration: "none", fontWeight: 900 }}>← 返回折價獵人 V17</a>
      <header style={{ marginTop: 18, marginBottom: 14 }}>
        <div style={{ color: "#22c55e", letterSpacing: 3, fontWeight: 1000, fontSize: 13 }}>V17 紙上交易自動測試</div>
        <h1 style={{ fontSize: 30, lineHeight: 1.05, margin: "10px 0", fontWeight: 1000 }}>紙上交易總控台</h1>
        <p style={{ color: "#cbd5e1", lineHeight: 1.5, fontWeight: 850, margin: 0 }}>折扣獵人主頁只放正式上線 10 檔；所有未滿 4 週的候選都留在本頁紙上驗證區。</p>
      </header>

      {error && <Box title="錯誤" tone="red"><div style={{ color: "#fecaca", fontWeight: 850 }}>{error}</div></Box>}

      <Box title="總覽" tone="green">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, color: "#cbd5e1", fontWeight: 850, fontSize: 13 }}>
          <div>模式：{summary?.settings?.mode || "AUTO_PAPER"}</div>
          <div>驗證期：4 週</div>
          <div>核心正式：{corePositions.length} 檔</div>
          <div>紙上候選：{paperValidationPositions.length} 檔</div>
          <div>紙上批次：{rawLotCount} 筆</div>
          <div>進度條：{highProgressCount}/{paperValidationPositions.length}</div>
          <div>投入成本：${n(portfolio.cost)}</div>
          <div>目前市值：${n(portfolio.value)}</div>
          <div>損益：<strong style={{ color: pnlColor }}>${n(portfolio.pnl)}</strong></div>
          <div>報酬率：<strong style={{ color: pnlColor }}>{n(portfolioPnlPct * 100)}%</strong></div>
          <div>真實下單：禁止</div>
        </div>
        <div style={{ marginTop: 10, padding: 10, borderRadius: 14, background: "rgba(2,6,23,.38)", border: "1px solid rgba(148,163,184,.12)", color: "#cbd5e1", fontWeight: 850, fontSize: 12, lineHeight: 1.6 }}>
          核心10檔 {corePositions.length}｜4週紙上 {paperValidationPositions.length}｜M45 {sourceCounts["M45紙上"] || 0}｜M91 {sourceCounts["M91紙上"] || 0}｜M10 {sourceCounts["M10紙上"] || 0}｜產業 {sourceCounts["產業紙上"] || 0}
        </div>
        <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 850, marginTop: 8, lineHeight: 1.5 }}>
          新版卡片：D層進度 = 目前折價在兩個買點層級間的位置；52週高點絕對值 = 現價 ÷ 52週高點。
        </div>
      </Box>

      <Box title="操作">
        <button disabled={busy} onClick={runPaper} style={{ width: "100%", padding: "13px 10px", borderRadius: 14, border: "1px solid rgba(34,197,94,.45)", background: "rgba(34,197,94,.18)", color: "#bbf7d0", fontWeight: 1000 }}>今天跑一次紙上交易</button>
        <button disabled={busy} onClick={load} style={{ width: "100%", marginTop: 8, padding: "12px 10px", borderRadius: 14, border: "1px solid rgba(59,130,246,.35)", background: "rgba(59,130,246,.12)", color: "#bfdbfe", fontWeight: 1000 }}>重新整理</button>
        {lastRun && <div style={{ marginTop: 10, color: "#bbf7d0", fontWeight: 900 }}>本次可測 {lastRun.eligibleCount || 0} 檔，新增 {lastRun.createdCount} 筆，略過 {lastRun.skippedCount} 筆。</div>}
        {lastRun?.skipped?.length ? <div style={{ marginTop: 8, color: "#fde68a", fontSize: 12, fontWeight: 850, lineHeight: 1.45 }}>略過原因：{lastRun.skipped.slice(0, 6).map((x) => `${x.symbol}:${x.reason}`).join("；")}</div> : null}
      </Box>

      <Box title="收斂規則" tone="yellow">
        <div style={{ color: "#cbd5e1", fontWeight: 850, lineHeight: 1.6, fontSize: 13 }}>
          <div>折扣獵人主頁：只放目前正式上線 10 檔。</div>
          <div>紙上候選：必須先在本頁跑滿 4 週。</div>
          <div>未滿 4 週：不得進折扣獵人觀察區、不得真實下單、不得自動交易。</div>
          <div>Market45：{market45?.covered || 0}/{market45?.total || 45}，{statusText(market45?.status)}</div>
        </div>
      </Box>

      <PositionSection title="核心正式10檔紙上追蹤" rows={corePositions} tone="blue" defaultOpen={false} />
      <PositionSection title="4週紙上驗證區" rows={paperValidationPositions} tone="green" defaultOpen paperOnly />
      <BlockedList market45={market45} />
    </div>
  </main>;
}
