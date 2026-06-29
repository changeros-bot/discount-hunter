function normalizeSymbol(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function stripOnSuffix(symbol) {
  return normalizeSymbol(symbol).replace(/ON$/, "");
}

function symbolKey(symbol) {
  return stripOnSuffix(symbol);
}

function sameSymbol(a, b) {
  return symbolKey(a) === symbolKey(b);
}

module.exports = {
  normalizeSymbol,
  stripOnSuffix,
  symbolKey,
  sameSymbol,
};
