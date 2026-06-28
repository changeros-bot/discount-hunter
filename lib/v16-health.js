function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function count(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function isPricesHealthy(payload) {
  if (!isObject(payload)) return false;
  if (payload.ok === false) return false;
  if (Array.isArray(payload.data)) return true;
  if (Array.isArray(payload.assets)) return true;
  return false;
}

function isWalletHealthy(payload) {
  if (!isObject(payload)) return false;
  if (payload.ok === false) return false;
  if (payload.ok === true) return true;
  if (Array.isArray(payload.holdings)) return true;
  if (count(payload?.debugCounts?.liveBalanceHoldingsCount) > 0) return true;
  if (count(payload?.debugCounts?.selectedLiveBalanceHoldingsCount) > 0) return true;
  return false;
}

function healthSummary({ prices, wallet }) {
  return {
    pricesOk: isPricesHealthy(prices),
    walletOk: isWalletHealthy(wallet),
    pricesCount: Array.isArray(prices?.data) ? prices.data.length : Array.isArray(prices?.assets) ? prices.assets.length : null,
    walletHoldingsCount: Array.isArray(wallet?.holdings) ? wallet.holdings.length : null,
    liveBalanceHoldingsCount: count(wallet?.debugCounts?.liveBalanceHoldingsCount),
    selectedLiveBalanceHoldingsCount: count(wallet?.debugCounts?.selectedLiveBalanceHoldingsCount),
  };
}

module.exports = {
  isPricesHealthy,
  isWalletHealthy,
  healthSummary,
};
