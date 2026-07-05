// Verified position fallbacks for cases where standard ERC20 balanceOf returns empty data (0x).
// These entries are not estimated. They are backed by tx receipt / BscScan asset evidence.

const VERIFIED_POSITION_FALLBACKS = {
  AMDON: {
    symbol: "AMDON",
    quantity: 0.009157194826970577,
    totalCost: 5,
    buyCount: 1,
    contractAddress: "0x9f16e46c73b43bdb70861247d537bee4ae18f639",
    quantitySource: "verified_position_fallback_bscscan_asset",
    costBasisSource: "verified_tx_hash_receipt_bscscan_state",
    reason: "balanceOf returned EMPTY_RETURN 0x; use verified fallback instead of treating as zero",
    txHashes: ["0x85f9f3edf7776e52999a9aa7a873db6c48ff54904ccaab2ba36c46cfdcf74d17"],
  },
};

function upper(value) {
  return String(value || "").trim().toUpperCase();
}
function normalizeOnSymbol(symbol) {
  const s = upper(symbol);
  if (!s) return "";
  return s.endsWith("ON") ? s : `${s}ON`;
}
function safeNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}
function buildVerifiedPositionFallbackHoldings(costHoldings = [], liveHoldings = []) {
  const liveSymbols = new Set((liveHoldings || []).map((h) => normalizeOnSymbol(h.symbol)));
  const costMap = new Map((costHoldings || []).map((h) => [normalizeOnSymbol(h.symbol), h]));
  const out = [];
  for (const fallback of Object.values(VERIFIED_POSITION_FALLBACKS)) {
    const symbol = normalizeOnSymbol(fallback.symbol);
    if (!symbol || liveSymbols.has(symbol)) continue;
    const quantity = safeNumber(fallback.quantity);
    if (!(quantity > 0)) continue;
    const cost = costMap.get(symbol) || {};
    out.push({
      ...cost,
      symbol,
      quantity,
      contractAddress: fallback.contractAddress || cost.contractAddress || null,
      contractAddresses: [fallback.contractAddress || cost.contractAddress].filter(Boolean),
      details: [{
        symbol,
        quantity,
        contractAddress: fallback.contractAddress || null,
        source: fallback.quantitySource,
        callStatus: "verified_fallback_after_balanceof_empty_return",
        errorMessage: fallback.reason,
      }],
      source: fallback.quantitySource,
      selectionReason: "verified_position_fallback_after_balanceof_empty_return",
      quantitySource: fallback.quantitySource,
      fallbackReason: fallback.reason,
    });
  }
  return out;
}

module.exports = {
  VERIFIED_POSITION_FALLBACKS,
  buildVerifiedPositionFallbackHoldings,
};
