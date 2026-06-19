// DCA Discount Hunter V15.2 - BSC token transfer fetcher
// Etherscan/BscScan V2 requires chainid=56 for BNB Smart Chain.

const BSC_CHAIN_ID = "56";
const ETHERSCAN_V2_URL = "https://api.etherscan.io/v2/api";
const BSCSCAN_V2_URL = "https://api.bscscan.com/v2/api";

function getApiKey() {
  return process.env.ETHERSCAN_API_KEY || process.env.BSCSCAN_API_KEY;
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Explorer API returned non-json: ${text.slice(0, 180)}`);
  }
}

function isNoTransactions(data) {
  return data?.status === "0" && String(data?.message || "").toLowerCase().includes("no transactions");
}

function formatExplorerError(data) {
  const detail = typeof data?.result === "string" ? data.result : data?.message || "unknown error";
  return `${data?.message || "NOTOK"} - ${detail}`;
}

async function fetchBep20TransfersPage(baseUrl, apiKey, cleanWalletAddress, page, offset) {
  const params = new URLSearchParams({
    chainid: BSC_CHAIN_ID,
    module: "account",
    action: "tokentx",
    address: cleanWalletAddress,
    page: String(page),
    offset: String(offset),
    sort: "asc",
    apikey: apiKey,
  });

  const url = `${baseUrl}?${params.toString()}`;
  return fetchJson(url);
}

async function fetchBep20TransfersFromBaseUrl(baseUrl, apiKey, cleanWalletAddress) {
  const allTransfers = [];
  let page = 1;
  const offset = 1000;

  while (true) {
    const data = await fetchBep20TransfersPage(baseUrl, apiKey, cleanWalletAddress, page, offset);

    if (isNoTransactions(data)) break;

    if (data.status !== "1" || !Array.isArray(data.result)) {
      throw new Error(formatExplorerError(data));
    }

    allTransfers.push(...data.result);
    if (data.result.length < offset) break;
    page++;
  }

  return allTransfers;
}

async function fetchBep20TransfersLegacy(walletAddress) {
  const apiKey = getApiKey();
  const cleanWalletAddress = String(walletAddress || "").trim();

  if (!apiKey) {
    throw new Error("ETHERSCAN_API_KEY or BSCSCAN_API_KEY not found in environment variables");
  }

  if (String(apiKey).startsWith("sk_")) {
    throw new Error("Explorer API key looks invalid: it starts with sk_. Please use an Etherscan/BscScan API key");
  }

  if (!cleanWalletAddress) {
    throw new Error("walletAddress is empty before calling explorer API");
  }

  const errors = [];

  for (const baseUrl of [ETHERSCAN_V2_URL, BSCSCAN_V2_URL]) {
    try {
      return await fetchBep20TransfersFromBaseUrl(baseUrl, apiKey, cleanWalletAddress);
    } catch (error) {
      errors.push(`${baseUrl}: ${error.message}`);
    }
  }

  throw new Error(`Explorer V2 API error: ${errors.join(" | ")}`);
}

module.exports = { fetchBep20TransfersLegacy };
