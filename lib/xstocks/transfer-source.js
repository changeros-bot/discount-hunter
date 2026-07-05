// DCA Discount Hunter - Unified transfer source
// Priority is no longer "first non-empty transfers".
// Correct priority: choose the configured source that can reconstruct real xStocks BUY cost basis.
// BUY cost basis = stablecoin OUT + xStock IN in the same tx hash.

const { fetchMegaNodeTransfers, hasMegaNodeConfig } = require("./meganode");
const { fetchMoralisTokenTransfers, hasMoralisKey } = require("./moralis");
const { fetchBscScanTokenTransfers, hasBscScanKey } = require("./bscscan");
const { buildBuyRecordsFromTransfers } = require("./costBasis");

function hasMegaNodeKey() {
  return hasMegaNodeConfig();
}

function scoreTransfers(transfers, walletAddress) {
  let records = [];
  try {
    records = buildBuyRecordsFromTransfers(transfers || [], walletAddress);
  } catch {
    records = [];
  }
  const buyRecords = records.filter((r) => r.type === "BUY");
  const transferInRecords = records.filter((r) => r.type === "TRANSFER_IN");
  const totalCostUsd = buyRecords.reduce((sum, r) => sum + Number(r.costUsd || 0), 0);
  const symbolCount = new Set(buyRecords.map((r) => String(r.symbol || "").toUpperCase()).filter(Boolean)).size;
  return {
    transferCount: Array.isArray(transfers) ? transfers.length : 0,
    recordCount: records.length,
    buyRecordCount: buyRecords.length,
    transferInRecordCount: transferInRecords.length,
    totalCostUsd,
    symbolCount,
    usableForCostBasis: buyRecords.length > 0 && totalCostUsd > 0,
  };
}

async function fetchWalletTokenTransfers(walletAddress, legacyFetcher) {
  const errors = [];
  const candidates = [];

  const sources = [
    { name: "Moralis", configured: hasMoralisKey(), fetcher: fetchMoralisTokenTransfers },
    { name: "MegaNode / NodeReal", configured: hasMegaNodeKey(), fetcher: fetchMegaNodeTransfers },
    { name: "BscScan / Etherscan V2", configured: hasBscScanKey(), fetcher: fetchBscScanTokenTransfers },
    ...(typeof legacyFetcher === "function" ? [{ name: "Legacy", configured: true, fetcher: legacyFetcher }] : []),
  ];

  for (const source of sources) {
    if (!source.configured) {
      errors.push(`${source.name} key missing`);
      continue;
    }
    try {
      const transfers = await source.fetcher(walletAddress);
      if (!Array.isArray(transfers)) {
        errors.push(`${source.name} returned non-array`);
        continue;
      }
      const score = scoreTransfers(transfers, walletAddress);
      candidates.push({ ...source, transfers, score });
      if (score.transferCount === 0) errors.push(`${source.name} returned 0 transfers`);
    } catch (error) {
      errors.push(`${source.name}: ${error.message}`);
    }
  }

  const costReady = candidates
    .filter((c) => c.score.usableForCostBasis)
    .sort((a, b) => b.score.symbolCount - a.score.symbolCount || b.score.buyRecordCount - a.score.buyRecordCount || b.score.totalCostUsd - a.score.totalCostUsd);

  if (costReady.length > 0) {
    const selected = costReady[0];
    console.log(`Selected transfer source for xStocks cost basis: ${selected.name}`, selected.score);
    return selected.transfers;
  }

  const nonEmpty = candidates.filter((c) => c.score.transferCount > 0).sort((a, b) => b.score.transferCount - a.score.transferCount);
  if (nonEmpty.length > 0) {
    const selected = nonEmpty[0];
    console.warn(`No transfer source produced xStocks BUY cost basis; using non-empty source for diagnostics: ${selected.name}`, selected.score);
    return selected.transfers;
  }

  console.warn(`Transfer fetch unavailable, using empty fallback: ${errors.join(" | ")}`);
  return [];
}

module.exports = {
  fetchWalletTokenTransfers,
  hasMegaNodeKey,
  hasMoralisKey,
  hasBscScanKey,
  scoreTransfers,
};
