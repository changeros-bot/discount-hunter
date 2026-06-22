// DCA Discount Hunter V15.29 - BscScan token balance helper
// Used only as a fallback when RPC balanceOf returns zero for a verified token.

const BSC_CHAIN_ID = "56";
const BSCSCAN_V1_URL = "https://api.bscscan.com/api";
const BSCSCAN_V2_URL = "https://api.bscscan.com/v2/api";

function getApiKey() {
  return process.env.BSCSCAN_API_KEY || process.env.ETHERSCAN_API_KEY || "";
}

function cleanAddress(value) {
  return String(value || "").trim();
}

function isEvmAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(cleanAddress(value));
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`BscScan balance returned non-json: ${text.slice(0, 180)}`);
  }
}

async function fetchTokenBalanceFromBaseUrl(baseUrl, apiKey, walletAddress, contractAddress, useV2) {
  const params = new URLSearchParams({
    module: "account",
    action: "tokenbalance",
    contractaddress: contractAddress,
    address: walletAddress,
    tag: "latest",
    apikey: apiKey,
  });
  if (useV2) params.set("chainid", BSC_CHAIN_ID);

  const data = await fetchJson(`${baseUrl}?${params.toString()}`);
  if (data.status !== "1" && typeof data.result !== "string") {
    throw new Error(`${data.message || "NOTOK"} - ${data.result || "unknown tokenbalance error"}`);
  }

  const raw = String(data.result || "0");
  if (!/^\d+$/.test(raw)) throw new Error(`Invalid tokenbalance result: ${raw}`);
  return raw;
}

async function fetchBscScanTokenBalance(walletAddress, contractAddress) {
  const apiKey = getApiKey();
  const wallet = cleanAddress(walletAddress);
  const contract = cleanAddress(contractAddress);

  if (!apiKey || String(apiKey).startsWith("sk_")) throw new Error("BscScan API key missing or invalid");
  if (!isEvmAddress(wallet)) throw new Error("Invalid wallet address for tokenbalance");
  if (!isEvmAddress(contract)) throw new Error("Invalid contract address for tokenbalance");

  const errors = [];
  for (const source of [
    { baseUrl: BSCSCAN_V1_URL, useV2: false, name: "BscScan V1" },
    { baseUrl: BSCSCAN_V2_URL, useV2: true, name: "BscScan V2" },
  ]) {
    try {
      return await fetchTokenBalanceFromBaseUrl(source.baseUrl, apiKey, wallet, contract, source.useV2);
    } catch (error) {
      errors.push(`${source.name}: ${error.message}`);
    }
  }

  throw new Error(`BscScan tokenbalance failed: ${errors.join(" | ")}`);
}

module.exports = { fetchBscScanTokenBalance };
