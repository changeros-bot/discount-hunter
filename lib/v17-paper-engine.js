import fs from "fs/promises";
import path from "path";
import { createRequire } from "module";
import { getAssetRegistry } from "./v17-asset-registry";
import { nowIso, readPaperStore, taipeiDateKey, writePaperStore } from "./v17-paper-store";
import { getMarket91Shortlist } from "./v17-market-91-shortlist";
import { getMarket91QualityDrafts } from "./v17-market-91-quality-drafts";
import { finalizeMarket45Review } from "./v17-market-45-finalizer";
import { applyPaperDiscountRule } from "./v17-paper-discount-rules";

const require = createRequire(import.meta.url);

const DEFAULT_SETTINGS = {
  mode: "AUTO_PAPER",
  testDays: 28,
  dailyMaxTrades: 50,
  perTradeUSDT: 5,
  existingTenSymbols: ["BTC", "QQQon", "NVDAon", "TSMon", "AVGOon", "SPCXon", "GOOGLon", "AMDon", "MRVLon", "RKLBon"],
  includeMarket45Candidates: true,
};

function normalize(symbol) {
  return String(symbol || "").trim().toUpperCase();
}

function paperKey(symbol) {
  return normalize(symbol).replace(/ON$/, "");
}

function dateOnly(value) {
  return String(value || "").slice(0, 10);
}

function daysBetween(a, b) {
  const ax = Date.parse(`${dateOnly(a)}T00:00:00Z`);
  const bx = Date.parse(`${dateOnly(b)}T00:00:00Z`);
  if (!Number.isFinite(ax) || !Number.isFinite(bx)) return 0;
  return Math.floor((bx - ax) / 86400000);
}

