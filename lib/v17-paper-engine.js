import { getAssetRegistry } from "./v17-asset-registry";
import { nowIso, readPaperStore, taipeiDateKey, writePaperStore } from "./v17-paper-store";

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
  return readPaperStore("market45", {
    total: 45,
    status: "pending_consolidation",
    buckets: { "正式觀察": [], "次級觀察": [], "工具股_題材股": [], "封鎖": [], "缺資料": [] },
  });
}
