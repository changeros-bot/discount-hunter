// DCA Discount Hunter - Unified transfer source
// Correct priority: choose the configured source that can reconstruct real xStocks BUY cost basis.
// BUY cost basis = stablecoin OUT + xStock IN in the same tx hash.

const { fetchMegaNodeTransfers, hasMegaNodeConfig } = require("./meganode");
const { fetchMoralisTokenTransfers, hasMoralisKey } = require("./moralis");
const { fetchBscScanTokenTransfers, hasBscScanKey } = require("./bscscan");
const { buildBuyRecordsFromTransfers } = require("./costBasis");

function hasMegaNodeKey() { return hasMegaNodeConfig(); }

function getTransferSources(legacyFetcher) {
  return [
    { name: "Moralis", configured: hasMoralisKey(), fetcher: fetchMoralisTokenTransfers },
    { name: "MegaNode / NodeReal", configured: hasMegaNodeKey(), fetcher: fetchMegaNodeTransfers },
    { name: "BscScan / Etherscan V2", configured: hasBscScanKey(), fetcher: fetchBscScanTokenTransfers },
    ...(typeof legacyFetcher === "function" ? [{ name: "Legacy", configured: true, fetcher: legacyFetcher }] : []),
  ];
}

function scoreTransfers(transfers, walletAddress) {
  let records = [];
  try { records = buildBuyRecordsFromTransfers(transfers || [], walletAddress); } catch { records = []; }
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

async function diagnoseTransferSources(walletAddress, legacyFetcher) {
  const candidates = [];
  const diagnostics = [];

  for (const source of getTransferSources(legacyFetcher)) {
    if (!source.configured) {
      diagnostics.push({ name: source.name, configured: false, status: "OFF", transferCount: 0, error: `${source.name} key missing`, score: null });
      continue;
    }
    try {
      const transfers = await source.fetcher(walletAddress);
      if (!Array.isArray(transfers)) {
        diagnostics.push({ name: source.name, configured: true, status: "NON_ARRAY", transferCount: 0, error: `${source.name} returned non-array`, score: null });
        continue;
      }
      const score = scoreTransfers(transfers, walletAddress);
      const status = score.usableForCostBasis ? "PASS_COST_BASIS" : score.transferCount > 0 ? "TRANSFERS_NO_BUY_COST" : "ZERO_TRANSFERS";
      const candidate = { name: source.name, transfers, score };
      candidates.push(candidate);
      diagnostics.push({ name: source.name, configured: true, status, transferCount: score.transferCount, error: null, score });
    } catch (error) {
      diagnostics.push({ name: source.name, configured: true, status: "ERROR", transferCount: 0, error: error.message || String(error), score: null });
    }
  }

  const costReady = candidates
    .filter((c) => c.score.usableForCostBasis)
    .sort((a, b) => b.score.symbolCount - a.score.symbolCount || b.score.buyRecordCount - a.score.buyRecordCount || b.score.totalCostUsd - a.score.totalCostUsd);
  if (costReady.length > 0) return { selected: costReady[0], diagnostics };

  const nonEmpty = candidates
    .filter((c) => c.score.transferCount > 0)
    .sort((a, b) => b.score.transferCount - a.score.transferCount);
  if (nonEmpty.length > 0) return { selected: nonEmpty[0], diagnostics };

  return { selected: { name: "none", transfers: [], score: scoreTransfers([], walletAddress) }, diagnostics };
}

async function fetchWalletTokenTransfers(walletAddress, legacyFetcher) {
  const result = await diagnoseTransferSources(walletAddress, legacyFetcher);
  const selected = result.selected;
  if (selected?.score?.usableForCostBasis) {
    console.log(`Selected transfer source for xStocks cost basis: ${selected.name}`, selected.score);
    return selected.transfers;
  }
  if (selected?.score?.transferCount > 0) {
    console.warn(`No transfer source produced xStocks BUY cost basis; using non-empty source for diagnostics: ${selected.name}`, selected.score);
    return selected.transfers;
  }
  console.warn(`Transfer fetch unavailable, using empty fallback: ${result.diagnostics.map((d) => `${d.name}:${d.status}${d.error ? `:${d.error}` : ""}`).join(" | ")}`);
  return [];
}

module.exports = {
  fetchWalletTokenTransfers,
  diagnoseTransferSources,
  hasMegaNodeKey,
  hasMoralisKey,
  hasBscScanKey,
  scoreTransfers,
};