function marketFor(markets = {}, symbol) {
  const candidates = [symbol, normalize(symbol), `${normalize(symbol)}on`, paperKey(symbol)];
  for (const key of candidates) {
    if (markets[key]) return markets[key];
  }
  const foundKey = Object.keys(markets || {}).find((key) => normalize(key) === normalize(symbol) || normalize(key) === `${normalize(symbol)}ON` || paperKey(key) === paperKey(symbol));
  return foundKey ? markets[foundKey] : null;
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function isExistingTenSymbol(symbol, settings = DEFAULT_SETTINGS) {
  const existingSet = new Set((settings.existingTenSymbols || []).map((s) => paperKey(s)));
  return existingSet.has(paperKey(symbol));
}

function unifiedGroupFor(symbol, settings = DEFAULT_SETTINGS) {
  return isExistingTenSymbol(symbol, settings) ? "既有V17十檔" : "預備名單";
}

function unifiedSourceFor(symbol, settings = DEFAULT_SETTINGS) {
  return isExistingTenSymbol(symbol, settings) ? "existing_ten" : "prepared_list";
}

function buildTrigger(asset, market) {
  const price = toNumber(market?.price, 0);
  const high = toNumber(market?.high52w || market?.high || market?.cycleHigh, 0);
  const discount = market?.discount !== undefined ? toNumber(market.discount, 0) : (high > 0 && price > 0 ? ((price / high) - 1) * 100 : null);
  const rules = Array.isArray(asset.rules) ? asset.rules : [];
  const tierIndex = rules.findIndex((rule) => discount !== null && discount <= Number(rule));
  return {
    price,
    high,
    discount,
    tier: tierIndex >= 0 ? `D${tierIndex + 1}` : "TEST",
    trigger: tierIndex >= 0 ? "折價層級觸發" : "紙上測試建倉",
  };
}

function buildPlaybook(asset) {
  const isPrepared = asset.paperSource === "prepared_list" || asset.paperSource === "market45_candidate";
  if (isPrepared) {
    return {
      title: `${asset.symbol} 預備名單 4週紙上驗證 Playbook`,
      thesis: asset.reason || asset.decision || "預備名單紙上候選，先用 4 週驗證績效、回撤與資料品質。",
      entryRule: Array.isArray(asset.rules) && asset.rules.length ? `折價層級：${asset.rules.map((x, i) => `D${i + 1} ${x}%`).join(" / ")}` : "紙上測試建倉；缺正式折價層級時不得作為買點依據。",
      sizing: Array.isArray(asset.amounts) && asset.amounts.length ? `層級金額：${asset.amounts.map((x, i) => `D${i + 1} ${x}U`).join(" / ")}` : "每檔 5U；不加碼；不補倉；不轉真倉。",
      exitRule: "第 4 週檢查 PnL、最大浮虧、報價穩定性、流動性與資料品質；未通過則退回觀察。",
      riskRule: asset.risk || asset.rule || "來源驗證與財務品質未完全通過前，不得進真實自動交易。",
      whyIncluded: asset.decision || "通過紙上交易候選門檻。",
      whyNotReal: "這只是預備名單紙上驗證，不是真實交易白名單；禁止真實自動交易。",
    };
  }
  return {
    title: `${asset.symbol} 折價獵人 Playbook`,
    thesis: asset.description || asset.name || "既有 V17 標的。",
    entryRule: Array.isArray(asset.rules) && asset.rules.length ? `折價層級：${asset.rules.map((x, i) => `D${i + 1} ${x}%`).join(" / ")}` : "紙上測試建倉。",
    sizing: Array.isArray(asset.amounts) && asset.amounts.length ? `層級金額：${asset.amounts.map((x, i) => `D${i + 1} ${x}U`).join(" / ")}` : "每筆 5U 紙上測試。",
    exitRule: "紙上測試只供驗證；真實持倉仍依 V17 原規則，不由紙上交易自動轉入。",
    riskRule: asset.reEvaluateTrigger || "若投資論點破壞、資料源失真或流動性異常，退回觀察。",
    whyIncluded: asset.backtestConclusion || asset.description || "既有 V17 標的，允許進紙上交易測試。",
    whyNotReal: "紙上交易結果只供驗證，不會自動轉成真實買入。",
  };
}

function paperEligibleFromQuality(item) {
  if (!item) return false;
  if (item.quality !== "PASSED_DRAFT") return false;
  const score = Number(item.totalScore || 0);
  const isHighRisk = /能源|油氣|天然氣|鋼鐵|週期|高波動/.test(`${item.bucket || ""} ${item.role || ""} ${item.rule || ""}`);
  return score >= 15 && !isHighRisk;
}

function statusBucketFromRow(row) {
  const status = String(row.status || row.tier || "");
  const bucketText = `${row.bucket || ""} ${row.proposedRole || ""} ${row.proposedRule || ""} ${row.note || ""}`;
  if (/BLOCKED|OBJECTIVE_.*BLOCK|RISK_BLOCK|FINANCIAL_BLOCK|EXCLUDE/.test(status)) return "封鎖";
  if (/FORMAL_OBSERVATION/.test(status)) return "正式觀察";
  if (/RESERVE|SECOND_REVIEW|RESEARCH_POOL/.test(status)) {
    if (/能源|油氣|天然氣|鋼鐵|週期|ETF/.test(bucketText)) return "工具股_題材股";
    return "次級觀察";
  }
  return null;
}

function classifyMarketRow(row, qualityMap) {
  const quality = qualityMap.get(normalize(row.symbol));
  const merged = {
    symbol: row.symbol,
    name: row.name || row.symbol,
    bucket: row.bucket || row.sector || row.category || "待分類",
    tier: row.tier || row.reviewTier || row.status || "BATCH_SOURCE",
    reason: row.reason || row.thesis || row.note || "由 batch 匯入，待 Quality Gate",
    proposedRole: row.proposedRole || row.role || "Batch Candidate",
    proposedRule: row.proposedRule || row.rule || "先收斂進預備名單，不直接進 V17 / 自動交易",
    quality: quality?.quality || row.quality || "未審核",
    totalScore: quality?.totalScore ?? row.totalScore ?? row.score ?? null,
    objectiveScore: quality?.objectiveScore ?? null,
    qualitativeScore: quality?.qualitativeScore ?? null,
    risk: quality?.risk || row.risk || row.blocker || row.reason || "待補風險說明",
    rule: quality?.rule || row.rule || row.proposedRule || "先觀察，不自動化",
    source: row.source || "batch_module",
    sourceFile: row.sourceFile || null,
  };

  if (paperEligibleFromQuality(quality)) {
    return { bucket: "紙上交易候選", row: { ...merged, decision: "可列入 4 週紙上驗證；禁止進入真實自動交易。" } };
  }
  if (quality?.quality === "PASSED_DRAFT" || row.tier === "DEEP_REVIEW") {
    return { bucket: "正式觀察", row: { ...merged, decision: "正式觀察；等來源驗證後再決定是否進紙上交易" } };
  }
  if (row.tier === "SECOND_REVIEW") {
    const cyclical = /能源|油氣|天然氣|鋼鐵|週期|ETF/.test(`${row.bucket || ""} ${row.proposedRole || ""} ${row.proposedRule || ""}`);
    if (cyclical) return { bucket: "工具股_題材股", row: { ...merged, decision: "只能人工研究，不進自動化" } };
    return { bucket: "次級觀察", row: { ...merged, decision: "二階觀察；暫不進紙上交易" } };
  }
  const statusBucket = statusBucketFromRow(row);
  if (statusBucket) {
    const decision = statusBucket === "封鎖" ? "已被風控或財務層阻擋，不進觀察 / 紙上交易" : statusBucket === "正式觀察" ? "正式觀察候選；仍需來源驗證，不進真實自動交易" : statusBucket === "工具股_題材股" ? "只能人工研究，不進自動化" : "次級觀察；待 Quality Gate，不進紙上交易";
    return { bucket: statusBucket, row: { ...merged, decision } };
  }
  if (row.source === "market_91_batch_module" || row.source === "market_91_batch_scan") {
    return { bucket: "次級觀察", row: { ...merged, decision: "由 batch 補入；待 Quality Gate，不進紙上交易" } };
  }
  return { bucket: "缺資料", row: { ...merged, decision: "資料不足" } };
}

function rowsFromModule(mod, sourceFile) {
  const rows = [];
  for (const value of Object.values(mod || {})) {
    if (Array.isArray(value)) rows.push(...value);
    if (typeof value === "function") {
      try {
        const result = value();
        if (Array.isArray(result?.rows)) rows.push(...result.rows);
      } catch {
        // ignore unsafe batch export
      }
    }
  }
  return rows
    .filter((row) => row && row.symbol)
    .map((row) => ({ ...row, source: "market_91_batch_module", sourceFile }));
}

async function scanMarket91BatchRows() {
  try {
    const libDir = path.join(process.cwd(), "lib");
    const files = await fs.readdir(libDir);
    const batchFiles = files.filter((file) => /^v17-market-91-.*batch.*\.js$/.test(file));
    const rows = [];
    for (const file of batchFiles) {
      try {
        const mod = require(`./${file}`);
        rows.push(...rowsFromModule(mod, file));
        continue;
      } catch {
        // fall through to text scan
      }
      const source = await fs.readFile(path.join(libDir, file), "utf8").catch(() => "");
      const symbolMatches = [...source.matchAll(/symbol\s*:\s*["']([^"']+)["']/g)];
      for (const match of symbolMatches) {
        const symbol = match[1];
        rows.push({ symbol, name: symbol, bucket: "Batch", tier: "BATCH_SOURCE", reason: "batch candidate", source: "market_91_batch_scan", sourceFile: file });
      }
    }
    return rows;
  } catch {
    return [];
  }
}

function dedupeRows(rows = []) {
  const map = new Map();
  for (const row of rows) {
    const key = normalize(row.symbol);
    if (!key) continue;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, row);
      continue;
    }
    const existingPriority = existing.tier === "DEEP_REVIEW" ? 3 : existing.tier === "SECOND_REVIEW" ? 2 : existing.status?.includes?.("FORMAL_OBSERVATION") ? 3 : existing.score ? 2 : 1;
    const nextPriority = row.tier === "DEEP_REVIEW" ? 3 : row.tier === "SECOND_REVIEW" ? 2 : row.status?.includes?.("FORMAL_OBSERVATION") ? 3 : row.score ? 2 : 1;
    if (nextPriority > existingPriority) map.set(key, { ...existing, ...row });
  }
  return [...map.values()];
}

