// DCA Discount Hunter - V17 verified cost source bridge
// Raw ledger is retained only for audit/reference.
// /v17 cost cards should use verified tx hash receipt sources, not screenshot-derived or raw-ledger-only costs.

const { getJson } = require("../state/kv");
const { applyVerifiedTxCostSources } = require("./verifiedTxCostSources");

const LEDGER_KEY = "discount-hunter:v16:buy-ledger";

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
function aggregateRawLedgerRows(rows = []) {
  // Keep raw ledger parsing available for audits, but do not pass raw-only rows into /v17 cost basis.
  // Only tx-hash-receipt verified rows are returned to sync-wallet.
  return applyVerifiedTxCostSources([]);
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
