import { readLedger } from "../../../lib/v16-ledger";

function upper(value) { return String(value || "").trim().toUpperCase(); }
function safeNumber(value) { const n = Number(value || 0); return Number.isFinite(n) ? n : 0; }
function normalizeSymbol(symbol) {
  const s = String(symbol || "").trim();
  const key = upper(s).replace(/[^A-Z0-9]/g, "");
  if (!key) return "";
  return key.endsWith("ON") ? `${key.slice(0, -2)}on` : `${key}on`;
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
function collectRows(rawLedger = {}) {
  const rows = [];
  for (const [rawSymbol, tiers] of Object.entries(rawLedger || {})) {
    const symbol = normalizeSymbol(rawSymbol);
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
function aggregate(rows = []) {
  const map = new Map();
  for (const row of rows || []) {
    const current = map.get(row.symbol) || {
      symbol: row.symbol,
      totalCost: 0,
      rawLedgerQuantity: 0,
      buyCount: 0,
      tiers: [],
      rows: [],
      sources: [],
    };
    current.totalCost += safeNumber(row.amount);
    current.rawLedgerQuantity += safeNumber(row.quantity);
    current.buyCount += 1;
    if (row.tier && !current.tiers.includes(row.tier)) current.tiers.push(row.tier);
    if (row.source && !current.sources.includes(row.source)) current.sources.push(row.source);
    current.rows.push(row);
    map.set(row.symbol, current);
  }
  return [...map.values()].map((item) => ({
    ...item,
    averageCost: item.rawLedgerQuantity > 0 ? item.totalCost / item.rawLedgerQuantity : 0,
    costBasisSource: "raw_buy_ledger_wallet_reconcile_or_manual",
    costBasisWarning: "This is recovered from raw buy-ledger rows. It is not chain transfer-history cost, but it is existing app ledger data, not a newly invented fallback.",
  })).sort((a, b) => a.symbol.localeCompare(b.symbol));
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  try {
    const rawLedger = await readLedger();
    const rows = collectRows(rawLedger);
    const holdings = aggregate(rows);
    const totalRawLedgerCost = holdings.reduce((sum, h) => sum + safeNumber(h.totalCost), 0);
    return res.status(200).json({
      ok: true,
      checkedAt: new Date().toISOString(),
      status: holdings.length > 0 ? "RAW_LEDGER_AVAILABLE" : "NO_RAW_LEDGER_COST_ROWS",
      rule: "read-only audit; not connected to /v17 and not used as chain transfer-history cost",
      rowCount: rows.length,
      symbolCount: holdings.length,
      totalRawLedgerCost,
      holdings,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "raw_ledger_cost_audit_failed" });
  }
}
