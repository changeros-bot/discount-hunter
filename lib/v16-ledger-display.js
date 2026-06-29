function normalizeSymbol(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function stripOnSuffix(symbol) {
  return normalizeSymbol(symbol).replace(/ON$/, "");
}

function ledgerRows(ledger, symbol) {
  if (!ledger || !symbol) return {};
  if (ledger[symbol]) return ledger[symbol];
  const target = normalizeSymbol(symbol);
  const key = Object.keys(ledger).find((item) => normalizeSymbol(item) === target || stripOnSuffix(item) === stripOnSuffix(symbol));
  return key ? ledger[key] : {};
}

function ledgerDoneTiers(ledger, symbol) {
  const rows = ledgerRows(ledger, symbol);
  return [1, 2, 3, 4]
    .filter((level) => Array.isArray(rows[`D${level}`]) && rows[`D${level}`].length > 0)
    .map((level) => `D${level}`);
}

function ledgerDisplayText(ledger, symbol) {
  const done = ledgerDoneTiers(ledger, symbol);
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
  ledgerDisplayText,
};