export async function readPaperSettings() {
  const settings = await readPaperStore("settings", DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...(settings || {}), testDays: Number(settings?.testDays || DEFAULT_SETTINGS.testDays) === 7 ? 28 : Number(settings?.testDays || DEFAULT_SETTINGS.testDays) };
}

export async function readPaperTrades() {
  const trades = await readPaperStore("trades", []);
  return Array.isArray(trades) ? trades : [];
}

function buildExistingTenAssets(registry, settings) {
  const existingSet = new Set((settings.existingTenSymbols || []).map(normalize));
  return registry
    .filter((asset) => existingSet.has(normalize(asset.symbol)))
    .map((asset) => ({ ...asset, paperGroup: "既有V17十檔", paperSource: "existing_ten", playbook: buildPlaybook({ ...asset, paperSource: "existing_ten" }) }));
}

function buildMarket45PaperAssets(review) {
  const finalized = finalizeMarket45Review(review);
  return (finalized?.finalBuckets?.["紙上交易測試"] || []).map((row) => {
    const asset = applyPaperDiscountRule({
      symbol: row.symbol,
      name: row.name || row.symbol,
      rules: [],
      amounts: [],
      paperGroup: "預備名單",
      paperSource: "prepared_list",
      quality: row.quality,
      score: row.totalScore,
      bucket: row.bucket,
      reason: row.reason,
      risk: row.risk,
      rule: row.rule,
      decision: row.finalDecision || row.decision,
    });
    return { ...asset, playbook: buildPlaybook(asset) };
  });
}

