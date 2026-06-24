import fs from "fs/promises";
import path from "path";

export const SYMBOLS = [
  "QQQon",
  "NVDAon",
  "TSMon",
  "AVGOon",
  "SPCXon",
  "GOOGLon",
  "AMDon",
  "MRVLon",
  "RKLBon"
];

export const TIERS = ["N", "D1", "D2", "D3", "D4"];
export const DIP_TIERS = ["D1", "D2", "D3", "D4"];

export const LEDGER_PATH = path.join(process.cwd(), "data", "buy-ledger.json");
export const ALERTS_PATH = path.join(process.cwd(), "data", "alerts.json");

export function createEmptyLedger() {
  return SYMBOLS.reduce((ledger, symbol) => {
    ledger[symbol] = { N: [], D1: [], D2: [], D3: [], D4: [] };
    return ledger;
  }, {});
}

export async function ensureDataDir() {
  await fs.mkdir(path.join(process.cwd(), "data"), { recursive: true });
}

export async function readJsonFile(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export async function writeJsonFile(filePath, value) {
  await ensureDataDir();
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function readLedger() {
  const base = createEmptyLedger();
  const saved = await readJsonFile(LEDGER_PATH, {});

  for (const symbol of SYMBOLS) {
    base[symbol] = {
      ...base[symbol],
      ...(saved?.[symbol] || {})
    };

    for (const tier of TIERS) {
      if (!Array.isArray(base[symbol][tier])) base[symbol][tier] = [];
    }
  }

  return base;
}

export async function writeLedger(ledger) {
  await writeJsonFile(LEDGER_PATH, ledger);
}

export function normalizeTier(tier) {
  const value = String(tier || "").trim().toUpperCase();
  if (!TIERS.includes(value)) throw new Error(`invalid_tier:${tier}`);
  return value;
}

export function normalizeSymbol(symbol) {
  const raw = String(symbol || "").trim();
  const matched = SYMBOLS.find((s) => s.toUpperCase() === raw.toUpperCase());
  if (!matched) throw new Error(`invalid_symbol:${symbol}`);
  return matched;
}

export function hoursBetween(a, b) {
  const left = new Date(a).getTime();
  const right = new Date(b).getTime();
  if (!Number.isFinite(left) || !Number.isFinite(right)) return Infinity;
  return Math.abs(right - left) / 36e5;
}

export function getLastBuy(ledger, symbol, tier) {
  const rows = ledger?.[symbol]?.[tier] || [];
  return rows.length ? rows[rows.length - 1] : null;
}

export function hasBoughtTier(ledger, symbol, tier) {
  return !!getLastBuy(ledger, symbol, tier);
}

export function getCompletedDipLevel(ledger, symbol) {
  for (let i = DIP_TIERS.length - 1; i >= 0; i--) {
    if (hasBoughtTier(ledger, symbol, DIP_TIERS[i])) return i + 1;
  }
  return 0;
}

export function isOutsideTierZone(discount, rules, tier) {
  if (tier === "N") return true;
  const level = Number(String(tier).replace("D", ""));
  const threshold = Number(rules?.[level - 1]);
  const current = Number(discount);
  if (!Number.isFinite(threshold) || !Number.isFinite(current)) return false;
  return current > threshold;
}

export function canReopenTier({ ledger, symbol, tier, discount, rules, now = new Date().toISOString() }) {
  const lastBuy = getLastBuy(ledger, symbol, tier);
  if (!lastBuy) return true;

  const leftZone = lastBuy.leftBuyZone === true;
  const over24h = hoursBetween(lastBuy.time, now) > 24;
  return leftZone && over24h;
}

export function markLeftBuyZonesForAsset(ledger, asset) {
  const symbol = normalizeSymbol(asset.symbol);
  const rules = asset.rules || [];
  const discount = asset.discount;
  let changed = false;

  for (const tier of DIP_TIERS) {
    const lastBuy = getLastBuy(ledger, symbol, tier);
    if (!lastBuy || lastBuy.leftBuyZone === true) continue;

    if (isOutsideTierZone(discount, rules, tier)) {
      lastBuy.leftBuyZone = true;
      lastBuy.leftBuyZoneAt = new Date().toISOString();
      changed = true;
    }
  }

  return changed;
}

export async function markLeftBuyZonesForAssets(assets = []) {
  const ledger = await readLedger();
  let changed = false;

  for (const asset of assets) {
    try {
      if (markLeftBuyZonesForAsset(ledger, asset)) changed = true;
    } catch {
      // Ignore unknown symbols in price payload.
    }
  }

  if (changed) await writeLedger(ledger);
  return { ledger, changed };
}

export function getTriggeredDipTiers(discount, rules) {
  const current = Number(discount);
  if (!Number.isFinite(current)) return [];

  return (rules || [])
    .map((rule, index) => ({ tier: `D${index + 1}`, rule: Number(rule), level: index + 1 }))
    .filter((item) => Number.isFinite(item.rule) && current <= item.rule);
}

export function getExecutableTiers({ ledger, symbol, discount, rules, now = new Date().toISOString() }) {
  return getTriggeredDipTiers(discount, rules).filter(({ tier }) =>
    canReopenTier({ ledger, symbol, tier, discount, rules, now })
  );
}

export function buildManualBuy({ symbol, tier, amount, price = null, note = "manual", time = new Date().toISOString() }) {
  return {
    time,
    amount: Number(amount),
    price: price === null || price === undefined || price === "" ? null : Number(price),
    mode: tier === "N" ? "dca_manual" : "dip_manual",
    note,
    leftBuyZone: false,
    leftBuyZoneAt: null
  };
}

export async function appendBuy({ symbol, tier, amount, price, note, time }) {
  const normalizedSymbol = normalizeSymbol(symbol);
  const normalizedTier = normalizeTier(tier);
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error("invalid_amount");
  }

  const ledger = await readLedger();
  const row = buildManualBuy({ symbol: normalizedSymbol, tier: normalizedTier, amount: numericAmount, price, note, time });
  ledger[normalizedSymbol][normalizedTier].push(row);
  await writeLedger(ledger);

  return { symbol: normalizedSymbol, tier: normalizedTier, row, ledger: ledger[normalizedSymbol] };
}

export function getNextProgress(asset) {
  const currentDepth = Math.abs(Number(asset?.discount));
  const rules = asset?.rules || [];
  const amounts = asset?.amounts || [];
  const ruleDepths = rules.map((r) => Math.abs(Number(r))).filter(Number.isFinite);
  const signalLevel = Number(asset?.signal?.level || 0);

  if (!Number.isFinite(currentDepth) || !ruleDepths.length) {
    return { stageText: "資料未就緒", fromText: "0U", toText: "0U", progress: 0 };
  }

  if (signalLevel <= 0) {
    const targetDepth = ruleDepths[0];
    return {
      stageText: "尚未到買點 → 第一層",
      fromText: "0U",
      toText: `${amounts[0] || 0}U`,
      progress: Math.min(99, Math.max(0, (currentDepth / targetDepth) * 100))
    };
  }

  if (signalLevel >= ruleDepths.length) {
    return {
      stageText: `D${signalLevel} → 最深層`,
      fromText: `${amounts[signalLevel - 1] || 0}U`,
      toText: "最深層",
      progress: 99
    };
  }

  const startDepth = ruleDepths[signalLevel - 1];
  const targetDepth = ruleDepths[signalLevel];
  const progress = ((currentDepth - startDepth) / Math.max(0.000001, targetDepth - startDepth)) * 100;

  return {
    stageText: `D${signalLevel} → D${signalLevel + 1}`,
    fromText: `${amounts[signalLevel - 1] || 0}U`,
    toText: `${amounts[signalLevel] || 0}U`,
    progress: Math.min(99, Math.max(0, progress))
  };
}

export async function readAlerts() {
  return readJsonFile(ALERTS_PATH, {});
}

export async function writeAlerts(alerts) {
  await writeJsonFile(ALERTS_PATH, alerts);
}

export function canSendAlert(alerts, key, now = new Date().toISOString(), cooldownHours = 12) {
  const lastAlert = alerts?.[key]?.lastAlert;
  if (!lastAlert) return true;
  return hoursBetween(lastAlert, now) >= cooldownHours;
}

export async function markAlertSent(key, now = new Date().toISOString()) {
  const alerts = await readAlerts();
  alerts[key] = { lastAlert: now };
  await writeAlerts(alerts);
  return alerts[key];
}
