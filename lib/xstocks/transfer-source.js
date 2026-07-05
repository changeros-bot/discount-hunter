// DCA Discount Hunter V15.5 - Unified transfer source
// Priority: Moralis -> MegaNode / NodeReal -> Public BSC RPC -> BscScan / Etherscan V2 -> legacy fetcher fallback.
// If no transfer source is available, return an empty transfer list instead of breaking the homepage.

const { fetchMegaNodeTransfers, hasMegaNodeConfig } = require("./meganode");
const { fetchMoralisTokenTransfers, hasMoralisKey } = require("./moralis");
const { fetchPublicRpcTransfers, hasPublicRpcConfig } = require("./publicRpcLogs");
const { fetchBscScanTokenTransfers, hasBscScanKey } = require("./bscscan");

function hasMegaNodeKey() {
  return hasMegaNodeConfig();
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

  if (hasPublicRpcConfig()) {
    try {
      const transfers = await fetchPublicRpcTransfers(walletAddress);
      if (Array.isArray(transfers) && transfers.length > 0) return transfers;
      errors.push("Public BSC RPC returned 0 transfers");
    } catch (error) {
      errors.push(`Public BSC RPC: ${error.message}`);
    }
  } else {
    errors.push("Public BSC RPC unavailable");
  }

  if (hasBscScanKey()) {
    try {
      const transfers = await fetchBscScanTokenTransfers(walletAddress);
      if (Array.isArray(transfers) && transfers.length > 0) return transfers;
      errors.push("BscScan/Etherscan V2 returned 0 transfers");
    } catch (error) {
      errors.push(`BscScan/Etherscan V2: ${error.message}`);
    }
  } else {
    errors.push("BscScan/Etherscan V2 key missing");
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
  hasBscScanKey,
  hasPublicRpcConfig,
};