function buildOpenPaperAssets(trades = [], settings = DEFAULT_SETTINGS) {
  return trades
    .filter((trade) => trade?.status === "OPEN" && trade?.symbol)
    .map((trade) => ({
      symbol: trade.symbol,
      name: trade.name || trade.symbol,
      rules: Array.isArray(trade.rules) ? trade.rules : [],
      amounts: Array.isArray(trade.amounts) ? trade.amounts : [],
      paperGroup: unifiedGroupFor(trade.symbol, settings),
      paperSource: unifiedSourceFor(trade.symbol, settings),
      quality: trade.quality || null,
      score: trade.score || null,
      bucket: trade.bucket || null,
      reason: trade.reason || trade.trigger || "已在線紙上部位",
      risk: trade.risk || null,
      rule: trade.rule || null,
      decision: trade.decision || null,
      playbook: trade.playbook || buildPlaybook({ ...trade, paperSource: unifiedSourceFor(trade.symbol, settings) }),
    }));
}

function dedupeAssets(assets = []) {
  const map = new Map();
  for (const asset of assets) {
    const key = paperKey(asset.symbol);
    if (!map.has(key)) map.set(key, asset);
  }
  return [...map.values()];
}

function isActiveOpenTrade(trade, asset, today, testDays) {
  if (!trade || trade.status !== "OPEN") return false;
  if (paperKey(trade.symbol) !== paperKey(asset.symbol)) return false;
  const ageDays = daysBetween(trade.dateKey || trade.createdAt, today);
  return ageDays >= 0 && ageDays < Number(testDays || 28);
}

function inferPaperGroup(trade, meta, settings = DEFAULT_SETTINGS) {
  if (isExistingTenSymbol(trade?.symbol || meta?.symbol, settings)) return "既有V17十檔";
  return "預備名單";
}

function inferPaperSourceType(trade, meta, settings = DEFAULT_SETTINGS) {
  if (isExistingTenSymbol(trade?.symbol || meta?.symbol, settings)) return "existing_ten";
  return "prepared_list";
}

