// DCA Discount Hunter V15.30 - BscScan/Etherscan V2 token balance helper
// Used only as a fallback when RPC balanceOf returns zero for a verified token.
// Etherscan V2 requires api.etherscan.io/v2/api with chainid=56 for BNB Chain.

const BSC_CHAIN_ID = "56";
const ETHERSCAN_V2_URL = "https://api.etherscan.io/v2/api";

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
    throw new Error(`Explorer balance returned non-json: ${text.slice(0, 180)}`);
  }
}

async function fetchTokenBalanceV2(apiKey, walletAddress, contractAddress) {
  const params = new URLSearchParams({
    chainid: BSC_CHAIN_ID,
    module: "account",
    action: "tokenbalance",
    contractaddress: contractAddress,
    address: walletAddress,
    tag: "latest",
    apikey: apiKey,
  });

  const data = await fetchJson(`${ETHERSCAN_V2_URL}?${params.toString()}`);
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

  if (!apiKey || String(apiKey).startsWith("sk_")) throw new Error("Explorer API key missing or invalid");
  if (!isEvmAddress(wallet)) throw new Error("Invalid wallet address for tokenbalance");
  if (!isEvmAddress(contract)) throw new Error("Invalid contract address for tokenbalance");

  return fetchTokenBalanceV2(apiKey, wallet, contract);
}

module.exports = { fetchBscScanTokenBalance };
