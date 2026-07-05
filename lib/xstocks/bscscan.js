// DCA Discount Hunter - BscScan BEP20 transfer fallback
// Priority: native BscScan endpoint first, then Etherscan V2 chainid=56.
// Normalizes rows into the same transfer shape used by Moralis / MegaNode.

const BSCSCAN_NATIVE_URL = "https://api.bscscan.com/api";
const ETHERSCAN_V2_URL = "https://api.etherscan.io/v2/api";

function norm(value) {
  return String(value || "").trim();
}

function getBscScanApiKey() {
  return process.env.BSCSCAN_API_KEY || process.env.BSC_SCAN_API_KEY || "";
}

function getEtherscanApiKey() {
  return process.env.ETHERSCAN_API_KEY || "";
}

function hasBscScanKey() {
  return Boolean(getBscScanApiKey() || getEtherscanApiKey());
}

function toUnixSeconds(value) {
  if (!value) return "0";
  const n = Number(value);
  if (Number.isFinite(n) && n > 0) return String(Math.floor(n));
  const d = new Date(value);
  const ms = d.getTime();
  return Number.isFinite(ms) ? String(Math.floor(ms / 1000)) : "0";
}

function normalizeBscScanTransfer(t) {
  return {
    blockNumber: String(t.blockNumber || "0"),
    timeStamp: toUnixSeconds(t.timeStamp || t.block_timestamp),
    hash: t.hash || t.transactionHash || "",
    from: norm(t.from || t.fromAddress).toLowerCase(),
    to: norm(t.to || t.toAddress).toLowerCase(),
    contractAddress: norm(t.contractAddress || t.tokenAddress).toLowerCase(),
    tokenName: t.tokenName || t.token_name || "UNKNOWN",
    tokenSymbol: t.tokenSymbol || t.token_symbol || "UNKNOWN",
    tokenDecimal: String(t.tokenDecimal ?? t.token_decimals ?? "18"),
    value: String(t.value || "0"),
    bscscanRaw: {
      tokenSymbol: t.tokenSymbol,
      tokenName: t.tokenName,
      value: t.value,
      tokenDecimal: t.tokenDecimal,
    },
  };
}

function dedupeAndSort(transfers) {
  const seen = new Set();
  return (transfers || [])
    .filter((tx) => {
      const key = `${tx.hash}-${tx.contractAddress}-${tx.from}-${tx.to}-${tx.value}`;
      if (!tx.hash || !tx.contractAddress || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => Number(a.blockNumber || 0) - Number(b.blockNumber || 0));
}

async function fetchPagedTransfers({ baseUrl, apiKey, walletAddress, useChainId = false, providerName }) {
  if (!apiKey) throw new Error(`${providerName} API key not found`);

  const cleanWallet = norm(walletAddress);
  if (!cleanWallet) throw new Error("walletAddress is empty before BscScan fetch");

  const allTransfers = [];
  let page = 1;
  const offset = Number(process.env.BSCSCAN_OFFSET || 1000);
  const maxPages = Number(process.env.BSCSCAN_MAX_PAGES || 20);

  while (page <= maxPages) {
    const params = new URLSearchParams({
      module: "account",
      action: "tokentx",
      address: cleanWallet,
      page: String(page),
      offset: String(offset),
      sort: "asc",
      apikey: apiKey,
    });
    if (useChainId) params.set("chainid", "56");

    const res = await fetch(`${baseUrl}?${params.toString()}`, { cache: "no-store" });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`${providerName} returned non-json: ${text.slice(0, 180)}`);
    }

    const messageText = String(data.message || data.result || "").toLowerCase();
    if (data.status === "0" && messageText.includes("no transactions")) break;
    if (data.status !== "1" || !Array.isArray(data.result)) {
      const detail = typeof data.result === "string" ? data.result : data.message || "unknown error";
      throw new Error(`${providerName} API error: ${data.message || "NOTOK"} - ${detail}`);
    }

    const batch = data.result.map(normalizeBscScanTransfer);
    allTransfers.push(...batch);
    if (batch.length < offset) break;
    page += 1;
  }

  return dedupeAndSort(allTransfers);
}

async function fetchNativeBscScanTransfers(walletAddress) {
  return fetchPagedTransfers({
    baseUrl: BSCSCAN_NATIVE_URL,
    apiKey: getBscScanApiKey(),
    walletAddress,
    useChainId: false,
    providerName: "BscScan native",
  });
}

async function fetchEtherscanV2BscTransfers(walletAddress) {
  return fetchPagedTransfers({
    baseUrl: ETHERSCAN_V2_URL,
    apiKey: getEtherscanApiKey(),
    walletAddress,
    useChainId: true,
    providerName: "Etherscan V2 chainid=56",
  });
}

async function fetchBep20Transfers(walletAddress) {
  const errors = [];

  if (getBscScanApiKey()) {
    try {
      const rows = await fetchNativeBscScanTransfers(walletAddress);
      if (rows.length > 0) return rows;
      errors.push("BscScan native returned 0 transfers");
    } catch (error) {
      errors.push(error.message);
    }
  } else {
    errors.push("BSCSCAN_API_KEY / BSC_SCAN_API_KEY missing");
  }

  if (getEtherscanApiKey()) {
    try {
      const rows = await fetchEtherscanV2BscTransfers(walletAddress);
      if (rows.length > 0) return rows;
      errors.push("Etherscan V2 chainid=56 returned 0 transfers");
    } catch (error) {
      errors.push(error.message);
    }
  } else {
    errors.push("ETHERSCAN_API_KEY missing");
  }

  throw new Error(errors.join(" | "));
}

async function fetchBscScanTokenTransfers(walletAddress) {
  return fetchBep20Transfers(walletAddress);
}

module.exports = {
  fetchBep20Transfers,
  fetchBscScanTokenTransfers,
  hasBscScanKey,
  fetchNativeBscScanTransfers,
  fetchEtherscanV2BscTransfers,
};
