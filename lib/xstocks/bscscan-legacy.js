// DCA Discount Hunter V15.3 - BSC token transfer fetcher
// Primary: Explorer wallet-wide tokentx. Fallback: BSC RPC eth_getLogs using verified contracts.

const { getKnownContracts } = require("./contracts");
const { WATCHLIST } = require("./constants");

const BSC_CHAIN_ID = "56";
const ETHERSCAN_V2_URL = "https://api.etherscan.io/v2/api";
const BSCSCAN_V2_URL = "https://api.bscscan.com/v2/api";
const BSC_RPC_URL = process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org";
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const STABLE_TOKENS = [
  { symbol: "USDT", address: "0x55d398326f99059ff775485246999027b3197955", decimals: "18" },
  { symbol: "BSC-USD", address: "0x55d398326f99059ff775485246999027b3197955", decimals: "18" },
  { symbol: "BUSD", address: "0xe9e7cea3dedca5984780bafc599bd69add087d56", decimals: "18" },
  { symbol: "USDC", address: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", decimals: "18" },
  { symbol: "USDon", address: "0x1f8955e640cbd9abc3c3bb408c9e2e1f5f20dfe6", decimals: "18" },
];

function getApiKey() {
  return process.env.ETHERSCAN_API_KEY || process.env.BSCSCAN_API_KEY;
}

function cleanAddress(value) {
  return String(value || "").trim().toLowerCase();
}

function topicAddress(address) {
  return `0x${cleanAddress(address).replace(/^0x/, "").padStart(64, "0")}`;
}

function addressFromTopic(topic) {
  return `0x${String(topic || "").slice(-40)}`.toLowerCase();
}

function hexToBigInt(hex) {
  try {
    return BigInt(hex || "0x0").toString();
  } catch {
    return "0";
  }
}

function hexToDecimalString(hex) {
  try {
    return BigInt(hex || "0x0").toString(10);
  } catch {
    return "0";
  }
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

async function rpcCall(method, params) {
  const res = await fetch(BSC_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`RPC returned non-json: ${text.slice(0, 180)}`);
  }
  if (json.error) throw new Error(`${json.error.code || "RPC"}: ${json.error.message || "RPC error"}`);
  return json.result;
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

async function getBlockTimestamp(blockNumberHex, cache) {
  if (cache.has(blockNumberHex)) return cache.get(blockNumberHex);
  const block = await rpcCall("eth_getBlockByNumber", [blockNumberHex, false]);
  const ts = hexToDecimalString(block?.timestamp || "0x0");
  cache.set(blockNumberHex, ts);
  return ts;
}

async function fetchTransferLogsForToken(token, walletAddress, direction) {
  const walletTopic = topicAddress(walletAddress);
  const fromBlock = process.env.BSC_FROM_BLOCK || process.env.BSC_RPC_FROM_BLOCK || "0x0";
  const toBlock = process.env.BSC_TO_BLOCK || "latest";
  const topics = direction === "in"
    ? [TRANSFER_TOPIC, null, walletTopic]
    : [TRANSFER_TOPIC, walletTopic, null];

  return rpcCall("eth_getLogs", [{
    address: cleanAddress(token.address),
    fromBlock,
    toBlock,
    topics,
  }]);
}

function buildRpcTokenList() {
  const verifiedXStocks = getKnownContracts(WATCHLIST).map((item) => ({
    symbol: item.symbol,
    address: item.contractAddress,
    decimals: String(item.decimals || 18),
  }));

  const tokenMap = new Map();
  for (const token of [...verifiedXStocks, ...STABLE_TOKENS]) {
    const key = cleanAddress(token.address);
    if (!key || tokenMap.has(key)) continue;
    tokenMap.set(key, token);
  }
  return Array.from(tokenMap.values());
}

async function fetchBep20TransfersFromRpc(walletAddress) {
  const tokens = buildRpcTokenList();
  const allLogs = [];

  for (const token of tokens) {
    for (const direction of ["in", "out"]) {
      try {
        const logs = await fetchTransferLogsForToken(token, walletAddress, direction);
        for (const log of logs || []) allLogs.push({ ...log, token });
      } catch (error) {
        throw new Error(`RPC logs failed for ${token.symbol} ${direction}: ${error.message}`);
      }
    }
  }

  const timestampCache = new Map();
  const transfers = [];
  for (const log of allLogs) {
    const from = addressFromTopic(log.topics?.[1]);
    const to = addressFromTopic(log.topics?.[2]);
    const timeStamp = await getBlockTimestamp(log.blockNumber, timestampCache);
    transfers.push({
      blockNumber: String(parseInt(log.blockNumber, 16)),
      timeStamp,
      hash: log.transactionHash,
      from,
      to,
      contractAddress: cleanAddress(log.address),
      tokenName: log.token.symbol,
      tokenSymbol: log.token.symbol,
      tokenDecimal: log.token.decimals || "18",
      value: hexToBigInt(log.data),
    });
  }

  const seen = new Set();
  return transfers
    .filter((tx) => {
      const key = `${tx.hash}-${tx.contractAddress}-${tx.from}-${tx.to}-${tx.value}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => Number(a.blockNumber) - Number(b.blockNumber));
}

async function fetchBep20TransfersLegacy(walletAddress) {
  const apiKey = getApiKey();
  const cleanWalletAddress = String(walletAddress || "").trim();

  if (!cleanWalletAddress) {
    throw new Error("walletAddress is empty before calling explorer/RPC API");
  }

  const errors = [];

  if (apiKey && !String(apiKey).startsWith("sk_")) {
    for (const baseUrl of [ETHERSCAN_V2_URL, BSCSCAN_V2_URL]) {
      try {
        return await fetchBep20TransfersFromBaseUrl(baseUrl, apiKey, cleanWalletAddress);
      } catch (error) {
        errors.push(`${baseUrl}: ${error.message}`);
      }
    }
  } else if (!apiKey) {
    errors.push("Explorer API key missing; using RPC fallback");
  } else {
    errors.push("Explorer API key invalid; using RPC fallback");
  }

  try {
    return await fetchBep20TransfersFromRpc(cleanWalletAddress);
  } catch (error) {
    errors.push(`BSC RPC fallback: ${error.message}`);
  }

  throw new Error(`Transfer fetch failed: ${errors.join(" | ")}`);
}

module.exports = { fetchBep20TransfersLegacy };
