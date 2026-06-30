export const V17_SECTIONS = Object.freeze({
  WATCH: "watch",
  HOLDING: "holding",
  DECISION: "decision"
});

export function normalizeSymbol(symbol) {
  return String(symbol || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function stripOnSuffix(symbol) {
  return normalizeSymbol(symbol).replace(/ON$/, "");
}

export function ledgerRows(ledger, symbol) {
  if (!ledger || !symbol) return {};
  if (ledger[symbol]) return ledger[symbol];
  const target = normalizeSymbol(symbol);
  const base = stripOnSuffix(symbol);
  const key = Object.keys(ledger).find((k) => normalizeSymbol(k) === target || stripOnSuffix(k) === base);
  return key ? ledger[key] : {};
}

export function ledgerDoneTiers(ledger, symbol) {
  const rows = ledgerRows(ledger, symbol);
  return [1, 2, 3, 4]
    .filter((i) => Array.isArray(rows[`D${i}`]) && rows[`D${i}`].length > 0)
    .map((i) => `D${i}`);
}

export function isLiveHolding(holding) {
  return holding && Number(holding.quantity) > 0 && holding.quantitySource === "bsc_rpc_balanceOf_live";
}

export function buildWalletSymbolSet(holdings = []) {
  const set = new Set();
  for (const holding of holdings || []) {
    if (!isLiveHolding(holding)) continue;
    const full = normalizeSymbol(holding.symbol);
    const base = stripOnSuffix(holding.symbol);
    if (full) set.add(full);
    if (base) set.add(base);
  }
  return set;
}

export function decisionKey(decision) {
  return `${normalizeSymbol(decision?.symbol)}_${String(decision?.tier || "").toUpperCase()}`;
}

export function buildDecisionMap(decisions = []) {
  const map = new Map();
  for (const decision of decisions || []) {
    const key = decisionKey(decision);
    if (key && key !== "_") map.set(key, decision);
  }
  return map;
}

export function hasHolding({ asset, ledger = {}, walletSymbols = new Set() }) {
  const symbol = normalizeSymbol(asset?.symbol);
  const base = stripOnSuffix(asset?.symbol);
  return walletSymbols.has(symbol) || walletSymbols.has(base) || ledgerDoneTiers(ledger, asset?.symbol).length > 0;
}

export function resolveSection({ level, decision, holding }) {
  if (level === 0) return V17_SECTIONS.WATCH;
  if (level > 0 && decision) return V17_SECTIONS.DECISION;
  if (level > 0 && holding) return V17_SECTIONS.HOLDING;
  return null;
}

export function classifyAsset({ asset, ledger = {}, walletSymbols = new Set(), decisionMap = new Map() }) {
  const level = Number(asset?.signal?.level || 0);
  const tier = level > 0 ? `D${level}` : "D0";
  const key = `${normalizeSymbol(asset.symbol)}_${tier}`;
  const decision = level > 0 ? decisionMap.get(key) || null : null;
  const holding = hasHolding({ asset, ledger, walletSymbols });
  const section = resolveSection({ level, decision, holding });

  return {
    ...asset,
    signalLevel: level,
    tier,
    decision,
    isHolding: holding,
    isActionable: section === V17_SECTIONS.DECISION,
    section,
    sections: section ? [section] : [],
    ledgerDoneTiers: ledgerDoneTiers(ledger, asset?.symbol)
  };
}

export function classifyUniverse({ assets = [], ledger = {}, holdings = [], decisions = [] }) {
  const walletSymbols = buildWalletSymbolSet(holdings);
  const decisionMap = buildDecisionMap(decisions);
  const rows = (assets || []).map((asset) => classifyAsset({ asset, ledger, walletSymbols, decisionMap }));

  const watchRows = rows.filter((row) => row.section === V17_SECTIONS.WATCH);
  const holdingRows = rows.filter((row) => row.section === V17_SECTIONS.HOLDING);
  const decisionRows = rows.filter((row) => row.section === V17_SECTIONS.DECISION);
  const invisibleRows = rows.filter((row) => !row.section);

  const universeSymbols = new Set(rows.map((row) => normalizeSymbol(row.symbol)));
  const visibleSymbols = new Set([...watchRows, ...holdingRows, ...decisionRows].map((row) => normalizeSymbol(row.symbol)));
  const duplicateSymbols = rows
    .filter((row) => row.sections.length > 1)
    .map((row) => normalizeSymbol(row.symbol));
  const extraSymbols = [...visibleSymbols].filter((symbol) => !universeSymbols.has(symbol));
  const missingSymbols = [...universeSymbols].filter((symbol) => !visibleSymbols.has(symbol));

  return {
    ok: missingSymbols.length === 0 && extraSymbols.length === 0 && duplicateSymbols.length === 0,
    rows,
    watchRows,
    holdingRows,
    decisionRows,
    invisibleRows,
    summary: {
      universeCount: rows.length,
      watchCount: watchRows.length,
      holdingCount: holdingRows.length,
      decisionCount: decisionRows.length,
      visibleUniqueCount: visibleSymbols.size,
      missingSymbols,
      extraSymbols,
      duplicateSymbols
    },
    rules: {
      exclusive: "Each symbol may render in exactly one UI section",
      watch: "D0 only",
      decision: "D1-D4 active uncompleted/unskipped tier has priority over Holding",
      holding: "D1-D4 and holding/ledger exists after decision is cleared"
    }
  };
}
