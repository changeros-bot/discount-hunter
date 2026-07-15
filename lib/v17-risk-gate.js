import { readLedger } from "./v16-ledger";
import { ASSET_STATUS, getAssetRegistry } from "./v17-asset-registry";
import { readAutoMode } from "./v17-auto-mode";
import { readExecutionLog } from "./v17-execution-log";
import { readV17AutoStore, taipeiDateKey } from "./v17-auto-store";

export const RISK_LIMITS = {
  maxSingleOrderUSDT: 5,
  maxDailyOrders: 1,
  maxDailyUSDT: 5,
  maxWeeklyOrders: 3,
  maxWeeklyUSDT: 15,
  cooldownHoursPerSymbol: 24,
};

const AUTO_ASSETS = getAssetRegistry().filter(
  (asset) => asset.status === ASSET_STATUS.QUALIFIED && asset.automation?.draftEligible === true
);

export const AUTO_TRADE_WHITELIST = AUTO_ASSETS.map((asset) => asset.symbol);

const SYMBOL_ALIASES = Object.fromEntries(AUTO_TRADE_WHITELIST.map((s) => [looseKey(s), s]));

function automationAssetFor(symbol) {
  const target = looseKey(symbol);
  return AUTO_ASSETS.find((asset) => looseKey(asset.symbol) === target) || null;
}

