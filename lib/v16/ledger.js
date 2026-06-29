const { normalizeSymbol, stripOnSuffix } = require("./symbol");

function ledgerRows(ledger, symbol) {
  if (!ledger || !symbol) return {};
  if (ledger[symbol]) return ledger[symbol];
  const target = normalizeSymbol(symbol);
  const key = Object.keys(ledger).find((item) => normalizeSymbol(item) === target || stripOnSuffix(item) === stripOnSuffix(symbol));
  return key ? ledger[key] : {};
}

function doneTiers(ledger, symbol) {
  const rows = ledgerRows(ledger, symbol);
  return [1, 2, 3, 4]
    .filter((level) => Array.isArray(rows[`D${level}`]) && rows[`D${level}`].length > 0)
    .map((level) => `D${level}`);
}

function hasTier(ledger, symbol, tier) {
  if (!tier) return false;
  const rows = ledgerRows(ledger, symbol);
  return Array.isArray(rows[tier]) && rows[tier].length > 0;
}

function displayText(ledger, symbol) {
  const done = doneTiers(ledger, symbol);
  if (!done.length) return "尚未登帳";

  const deepest = Math.max(
    ...done
      .map((tier) => Number(String(tier).replace("D", "")))
      .filter(Number.isFinite)
  );

  const next = deepest < 4 ? `｜D${deepest + 1} 尚未登帳` : "";
  return `已登帳：${done.join(" / ")}${next}`;
}

module.exports = {
  ledgerRows,
  doneTiers,
  hasTier,
  displayText,
};
