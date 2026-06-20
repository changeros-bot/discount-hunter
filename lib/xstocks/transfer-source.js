// DCA Discount Hunter V15.5 - Unified transfer source
// Priority: Moralis -> MegaNode / NodeReal -> legacy fetcher fallback.
// If no transfer source is available, return an empty transfer list instead of breaking the homepage.

const { fetchMegaNodeTransfers } = require("./meganode");
const { fetchMoralisTokenTransfers, hasMoralisKey } = require("./moralis");

function hasMegaNodeKey() {
  return Boolean(
    process.env.MEGANODE_API_KEY ||
    process.env.NODEREAL_API_KEY ||
    process.env.MEGANODE_ENDPOINT ||
    process.env.NODEREAL_ENDPOINT
  );
}

async function fetchWalletTokenTransfers(walletAddress, legacyFetcher) {
  const errors = [];

  if (hasMoralisKey()) {
    try {
      const transfers = await fetchMoralisTokenTransfers(walletAddress);
      if (Array.isArray(transfers) && transfers.length > 0) return transfers;
      errors.push("Moralis returned 0 transfers");
    } catch (error) {
      errors.push(`Moralis: ${error.message}`);
    }
  } else {
    errors.push("Moralis key missing");
  }

  if (hasMegaNodeKey()) {
    try {
      const transfers = await fetchMegaNodeTransfers(walletAddress);
      if (Array.isArray(transfers) && transfers.length > 0) return transfers;
      errors.push("MegaNode returned 0 transfers");
    } catch (error) {
      errors.push(`MegaNode: ${error.message}`);
    }
  } else {
    errors.push("MegaNode key missing");
  }

  if (typeof legacyFetcher === "function") {
    try {
      const transfers = await legacyFetcher(walletAddress);
      if (Array.isArray(transfers)) return transfers;
      errors.push("Legacy fetcher returned non-array");
    } catch (error) {
      errors.push(`Legacy: ${error.message}`);
    }
  }

  console.warn(`Transfer fetch unavailable, using empty fallback: ${errors.join(" | ")}`);
  return [];
}

module.exports = {
  fetchWalletTokenTransfers,
  hasMegaNodeKey,
  hasMoralisKey,
};