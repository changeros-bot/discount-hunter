import fs from "fs/promises";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { hasKvConfig, getJson, setJson } = require("./state/kv");

const memoryStore = globalThis.__V16_MEMORY_STORE__ || { ledger: null, alerts: null };
globalThis.__V16_MEMORY_STORE__ = memoryStore;

export const SYMBOLS = ["QQQon", "NVDAon", "TSMon", "AVGOon", "SPCXon", "GOOGLon", "AMDon", "MRVLon", "RKLBon"];
export const TIERS = ["N", "D1", "D2", "D3", "D4"];
export const DIP_TIERS = ["D1", "D2", "D3", "D4"];
export const LEDGER_KEY = "discount-hunter:v16:buy-ledger";
export const ALERTS_KEY = "discount-hunter:v16:telegram-alerts";
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
  try { return JSON.parse(await fs.readFile(filePath, "utf8")); } catch { return fallback; }
}

export async function writeJsonFile(filePath, value) {
  await ensureDataDir();
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function normalizeLedger(saved = {}) {
  const base = createEmptyLedger();
  for (const symbol of SYMBOLS) {
    base[symbol] = { ...base[symbol], ...(saved?.[symbol] || {}) };
    for (const tier of TIERS) if (!Array.isArray(base[symbol][tier])) base[symbol][tier] = [];
  }
  return base;
}

function memoryKeyFromPath(filePath) { return filePath === ALERTS_PATH ? "alerts" : "ledger"; }
function shouldUseFileFallback() { return process.env.NODE_ENV !== "production" && !process.env.VERCEL; }

export async function readStoreJson({ key, filePath, fallback }) {
  if (hasKvConfig()) {
    const response = await getJson(key);
    if (response?.result) return response.result;
  }
  const memoryKey = memoryKeyFromPath(filePath);
  if (memoryStore[memoryKey]) return memoryStore[memoryKey];
  if (shouldUseFileFallback()) return readJsonFile(filePath, fallback);
  return fallback;
}

export async function writeStoreJson({ key, filePath, value }) {
  if (hasKvConfig()) {
    await setJson(key, value);
    return { store: "upstash_kv" };
  }
  const memoryKey = memoryKeyFromPath(filePath);
  memoryStore[memoryKey] = value;
  if (shouldUseFileFallback()) {
    try { await writeJsonFile(filePath, value); return { store: "file_fallback" }; }
    catch { return { store: "memory_fallback" }; }
  }
  return { store: "memory_fallback" };
}

export async function readLedger() {
  return normalizeLedger(await readStoreJson({ key: LEDGER_KEY, filePath: LEDGER_PATH, fallback: {} }));
}

export async function writeLedger(ledger) {
  return writeStoreJson({ key: LEDGER_KEY, filePath: LEDGER_PATH, value: normalizeLedger(ledger) });
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

export function hasBoughtTier(ledger, symbol, tier) { return !!getLastBuy(ledger, symbol, tier); }

export function getCompletedDipLevel(ledger, symbol) {
  for (let i = DIP_TIERS.length - 1; i >= 0; i--) if (hasBoughtTier(ledger, symbol, DIP_TIERS[i])) return i + 1;
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

export function canReopenTier({ ledger, symbol, tier, now = new Date().toISOString() }) {
  const lastBuy = getLastBuy(ledger, symbol, tier);
  if (!lastBuy) return true;
  return lastBuy.leftBuyZone === true && Boolean(lastBuy.leftBuyZoneAt) && hoursBetween(lastBuy.leftBuyZoneAt, now) > 24;
}

export function markLeftBuyZonesForAsset(ledger, asset) {
  const symbol = normalizeSymbol(asset.symbol);
  let changed = false;
  for (const tier of DIP_TIERS) {
    const lastBuy = getLastBuy(ledger, symbol, tier);
    if (!lastBuy || lastBuy.leftBuyZone === true) continue;
    if (isOutsideTierZone(asset.discount, asset.rules || [], tier)) {
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
    try { if (markLeftBuyZonesForAsset(ledger, asset)) changed = true; } catch {}
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
  return getTriggeredDipTiers(discount, rules).filter(({ tier }) => canReopenTier({ ledger, symbol, tier, now }));
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
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) throw new Error("invalid_amount");
  const ledger = await readLedger();
  const row = buildManualBuy({ symbol: normalizedSymbol, tier: normalizedTier, amount: numericAmount, price, note, time });
  ledger[normalizedSymbol][normalizedTier].push(row);
  const writeResult = await writeLedger(ledger);
  return { symbol: normalizedSymbol, tier: normalizedTier, row, ledger: ledger[normalizedSymbol], storage: writeResult.store };
}

export function getNextProgress(asset) {
  const currentDepth = Math.abs(Number(asset?.discount));
  const rules = asset?.rules || [];
  const amounts = asset?.amounts || [];
  const ruleDepths = rules.map((r) => Math.abs(Number(r))).filter(Number.isFinite);
  const signalLevel = Number(asset?.signal?.level || 0);
  if (!Number.isFinite(currentDepth) || !ruleDepths.length) return { stageText: "資料未就緒", fromText: "0U", toText: "0U", progress: 0, displayProgress: 0, triggered: false };
  if (signalLevel <= 0) {
    const targetDepth = ruleDepths[0];
    const progress = targetDepth > 0 ? Math.min(99, Math.max(0, (currentDepth / targetDepth) * 100)) : 0;
    return { stageText: "距離 D1 買點", fromText: "0U", toText: `${amounts[0] || 0}U`, progress, displayProgress: Math.floor(progress), triggered: false };
  }
  return { stageText: `D${signalLevel} 已觸發`, fromText: `${amounts[signalLevel - 1] || 0}U`, toText: "可買入", progress: 100, displayProgress: 100, triggered: true };
}

export async function readAlerts() { return readStoreJson({ key: ALERTS_KEY, filePath: ALERTS_PATH, fallback: {} }); }
export async function writeAlerts(alerts) { return writeStoreJson({ key: ALERTS_KEY, filePath: ALERTS_PATH, value: alerts || {} }); }
export function canSendAlert(alerts, key, now = new Date().toISOString(), cooldownHours = 12) {
  const lastAlert = alerts?.[key]?.lastAlert;
  if (!lastAlert) return true;
  return hoursBetween(lastAlert, now) >= cooldownHours;
}
export async function markAlertSent(key, now = new Date().toISOString()) {
  const alerts = await readAlerts();
  alerts[key] = { lastAlert: now };
  const writeResult = await writeAlerts(alerts);
  return { ...alerts[key], storage: writeResult.store };
}