function withPaperMetrics(trade, currentPrice, currentValue, cost, pnl, pnlPct, now = nowIso()) {
  const priorMaxGain = Number(trade.maxGainUSDT ?? trade.maxGain ?? pnl);
  const priorMaxDrawdown = Number(trade.maxDrawdownUSDT ?? trade.maxDrawdown ?? pnl);
  const maxGainUSDT = Math.max(Number.isFinite(priorMaxGain) ? priorMaxGain : pnl, pnl);
  const maxDrawdownUSDT = Math.min(Number.isFinite(priorMaxDrawdown) ? priorMaxDrawdown : pnl, pnl);
  const priorMaxGainPct = Number(trade.maxGainPct ?? pnlPct);
  const priorMaxDrawdownPct = Number(trade.maxDrawdownPct ?? pnlPct);
  const maxGainPct = Math.max(Number.isFinite(priorMaxGainPct) ? priorMaxGainPct : pnlPct, pnlPct);
  const maxDrawdownPct = Math.min(Number.isFinite(priorMaxDrawdownPct) ? priorMaxDrawdownPct : pnlPct, pnlPct);
  return {
    ...trade,
    currentPrice,
    currentValue,
    pnl,
    pnlPct,
    maxGainUSDT,
    maxDrawdownUSDT,
    maxGainPct,
    maxDrawdownPct,
    lastSnapshotAt: now,
    paperMetricSource: "summary_runtime_snapshot",
    paperMetricNote: "PnL / 最大浮盈 / 最大浮虧由真實報價或 token 報價快照計算；不會觸發真實交易。",
  };
}

export async function runAutoPaperTrading({ markets = {}, force = false } = {}) {
  const settings = await readPaperSettings();
  const allTrades = await readPaperTrades();
  const registry = getAssetRegistry();
  const market45 = finalizeMarket45Review(await readMarket45Review());
  const today = taipeiDateKey();
  const now = nowIso();
  const openAssets = buildOpenPaperAssets(allTrades, settings);
  const eligible = dedupeAssets([
    ...buildExistingTenAssets(registry, settings),
    ...(settings.includeMarket45Candidates ? buildMarket45PaperAssets(market45) : []),
    ...openAssets,
  ]).map((asset) => ({
    ...asset,
    paperGroup: unifiedGroupFor(asset.symbol, settings),
    paperSource: unifiedSourceFor(asset.symbol, settings),
  }));
  const todaysTrades = allTrades.filter((trade) => trade.dateKey === today);
  const remainingSlots = Math.max(0, Number(settings.dailyMaxTrades || 50) - todaysTrades.length);
  const created = [];
  const skipped = [];

  for (const asset of eligible) {
    const activeDuplicate = allTrades.find((trade) => isActiveOpenTrade(trade, asset, today, settings.testDays));
    if (activeDuplicate) {
      skipped.push({ symbol: asset.symbol, group: asset.paperGroup, reason: "已有 OPEN 紙上部位；防重複建倉", existingId: activeDuplicate.id, forceIgnored: Boolean(force) });
      continue;
    }
    const market = marketFor(markets, asset.symbol);
    if (!market) {
      skipped.push({ symbol: asset.symbol, group: asset.paperGroup, reason: "缺少價格資料" });
      continue;
    }
    if (!force && allTrades.some((trade) => trade.dateKey === today && paperKey(trade.symbol) === paperKey(asset.symbol))) {
      skipped.push({ symbol: asset.symbol, group: asset.paperGroup, reason: "今日已建立紙上交易" });
      continue;
    }
    if (!force && created.length >= remainingSlots) {
      skipped.push({ symbol: asset.symbol, group: asset.paperGroup, reason: "達到每日紙上交易上限" });
      continue;
    }

    const trigger = buildTrigger(asset, market);
    const amountUSDT = Number(asset.amountUSDT || settings.perTradeUSDT || 5);
    const quantity = trigger.price > 0 ? amountUSDT / trigger.price : 0;
    if (!trigger.price || !quantity) {
      skipped.push({ symbol: asset.symbol, group: asset.paperGroup, reason: "價格無效" });
      continue;
    }

    const trade = {
      id: `PAPER-${today.replace(/-/g, "")}-${asset.symbol}-${trigger.tier}`,
      dateKey: today,
      createdAt: now,
      symbol: asset.symbol,
      name: asset.name,
      group: asset.paperGroup,
      sourceType: asset.paperSource,
      tier: trigger.tier,
      amountUSDT,
      price: trigger.price,
      quantity,
      discount: trigger.discount,
      trigger: trigger.trigger,
      source: `${asset.paperGroup}自動紙上交易`,
      testDays: Number(settings.testDays || 28),
      status: "OPEN",
      realOrder: false,
      quality: asset.quality || null,
      score: asset.score || null,
      bucket: asset.bucket || null,
      playbook: asset.playbook || buildPlaybook(asset),
      maxGainUSDT: 0,
      maxDrawdownUSDT: 0,
      maxGainPct: 0,
      maxDrawdownPct: 0,
      lastSnapshotAt: now,
    };
    created.push(trade);
  }

  const nextTrades = [...created, ...allTrades];
  const storage = created.length ? await writePaperStore("trades", nextTrades) : null;
  const coreCount = eligible.filter((asset) => isExistingTenSymbol(asset.symbol, settings)).length;
  const preparedCount = eligible.length - coreCount;
  return {
    ok: true,
    mode: settings.mode,
    testDays: settings.testDays,
    today,
    eligibleCount: eligible.length,
    createdCount: created.length,
    skippedCount: skipped.length,
    created,
    skipped,
    storage,
    scanScope: {
      label: "全部紙上交易名單",
      total: eligible.length,
      coreCount,
      preparedCount,
      note: "掃描既有10檔與所有 OPEN 預備名單；新增前先防重複建倉。",
    },
    duplicateGuard: "active open paper trade with same symbol blocks new lots even when force=true",
    note: "紙上交易只寫入模擬紀錄，不會送出任何真實訂單。",
  };
}

