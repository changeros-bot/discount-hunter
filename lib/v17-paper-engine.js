import { getAssetRegistry } from "./v17-asset-registry";
import { nowIso, readPaperStore, taipeiDateKey, writePaperStore } from "./v17-paper-store";
import { getMarket91Shortlist } from "./v17-market-91-shortlist";
import { getMarket91QualityDrafts } from "./v17-market-91-quality-drafts";

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

function classifyMarketRow(row, qualityMap) {
  const quality = qualityMap.get(normalize(row.symbol));
  const merged = {
    symbol: row.symbol,
    name: row.name,
    bucket: row.bucket,
    tier: row.tier,
    reason: row.reason,
    proposedRole: row.proposedRole,
    proposedRule: row.proposedRule,
    quality: quality?.quality || "未審核",
    totalScore: quality?.totalScore ?? null,
    objectiveScore: quality?.objectiveScore ?? null,
    qualitativeScore: quality?.qualitativeScore ?? null,
    risk: quality?.risk || row.reason,
    rule: quality?.rule || row.proposedRule,
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
  return { bucket: "缺資料", row: { ...merged, decision: "資料不足" } };
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
  const qualityMap = new Map((quality.rows || []).map((row) => [normalize(row.symbol), row]));
  const buckets = {
    "紙上交易候選": [],
    "正式觀察": [],
    "次級觀察": [],
    "工具股_題材股": [],
    "封鎖": [],
    "缺資料": [],
  };

  for (const row of shortlist.rows || []) {
    const result = classifyMarketRow(row, qualityMap);
    buckets[result.bucket].push(result.row);
  }

  const covered = (shortlist.rows || []).length;
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
    source: "market_91_shortlist_plus_quality_drafts",
    summary: Object.fromEntries(Object.entries(buckets).map(([key, rows]) => [key, rows.length])),
    buckets,
    note: "目前已收斂可用的 25 檔 Market 91 候選；完整 45 檔仍缺 20 檔批次資料。既有 V17 十檔已獨立進入紙上交易測試。",
  };
}