function looseKey(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function normalizeAutoSymbol(symbol) {
  const matched = SYMBOL_ALIASES[looseKey(symbol)];
  if (!matched) throw new Error(`symbol_not_whitelisted:${symbol}`);
  return matched;
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseTier(value) {
  const tier = String(value || "").trim().toUpperCase();
  if (/^D[1-5]$/.test(tier)) return tier;
  return null;
}

function newestDecisionCandidate(decisions = []) {
  const candidates = (decisions || [])
    .map((row) => {
      const symbol = row.symbol;
      const tier = parseTier(row?.decision?.tier || row?.tier || row?.signalLevel);
      const amountUSDT = Math.min(RISK_LIMITS.maxSingleOrderUSDT, toNumber(row?.decision?.amount || row?.amount || 5, 5));
      const drawdown = toNumber(row?.discount ?? row?.drawdown ?? row?.decision?.drawdown, null);
      const price = toNumber(row?.price, null);
      return { row, symbol, tier, amountUSDT, drawdown, price, serverVerified: row?.serverVerified === true };
    })
    .filter((item) => item.symbol && item.tier && item.amountUSDT > 0);
  return candidates[0] || null;
}

function startOfWeekKey(date = new Date()) {
  const d = new Date(date);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - day + 1);
  return taipeiDateKey(d);
}

function hoursBetween(a, b) {
  const left = new Date(a).getTime();
  const right = new Date(b).getTime();
  if (!Number.isFinite(left) || !Number.isFinite(right)) return Infinity;
  return Math.abs(right - left) / 36e5;
}

function logAmount(log) {
  return toNumber(log?.amountUSDT || log?.amount || 0, 0);
}

function countExecutions(logs = [], predicate = () => true) {
  const eligible = (logs || []).filter((log) => ["SIMULATED", "EXECUTED"].includes(String(log.status || "")) && predicate(log));
  return {
    orders: eligible.length,
    usdt: eligible.reduce((sum, log) => sum + logAmount(log), 0),
  };
}

function ledgerHasTier(ledger, symbol, tier) {
  const rows = ledger?.[symbol]?.[tier] || [];
  return Array.isArray(rows) && rows.length > 0;
}

function latestSymbolDraftOrExecution({ drafts, logs, symbol }) {
  const all = [
    ...(drafts || []).filter((draft) => looseKey(draft.symbol) === looseKey(symbol)).map((draft) => draft.createdAt || draft.updatedAt),
    ...(logs || []).filter((log) => looseKey(log.symbol) === looseKey(symbol)).map((log) => log.createdAt || log.updatedAt),
  ].filter(Boolean).sort();
  return all.length ? all[all.length - 1] : null;
}

function check(name, passed, detail) {
  return { name, status: passed ? "PASS" : "FAIL", detail };
}

async function readDraftsDirectly() {
  const drafts = await readV17AutoStore({ name: "drafts", fallback: [] });
  return Array.isArray(drafts) ? drafts : [];
}

export async function evaluateTradeReadiness({ decisions = [], candidate = null } = {}) {
  const [autoMode, ledger, drafts, logs] = await Promise.all([
    readAutoMode(),
    readLedger().catch(() => ({})),
    readDraftsDirectly().catch(() => []),
    readExecutionLog().catch(() => []),
  ]);

  const picked = candidate || newestDecisionCandidate(decisions);
  if (!picked) {
    return {
      status: "WAIT",
      mode: autoMode.mode,
      summary: "No active D1-D5 trigger today.",
      candidate: null,
      checks: [],
      blockedReasons: [],
      riskLimits: RISK_LIMITS,
    };
  }

  const checks = [];
  const blockedReasons = [];

  const serverVerified = picked.serverVerified === true;
  checks.push(check("server_verified_candidate", serverVerified, serverVerified ? "Candidate was rebuilt from canonical server data." : "Client supplied candidates are not trusted."));
  if (!serverVerified) blockedReasons.push("candidate_not_server_verified");

  let normalizedSymbol = null;
  try { normalizedSymbol = normalizeAutoSymbol(picked.symbol); } catch {}
  checks.push(check("symbol_whitelisted", Boolean(normalizedSymbol), `${picked.symbol} registry automation policy check.`));
  if (!normalizedSymbol) blockedReasons.push("symbol_not_whitelisted");

  const automationAsset = normalizedSymbol ? automationAssetFor(normalizedSymbol) : null;
  const route = automationAsset?.automation?.route || "blocked";
  const routeOk = route === "binance_spot" || route === "manual_web3_only";
  checks.push(check("execution_route_defined", routeOk, `route=${route}`));
  if (!routeOk) blockedReasons.push("execution_route_blocked");

  const tier = parseTier(picked.tier);
  checks.push(check("valid_tier", Boolean(tier), `${picked.tier || "none"} tier check.`));
  if (!tier) blockedReasons.push("invalid_tier");

  const amountUSDT = Math.min(RISK_LIMITS.maxSingleOrderUSDT, toNumber(picked.amountUSDT, RISK_LIMITS.maxSingleOrderUSDT));
  const singleOk = amountUSDT > 0 && amountUSDT <= RISK_LIMITS.maxSingleOrderUSDT;
  checks.push(check("single_order_limit", singleOk, `${amountUSDT}/${RISK_LIMITS.maxSingleOrderUSDT} USDT.`));
  if (!singleOk) blockedReasons.push("single_order_limit_exceeded");

  const todayKey = taipeiDateKey();
  const weekKey = startOfWeekKey();
  const todayStats = countExecutions(logs, (log) => taipeiDateKey(new Date(log.createdAt || Date.now())) === todayKey);
  const weekStats = countExecutions(logs, (log) => taipeiDateKey(new Date(log.createdAt || Date.now())) >= weekKey);

  checks.push(check("daily_limit", todayStats.orders < RISK_LIMITS.maxDailyOrders && todayStats.usdt + amountUSDT <= RISK_LIMITS.maxDailyUSDT, `${todayStats.orders}/${RISK_LIMITS.maxDailyOrders} orders, ${todayStats.usdt}/${RISK_LIMITS.maxDailyUSDT} USDT.`));
  if (!(todayStats.orders < RISK_LIMITS.maxDailyOrders && todayStats.usdt + amountUSDT <= RISK_LIMITS.maxDailyUSDT)) blockedReasons.push("daily_limit_reached");

  checks.push(check("weekly_limit", weekStats.orders < RISK_LIMITS.maxWeeklyOrders && weekStats.usdt + amountUSDT <= RISK_LIMITS.maxWeeklyUSDT, `${weekStats.orders}/${RISK_LIMITS.maxWeeklyOrders} orders, ${weekStats.usdt}/${RISK_LIMITS.maxWeeklyUSDT} USDT.`));
  if (!(weekStats.orders < RISK_LIMITS.maxWeeklyOrders && weekStats.usdt + amountUSDT <= RISK_LIMITS.maxWeeklyUSDT)) blockedReasons.push("weekly_limit_reached");

  const tierDone = normalizedSymbol && tier ? ledgerHasTier(ledger, normalizedSymbol, tier) : false;
  checks.push(check("tier_not_completed", !tierDone, `${normalizedSymbol || picked.symbol} ${tier || picked.tier} ledger check.`));
  if (tierDone) blockedReasons.push("tier_already_completed");

  const latest = normalizedSymbol ? latestSymbolDraftOrExecution({ drafts, logs, symbol: normalizedSymbol }) : null;
  const cooldownOk = !latest || hoursBetween(latest, new Date().toISOString()) >= RISK_LIMITS.cooldownHoursPerSymbol;
  checks.push(check("cooldown", cooldownOk, latest ? `last activity ${latest}` : "no recent symbol activity."));
  if (!cooldownOk) blockedReasons.push("cooldown_active");

  const priceOk = picked.price === null || picked.price === undefined || toNumber(picked.price, 0) > 0;
  checks.push(check("price_valid", priceOk, `price=${picked.price ?? "not_required_for_dry_run"}`));
  if (!priceOk) blockedReasons.push("price_invalid");

  const status = blockedReasons.length ? "BLOCKED" : "READY";
  return {
    status,
    mode: autoMode.mode,
    summary: status === "READY" ? `${normalizedSymbol} ${tier} triggered and risk checks passed.` : "Trade blocked by risk gate.",
    candidate: {
      symbol: normalizedSymbol || picked.symbol,
      tier,
      amountUSDT,
      drawdown: picked.drawdown,
      price: picked.price,
      source: "v17_decision_engine",
      serverVerified,
      executionRoute: route,
      requiresManualConfirmation: automationAsset?.automation?.requiresManualConfirmation !== false,
    },
    checks,
    blockedReasons,
    riskLimits: RISK_LIMITS,
  };
}