export async function getPaperSummary({ markets = {}, persistMetrics = false } = {}) {
  const [settings, trades, rawMarket45] = await Promise.all([readPaperSettings(), readPaperTrades(), readMarket45Review()]);
  const market45 = finalizeMarket45Review(rawMarket45);
  const registry = getAssetRegistry();
  const market45Assets = buildMarket45PaperAssets(market45);
  const existingAssets = buildExistingTenAssets(registry, settings);
  const openTradeAssets = buildOpenPaperAssets(trades, settings);
  const playbookMap = new Map(dedupeAssets([...existingAssets, ...market45Assets, ...openTradeAssets]).map((asset) => [paperKey(asset.symbol), asset]));
  const openTrades = trades.filter((trade) => trade.status === "OPEN");
  const snapshotAt = nowIso();
  const positions = openTrades.map((trade) => {
    const market = marketFor(markets, trade.symbol);
    const currentPrice = toNumber(market?.price, trade.price);
    const currentValue = currentPrice * Number(trade.quantity || 0);
    const cost = Number(trade.amountUSDT || 0);
    const pnl = currentValue - cost;
    const pnlPct = cost > 0 ? pnl / cost : 0;
    const meta = playbookMap.get(paperKey(trade.symbol));
    const group = inferPaperGroup(trade, meta, settings);
    const sourceType = inferPaperSourceType(trade, meta, settings);
    return withPaperMetrics({ ...trade, group, sourceType, playbook: trade.playbook || meta?.playbook || null, quality: trade.quality || meta?.quality || null, score: trade.score || meta?.score || null, bucket: trade.bucket || meta?.bucket || null }, currentPrice, currentValue, cost, pnl, pnlPct, snapshotAt);
  });
  if (persistMetrics) {
    const byId = new Map(positions.map((row) => [row.id, row]));
    const nextTrades = trades.map((trade) => byId.get(trade.id) || trade);
    await writePaperStore("trades", nextTrades);
  }
  const cost = positions.reduce((sum, row) => sum + Number(row.amountUSDT || 0), 0);
  const value = positions.reduce((sum, row) => sum + Number(row.currentValue || 0), 0);
  const pnl = value - cost;
  const symbolCount = new Set(positions.map((row) => paperKey(row.symbol))).size;
  const groups = positions.reduce((acc, row) => {
    const key = row.group || "未分類";
    acc[key] = acc[key] || { lotCount: 0, symbolCount: 0, symbols: new Set(), cost: 0, value: 0, pnl: 0, maxDrawdownUSDT: 0, maxGainUSDT: 0 };
    acc[key].lotCount += 1;
    acc[key].symbols.add(paperKey(row.symbol));
    acc[key].cost += Number(row.amountUSDT || 0);
    acc[key].value += Number(row.currentValue || 0);
    acc[key].pnl += Number(row.pnl || 0);
    acc[key].maxDrawdownUSDT = Math.min(acc[key].maxDrawdownUSDT, Number(row.maxDrawdownUSDT || 0));
    acc[key].maxGainUSDT = Math.max(acc[key].maxGainUSDT, Number(row.maxGainUSDT || 0));
    return acc;
  }, {});
  for (const group of Object.values(groups)) {
    group.symbolCount = group.symbols.size;
    group.symbols = [...group.symbols];
    group.pnlPct = group.cost > 0 ? group.pnl / group.cost : 0;
    group.maxDrawdownPct = group.cost > 0 ? group.maxDrawdownUSDT / group.cost : 0;
    group.maxGainPct = group.cost > 0 ? group.maxGainUSDT / group.cost : 0;
    group.count = group.lotCount;
  }
  return {
    ok: true,
    settings,
    trades,
    positions,
    paperAssets: dedupeAssets([...existingAssets, ...market45Assets, ...openTradeAssets]),
    market45PaperCandidates: [],
    preparedListPolicy: {
      enabled: true,
      label: "預備名單",
      note: "Market45 / Market91 / Market10 / 產業模組不再分開顯示；全部統一為預備名單。",
    },
    summary: {
      totalTrades: trades.length,
      openTrades: positions.length,
      lotCount: positions.length,
      symbolCount,
      cost,
      value,
      pnl,
      pnlPct: cost > 0 ? pnl / cost : 0,
      maxDrawdownUSDT: positions.reduce((min, row) => Math.min(min, Number(row.maxDrawdownUSDT || 0)), 0),
      maxGainUSDT: positions.reduce((max, row) => Math.max(max, Number(row.maxGainUSDT || 0)), 0),
      testDays: settings.testDays,
      existingTenCount: settings.existingTenSymbols?.length || 0,
      preparedListCount: positions.filter((row) => row.group === "預備名單").length,
      groups,
      persistedMetrics: Boolean(persistMetrics),
      snapshotAt,
    },
  };
}

