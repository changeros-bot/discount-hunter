import fs from "fs/promises";
import path from "path";
import { createRequire } from "module";
import { getAssetRegistry } from "./v17-asset-registry";
import { nowIso, readPaperStore, taipeiDateKey, writePaperStore } from "./v17-paper-store";
import { getMarket91Shortlist } from "./v17-market-91-shortlist";
import { getMarket91QualityDrafts } from "./v17-market-91-quality-drafts";

const require = createRequire(import.meta.url);

const DEFAULT_SETTINGS = {
  mode: "AUTO_PAPER",
  testDays: 7,
  dailyMaxTrades: 3,
  perTradeUSDT: 5,
  existingTenSymbols: ["BTC", "QQQon", "NVDAon", "TSMon", "AVGOon", "SPCXon", "GOOGLon", "AMDon", "MRVLon", "RKLBon"],
};

function normalize(symbol) {
  return String(symbol || "").trim().toUpperCase();
}

function marketFor(markets = {}, symbol) {
  const direct = markets[symbol] || markets[normalize(symbol)] || null;
  if (direct) return direct;
  const foundKey = Object.keys(markets || {}).find((key) => normalize(key) === normalize(symbol));
  return foundKey ? markets[foundKey] : null;
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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
    tier: tierIndex >= 0 ? `D${tierIndex + 1}` : null,
    trigger: tierIndex >= 0 ? "折價層級觸發" : "未達買點",
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
    reason: row.reason || row.thesis || row.note || "由 Market 91 batch 匯入，待 Quality Gate",
    proposedRole: row.proposedRole || row.role || "Batch Candidate",
    proposedRule: row.proposedRule || row.rule || "先收斂進 45 檔總表，不直接進 V17 / 自動交易",
    quality: quality?.quality || row.quality || "未審核",
    totalScore: quality?.totalScore ?? row.totalScore ?? row.score ?? null,
    objectiveScore: quality?.objectiveScore ?? null,
    qualitativeScore: quality?.qualitativeScore ?? null,
    risk: quality?.risk || row.risk || row.blocker || row.reason || "待補風險說明",
    rule: quality?.rule || row.rule || row.proposedRule || "先觀察，不自動化",
    source: row.source || "market_91_batch_module",
    sourceFile: row.sourceFile || null,
  };

  if (paperEligibleFromQuality(quality)) {
    return { bucket: "紙上交易候選", row: { ...merged, decision: "可列 7 天紙上交易候選，但仍不進真實自動交易" } };
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
        rows.push({ symbol, name: symbol, bucket: "Market 91 Batch", tier: "BATCH_SOURCE", reason: "batch candidate", source: "market_91_batch_scan", sourceFile: file });
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
  return { ...DEFAULT_SETTINGS, ...(settings || {}) };
}

export async function readPaperTrades() {
  const trades = await readPaperStore("trades", []);
  return Array.isArray(trades) ? trades : [];
}

export async function runAutoPaperTrading({ markets = {}, force = false } = {}) {
  const settings = await readPaperSettings();
  const allTrades = await readPaperTrades();
  const registry = getAssetRegistry();
  const today = taipeiDateKey();
  const now = nowIso();
  const existingSet = new Set((settings.existingTenSymbols || []).map(normalize));
  const eligible = registry.filter((asset) => existingSet.has(normalize(asset.symbol)));
  const todaysTrades = allTrades.filter((trade) => trade.dateKey === today);
  const remainingSlots = Math.max(0, Number(settings.dailyMaxTrades || 3) - todaysTrades.length);
  const created = [];
  const skipped = [];

  for (const asset of eligible) {
    const market = marketFor(markets, asset.symbol);
    if (!market) {
      skipped.push({ symbol: asset.symbol, reason: "缺少價格資料" });
      continue;
    }
    if (!force && allTrades.some((trade) => trade.dateKey === today && normalize(trade.symbol) === normalize(asset.symbol))) {
      skipped.push({ symbol: asset.symbol, reason: "今日已建立紙上交易" });
      continue;
    }
    if (!force && created.length >= remainingSlots) {
      skipped.push({ symbol: asset.symbol, reason: "達到每日紙上交易上限" });
      continue;
    }

    const trigger = buildTrigger(asset, market);
    if (!trigger.tier) {
      skipped.push({ symbol: asset.symbol, reason: "未達買點", discount: trigger.discount });
      continue;
    }

    const amountUSDT = Number(settings.perTradeUSDT || 5);
    const quantity = trigger.price > 0 ? amountUSDT / trigger.price : 0;
    const trade = {
      id: `PAPER-${today.replace(/-/g, "")}-${asset.symbol}-${trigger.tier}`,
      dateKey: today,
      createdAt: now,
      symbol: asset.symbol,
      name: asset.name,
      tier: trigger.tier,
      amountUSDT,
      price: trigger.price,
      quantity,
      discount: trigger.discount,
      trigger: trigger.trigger,
      source: "既有10檔自動紙上交易",
      testDays: Number(settings.testDays || 7),
      status: "OPEN",
      realOrder: false,
    };
    created.push(trade);
  }

  const nextTrades = [...created, ...allTrades];
  const storage = created.length ? await writePaperStore("trades", nextTrades) : null;
  return {
    ok: true,
    mode: settings.mode,
    testDays: settings.testDays,
    today,
    createdCount: created.length,
    skippedCount: skipped.length,
    created,
    skipped,
    storage,
    note: "紙上交易只寫入模擬紀錄，不會送出任何真實訂單。",
  };
}

export async function getPaperSummary({ markets = {} } = {}) {
  const [settings, trades] = await Promise.all([readPaperSettings(), readPaperTrades()]);
  const openTrades = trades.filter((trade) => trade.status === "OPEN");
  const positions = openTrades.map((trade) => {
    const market = marketFor(markets, trade.symbol);
    const currentPrice = toNumber(market?.price, trade.price);
    const currentValue = currentPrice * Number(trade.quantity || 0);
    const cost = Number(trade.amountUSDT || 0);
    const pnl = currentValue - cost;
    const pnlPct = cost > 0 ? pnl / cost : 0;
    return { ...trade, currentPrice, currentValue, pnl, pnlPct };
  });
  const cost = positions.reduce((sum, row) => sum + Number(row.amountUSDT || 0), 0);
  const value = positions.reduce((sum, row) => sum + Number(row.currentValue || 0), 0);
  const pnl = value - cost;
  return {
    ok: true,
    settings,
    trades,
    positions,
    summary: {
      totalTrades: trades.length,
      openTrades: positions.length,
      cost,
      value,
      pnl,
      pnlPct: cost > 0 ? pnl / cost : 0,
      testDays: settings.testDays,
      existingTenCount: settings.existingTenSymbols?.length || 0,
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
    buckets["缺資料"].push({ symbol: `待補-${i}`, name: "Market 91 尚未匯入候選", decision: "需接入剩餘批次資料" });
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
    paperTestDays: 7,
    source: "market_91_shortlist_quality_drafts_and_batch_module_exports",
    scannedBatchCount: scannedRows.length,
    summary: Object.fromEntries(Object.entries(buckets).map(([key, rows]) => [key, rows.length])),
    buckets,
    note: missingCount > 0
      ? `目前已收斂 ${covered}/45 檔；仍缺 ${missingCount} 檔。既有 V17 十檔已獨立進入紙上交易測試。`
      : "45 檔已完成收斂；既有 V17 十檔已獨立進入紙上交易測試。",
  };
}
