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
  return [1, 2, 3, 4, 5]
    .filter((i) => Array.isArray(rows[`D${i}`]) && rows[`D${i}`].length > 0)
    .map((i) => `D${i}`);
}

export function isLiveHolding(holding) {
  const source = String(holding?.quantitySource || "");
  return holding && Number(holding.quantity) > 0 && ["bsc_rpc_balanceOf_live", "binance_manual_fallback", "binance_account_readonly"].includes(source);
}

export function buildWalletHoldingMap(holdings = []) {
  const map = new Map();
  for (const holding of holdings || []) {
    if (!isLiveHolding(holding)) continue;
    const full = normalizeSymbol(holding.symbol);
    const base = stripOnSuffix(holding.symbol);
    if (full) map.set(full, holding);
    if (base) map.set(base, holding);
  }
  return map;
}

export function stateKey(decision) {
  return `${normalizeSymbol(decision?.symbol)}_${String(decision?.tier || "").toUpperCase()}`;
}

export function buildStateMap(states = []) {
  const map = new Map();
  for (const state of states || []) {
    const key = stateKey(state);
    if (key && key !== "_") map.set(key, state);
  }
  return map;
}

export function walletHoldingFor(asset, walletMap = new Map()) {
  const symbol = normalizeSymbol(asset?.symbol);
  const base = stripOnSuffix(asset?.symbol);
  return walletMap.get(symbol) || walletMap.get(base) || null;
}

export function statusTierMap(states = [], status) {
  const map = new Map();
  for (const state of states || []) {
    if (state?.status !== status || !state?.tier) continue;
    const symbol = normalizeSymbol(state.symbol);
    if (!map.has(symbol)) map.set(symbol, []);
    map.get(symbol).push(state.tier);
  }
  return map;
}

export function hasHolding({ asset, ledger = {}, walletMap = new Map(), completeTiers = [] }) {
  return Boolean(walletHoldingFor(asset, walletMap)) || ledgerDoneTiers(ledger, asset?.symbol).length > 0 || completeTiers.length > 0;
}

export function resolveSection({ level, decision, holding }) {
  if (level === 0) return V17_SECTIONS.WATCH;
  if (level > 0 && decision) return V17_SECTIONS.DECISION;
  if (level > 0 && holding) return V17_SECTIONS.HOLDING;
  return null;
}

export function classifyAsset({ asset, ledger = {}, walletMap = new Map(), actionMap = new Map(), stateMap = new Map(), skippedMap = new Map(), completeMap = new Map() }) {
  const level = Number(asset?.signal?.level || 0);
  const tier = level > 0 ? `D${level}` : "D0";
  const symbol = normalizeSymbol(asset.symbol);
  const key = `${symbol}_${tier}`;
  const decision = level > 0 ? actionMap.get(key) || null : null;
  const state = level > 0 ? stateMap.get(key) || null : null;
  const walletHolding = walletHoldingFor(asset, walletMap);
  const skippedTiers = skippedMap.get(symbol) || [];
  const completeTiers = completeMap.get(symbol) || [];
  const doneTiers = Array.from(new Set([...ledgerDoneTiers(ledger, asset?.symbol), ...completeTiers]));
  const holding = hasHolding({ asset, ledger, walletMap, completeTiers: doneTiers }) || skippedTiers.includes(tier);
  const section = resolveSection({ level, decision, holding });

  return {
    ...asset,
    signalLevel: level,
    tier,
    decision,
    decisionState: state,
    walletHolding,
    isHolding: holding,
    isActionable: section === V17_SECTIONS.DECISION,
    section,
    sections: section ? [section] : [],
    ledgerDoneTiers: doneTiers,
    skippedTiers
  };
}

export function classifyUniverse({ assets = [], ledger = {}, holdings = [], decisions = [], states = [] }) {
  const walletMap = buildWalletHoldingMap(holdings);
  const actionMap = buildStateMap(decisions);
  const stateMap = buildStateMap(states);
  const skippedMap = statusTierMap(states, "skipped");
  const completeMap = statusTierMap(states, "complete");
  const rows = (assets || []).map((asset) => classifyAsset({ asset, ledger, walletMap, actionMap, stateMap, skippedMap, completeMap }));

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
      decision: "D1-D5 active uncompleted/unskipped tier has priority over Holding",
      holding: "D1-D5 and holding/ledger exists after decision is cleared"
    }
  };
}
