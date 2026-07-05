// DCA Discount Hunter - recovered cost from existing raw buy-ledger rows
// This is not chain transfer-history cost. It is existing app ledger / wallet_reconcile data.
// Some rows may be corrected by user-provided Binance position screenshots when raw ledger undercounts cost.

const { getJson } = require("../state/kv");

const LEDGER_KEY = "discount-hunter:v16:buy-ledger";
const SCREENSHOT_VERIFIED_COST_OVERRIDES = {
  NVDAON: { totalCost: 10, source: "binance_position_screenshot_verified_2026_07_05", note: "Two Binance position buys shown in user screenshot; raw ledger had only 5U." },
  MRVLON: { totalCost: 10, source: "binance_position_screenshot_verified_2026_07_05", note: "Two Binance position buys shown in user screenshot; raw ledger had only 5U." },
  SPCXON: { totalCost: 10, source: "binance_position_screenshot_verified_2026_07_05", note: "Two Binance position buys shown in user screenshot; raw ledger had only 5U." },
};

function upper(value) { return String(value || "").trim().toUpperCase(); }
function safeNumber(value) { const n = Number(value || 0); return Number.isFinite(n) ? n : 0; }
function normalizeOnSymbol(symbol) {
  const key = upper(symbol).replace(/[^A-Z0-9]/g, "");
  if (!key) return "";
  return key.endsWith("ON") ? key : `${key}ON`;
}
function includeRow(row) {
  const mode = String(row?.mode || "").toLowerCase();
  const note = String(row?.note || "").toLowerCase();
  const amount = safeNumber(row?.amount);
  if (!(amount > 0)) return false;
  return mode === "wallet_reconcile" || mode === "dip_manual" || mode === "dca_manual" || note.includes("wallet_reconcile") || note.includes("manual");
}
function rowSource(row) {
  const mode = String(row?.mode || "").toLowerCase();
  if (mode === "wallet_reconcile") return "raw_buy_ledger_wallet_reconcile";
  if (mode === "dip_manual" || mode === "dca_manual") return "raw_buy_ledger_explicit_manual";
  return "raw_buy_ledger_included_row";
}
function collectRawLedgerRows(rawLedger = {}) {
  const rows = [];
  for (const [rawSymbol, tiers] of Object.entries(rawLedger || {})) {
    const symbol = normalizeOnSymbol(rawSymbol);
    if (!symbol) continue;
    for (const [tier, tierRows] of Object.entries(tiers || {})) {
      if (!Array.isArray(tierRows)) continue;
      for (const row of tierRows) {
        if (!includeRow(row)) continue;
        rows.push({
          symbol,
          tier,
          time: row.time || null,
          amount: safeNumber(row.amount),
          price: row.price === null || row.price === undefined ? null : safeNumber(row.price),
          quantity: safeNumber(row.quantity),
          mode: row.mode || null,
          note: row.note || null,
          quantitySource: row.quantitySource || null,
          sourceVerified: Boolean(row.sourceVerified),
          source: rowSource(row),
        });
      }
    }
  }
  return rows;
}
function applyScreenshotVerifiedOverrides(items) {
  return (items || []).map((item) => {
    const symbol = normalizeOnSymbol(item.symbol);
    const override = SCREENSHOT_VERIFIED_COST_OVERRIDES[symbol];
    if (!override || !(safeNumber(override.totalCost) > safeNumber(item.totalCost))) return item;
    const corrected = safeNumber(override.totalCost);
    return {
      ...item,
      totalCost: corrected,
      averageCost: safeNumber(item.quantity) > 0 ? corrected / safeNumber(item.quantity) : item.averageCost,
      recoveredSources: [...new Set([...(item.recoveredSources || []), override.source])],
      recoveredRows: [
        ...(item.recoveredRows || []),
        { symbol, tier: "SCREENSHOT", amount: corrected - safeNumber(item.totalCost), price: null, quantity: 0, source: override.source, note: override.note, sourceVerified: true }
      ],
      screenshotVerifiedOverride: override,
      recoveredCostWarning: "Recovered from raw buy-ledger rows plus user-provided Binance position screenshot; not chain transfer-history cost.",
    };
  });
}
function aggregateRawLedgerRows(rows = []) {
  const map = new Map();
  for (const row of rows || []) {
    const current = map.get(row.symbol) || {
      symbol: row.symbol,
      quantity: 0,
      totalCost: 0,
      buyCount: 0,
      sellCount: 0,
      tiers: [],
      recoveredRows: [],
      recoveredSources: [],
      costBasisSource: "raw_buy_ledger_recovered",
      costBasisRecoveredOnly: true,
      costBasisEstimated: false,
      recoveredCostWarning: "Recovered from existing raw buy-ledger rows; not chain transfer-history cost.",
    };
    current.totalCost += safeNumber(row.amount);
    current.quantity += safeNumber(row.quantity);
    current.buyCount += 1;
    if (row.tier && !current.tiers.includes(row.tier)) current.tiers.push(row.tier);
    if (row.source && !current.recoveredSources.includes(row.source)) current.recoveredSources.push(row.source);
    current.recoveredRows.push(row);
    map.set(row.symbol, current);
  }
  const items = [...map.values()].map((item) => ({
    ...item,
    averageCost: item.quantity > 0 ? item.totalCost / item.quantity : 0,
    firstBuyTimestamp: item.recoveredRows.map((r) => r.time).filter(Boolean).sort()[0] || null,
    lastBuyTimestamp: item.recoveredRows.map((r) => r.time).filter(Boolean).sort().slice(-1)[0] || null,
  })).sort((a, b) => a.symbol.localeCompare(b.symbol));
  return applyScreenshotVerifiedOverrides(items);
}
async function readRawLedgerRecoveredCostHoldings() {
  const response = await getJson(LEDGER_KEY);
  const rawLedger = response?.result || {};
  const rows = collectRawLedgerRows(rawLedger);
  const holdings = aggregateRawLedgerRows(rows);
  return {
    key: LEDGER_KEY,
    rowCount: rows.length,
    symbolCount: holdings.length,
    totalRecoveredCost: holdings.reduce((sum, h) => sum + safeNumber(h.totalCost), 0),
    holdings,
  };
}
function mergeChainAndRecoveredCostHoldings(chainHoldings = [], recoveredHoldings = []) {
  const map = new Map();
  for (const holding of recoveredHoldings || []) {
    const symbol = normalizeOnSymbol(holding.symbol);
    if (!symbol || !(safeNumber(holding.totalCost) > 0)) continue;
    map.set(symbol, holding);
  }
  for (const holding of chainHoldings || []) {
    const symbol = normalizeOnSymbol(holding.symbol);
    if (!symbol || !(safeNumber(holding.totalCost) > 0)) continue;
    map.set(symbol, { ...holding, costBasisSource: holding.costBasisSource || "transfer_history", costBasisRecoveredOnly: false });
  }
  return [...map.values()];
}

module.exports = {
  readRawLedgerRecoveredCostHoldings,
  mergeChainAndRecoveredCostHoldings,
  collectRawLedgerRows,
  aggregateRawLedgerRows,
};