export async function readMarket45Review() {
  const seed = await readPaperStore("market45", {});
  const shortlist = getMarket91Shortlist();
  const quality = getMarket91QualityDrafts();
  const scannedRows = await scanMarket91BatchRows();
  const qualityMap = new Map((quality.rows || []).map((row) => [normalize(row.symbol), row]));
  const combinedRows = dedupeRows([...(shortlist.rows || []), ...scannedRows]).slice(0, 45);
  const buckets = {
    "紙上交易候選": [],
    "正式觀察": [],
    "次級觀察": [],
    "工具股_題材股": [],
    "封鎖": [],
    "缺資料": [],
  };

  for (const row of combinedRows) {
    const result = classifyMarketRow(row, qualityMap);
    buckets[result.bucket].push(result.row);
  }

  const covered = combinedRows.length;
  const missingCount = Math.max(0, 45 - covered);
  for (let i = 1; i <= missingCount; i += 1) {
    buckets["缺資料"].push({ symbol: `待補-${i}`, name: "尚未匯入候選", decision: "需接入剩餘批次資料" });
  }

  return {
    ...seed,
    updatedAt: nowIso(),
    total: 45,
    covered,
    missingCount,
    status: missingCount > 0 ? "partial_consolidation" : "consolidated",
    formalWatchTarget: "10-15",
    paperTestTarget: "3-5",
    paperTestDays: 28,
    source: "shortlist_quality_drafts_and_batch_module_exports",
    scannedBatchCount: scannedRows.length,
    summary: Object.fromEntries(Object.entries(buckets).map(([key, rows]) => [key, rows.length])),
    buckets,
    note: missingCount > 0
      ? `目前已收斂 ${covered}/45 檔；仍缺 ${missingCount} 檔。既有 V17 十檔已獨立進入紙上交易測試。`
      : "45 檔已完成收斂；候選需通過 finalBuckets 紙上交易測試門檻後，才可進入預備名單。",
  };
}
