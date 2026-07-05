// Verified xStocks cost sources.
// Each entry is backed by /api/v17/tx-source-audit result:
// stablecoin OUT from wallet + xStock IN to wallet in the same tx hash.

const VERIFIED_TX_COST_SOURCES = {
  AVGOON: {
    symbol: "AVGOON",
    totalCost: 15,
    buyCount: 2,
    txHashes: [
      "0x6ca3646b41a93020960a6022fc7d7e85235ac0397b9efefcf4c35c276b304a0d",
      "0xeaa715eec2bc61101cf2371b1590298ca271feb7f71433ceea6c6464acd88b19",
    ],
  },
  GOOGLON: {
    symbol: "GOOGLON",
    totalCost: 5,
    buyCount: 1,
    txHashes: ["0x36a22abbc81f269171e8f8f52191e0d565a39ef01450401f57a55cc7ff96d933"],
  },
  MRVLON: {
    symbol: "MRVLON",
    totalCost: 10,
    buyCount: 2,
    txHashes: [
      "0x6cc12bc3ef815ed714469ad69c55b7594c00b4a1653c2e8345d8f5a5ee74f5b2",
      "0x4b2c5470f731614c93f3087e9f4612eaac9074f6ed970f29d668ae873899563b",
    ],
  },
  NVDAON: {
    symbol: "NVDAON",
    totalCost: 10,
    buyCount: 2,
    txHashes: [
      "0x95dbb6ad9a121c70149051db2062c27e0243a5dc2c39c768d1bf8ee535bb3424",
      "0x3d1e788a9561a1b0cfc92e249b47f9cfa15ddaec950811fd365f53ed079b5c60",
    ],
  },
  QQQON: {
    symbol: "QQQON",
    totalCost: 5,
    buyCount: 1,
    txHashes: ["0xc87bfd9eb5c70985cd1c79b8a91f8eb085bf38afe43ae7035c1261ae6d83c551"],
  },
  RKLBON: {
    symbol: "RKLBON",
    totalCost: 15,
    buyCount: 2,
    txHashes: [
      "0x25472b898ad13660560d76f7c34f2478e4f1e0540a9bcd6c2c5dc5deb32bd510",
      "0x4c5d3128eede2c614e110ae88c1ed6dd2875d36e69734330a97d63a66a2edf91",
    ],
  },
  SPCXON: {
    symbol: "SPCXON",
    totalCost: 10,
    buyCount: 2,
    txHashes: [
      "0x0b90c3d6662e065c2861d9dc974632f88f40edd717b321fe1a3ba2fe68301436",
      "0x7819062d5d11975138d7a0e995243f30a5a6c7096174b77aeaea5a439b5a4b35",
    ],
  },
  TSMON: {
    symbol: "TSMON",
    totalCost: 5,
    buyCount: 1,
    txHashes: ["0x8adf81c975aaa46b24314b5500ccfcbda8115f95d3e0f59a0fe9837789bb3ffc"],
  },
};

function normalizeOnSymbol(symbol) {
  const key = String(symbol || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!key) return "";
  return key.endsWith("ON") ? key : `${key}ON`;
}
function safeNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}
function applyVerifiedTxCostSources(items = []) {
  const map = new Map((items || []).map((item) => [normalizeOnSymbol(item.symbol), item]));
  for (const source of Object.values(VERIFIED_TX_COST_SOURCES)) {
    const symbol = normalizeOnSymbol(source.symbol);
    const existing = map.get(symbol) || {};
    map.set(symbol, {
      ...existing,
      symbol,
      totalCost: safeNumber(source.totalCost),
      buyCount: safeNumber(source.buyCount),
      costBasisSource: "verified_tx_hash_receipt",
      costBasisRecoveredOnly: false,
      costBasisEstimated: false,
      costBasisMissing: false,
      verifiedTxHashes: source.txHashes || [],
      verifiedRule: "stablecoin OUT + xStock IN in same tx hash = BUY",
      recoveredSources: [...new Set([...(existing.recoveredSources || []), "verified_tx_hash_receipt"])],
      recoveredCostWarning: null,
    });
  }
  return [...map.values()].sort((a, b) => String(a.symbol).localeCompare(String(b.symbol)));
}

module.exports = {
  VERIFIED_TX_COST_SOURCES,
  applyVerifiedTxCostSources,
};
