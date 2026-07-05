// DCA Discount Hunter V15.4 - MegaNode / NodeReal transfer fetcher
// Stable mode: use standard BSC JSON-RPC eth_getLogs for ERC20 Transfer events.
// This avoids NodeReal enhanced-only methods that may not be enabled on the current plan.

const { XSTOCK_CONTRACTS } = require("./contracts");

const BSC_CHAIN_ENDPOINT_BASE = "https://bsc-mainnet.nodereal.io/v1";
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const STABLE_CONTRACTS = [
  { symbol: "USDT", tokenName: "Binance-Peg BSC-USD", contractAddress: "0x55d398326f99059ff775485246999027b3197955", decimals: 18 },
  { symbol: "BSC-USD", tokenName: "Binance-Peg BSC-USD", contractAddress: "0x55d398326f99059ff775485246999027b3197955", decimals: 18 },
  { symbol: "USDC", tokenName: "Binance-Peg USD Coin", contractAddress: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", decimals: 18 },
  { symbol: "BUSD", tokenName: "Binance-Peg BUSD", contractAddress: "0xe9e7cea3dedca5984780bafc599bd69add087d56", decimals: 18 },
];

function norm(value) { return String(value || "").trim(); }
function lower(value) { return norm(value).toLowerCase(); }
function toHex(n) { return `0x${Math.max(0, Number(n || 0)).toString(16)}`; }
function padTopicAddress(address) { return `0x${lower(address).replace(/^0x/, "").padStart(64, "0")}`; }
function topicToAddress(topic) { return `0x${String(topic || "").replace(/^0x/, "").slice(24).toLowerCase()}`; }

function firstEnv(names = []) {
  for (const name of names) {
    const value = norm(process.env[name]);
    if (value) return value;
  }
  return "";
}

function getMegaNodeApiKey() {
  return firstEnv([
    "MEGANODE_API_KEY", "MEGA_NODE_API_KEY", "MEGANODE_KEY", "MEGA_NODE_KEY",
    "NODEREAL_API_KEY", "NODE_REAL_API_KEY", "NODEREAL_APIKEY", "NODE_REAL_APIKEY",
    "NODEREAL_KEY", "NODE_REAL_KEY", "NODEREAL_BSC_API_KEY", "NODEREAL_BSC_MAINNET_API_KEY",
  ]);
}

function getMegaNodeEndpoint() {
  const custom = firstEnv([
    "MEGANODE_ENDPOINT", "MEGA_NODE_ENDPOINT", "NODEREAL_ENDPOINT", "NODE_REAL_ENDPOINT",
    "NODEREAL_BSC_ENDPOINT", "NODEREAL_BSC_MAINNET_ENDPOINT",
  ]);
  if (custom) return custom;
  const apiKey = getMegaNodeApiKey();
  if (!apiKey) return "";
  return `${BSC_CHAIN_ENDPOINT_BASE}/${apiKey}`;
}

function hasMegaNodeConfig() { return Boolean(getMegaNodeEndpoint()); }

async function rpc(method, params) {
  const endpoint = getMegaNodeEndpoint();
  if (!endpoint) throw new Error("MEGANODE / NODEREAL API key or endpoint not found");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
  });
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error(`NodeReal RPC returned non-json: ${text.slice(0, 160)}`); }
  if (!response.ok || json.error) throw new Error(json.error?.message || `NodeReal RPC HTTP ${response.status}`);
  return json.result;
}

async function getBlockNumber() {
  const hex = await rpc("eth_blockNumber", []);
  return parseInt(hex, 16);
}

function logToTransfer(log, tokenMeta) {
  const topics = log.topics || [];
  return {
    blockNumber: String(parseInt(log.blockNumber || "0x0", 16)),
    timeStamp: "0",
    hash: log.transactionHash || "",
    from: topicToAddress(topics[1]),
    to: topicToAddress(topics[2]),
    contractAddress: lower(log.address || tokenMeta.contractAddress),
    tokenName: tokenMeta.tokenName || tokenMeta.symbol,
    tokenSymbol: tokenMeta.symbol,
    tokenDecimal: String(tokenMeta.decimals || 18),
    value: String(BigInt(log.data || "0x0")),
  };
}

async function getLogsInChunks(filterBase, fromBlock, toBlock) {
  const logs = [];
  const chunkSize = Number(process.env.NODEREAL_LOG_CHUNK_SIZE || process.env.MEGANODE_LOG_CHUNK_SIZE || 50000);
  let start = Math.max(0, Number(fromBlock || 0));
  const end = Math.max(start, Number(toBlock || start));
  while (start <= end) {
    const stop = Math.min(end, start + chunkSize - 1);
    const rows = await rpc("eth_getLogs", [{ ...filterBase, fromBlock: toHex(start), toBlock: toHex(stop) }]);
    if (Array.isArray(rows)) logs.push(...rows);
    start = stop + 1;
  }
  return logs;
}

async function fetchTokenTransfers(walletAddress, tokenMeta, currentBlock) {
  const walletTopic = padTopicAddress(walletAddress);
  const fromBlock = Number(process.env.XSTOCKS_TRANSFER_START_BLOCK || process.env.NODEREAL_START_BLOCK || Math.max(0, currentBlock - 5000000));
  const address = lower(tokenMeta.contractAddress);
  const inboundFilter = { address, topics: [TRANSFER_TOPIC, null, walletTopic] };
  const outboundFilter = { address, topics: [TRANSFER_TOPIC, walletTopic, null] };
  const [inLogs, outLogs] = await Promise.all([
    getLogsInChunks(inboundFilter, fromBlock, currentBlock),
    getLogsInChunks(outboundFilter, fromBlock, currentBlock),
  ]);
  return [...inLogs, ...outLogs].map((log) => logToTransfer(log, tokenMeta));
}

async function fetchMegaNodeTransfers(walletAddress) {
  const cleanWallet = lower(walletAddress);
  const currentBlock = await getBlockNumber();
  const xTokens = Object.values(XSTOCK_CONTRACTS).map((t) => ({
    symbol: t.symbol,
    tokenName: t.symbol,
    contractAddress: t.contractAddress,
    decimals: t.decimals || 18,
  }));
  const tokens = [...xTokens, ...STABLE_CONTRACTS];
  const groups = await Promise.all(tokens.map((token) => fetchTokenTransfers(cleanWallet, token, currentBlock)));
  const seen = new Set();
  return groups.flat()
    .filter((tx) => {
      const key = `${tx.hash}-${tx.contractAddress}-${tx.from}-${tx.to}-${tx.value}`;
      if (!tx.hash || !tx.contractAddress || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => Number(a.blockNumber || 0) - Number(b.blockNumber || 0));
}

module.exports = {
  fetchMegaNodeTransfers,
  getMegaNodeApiKey,
  getMegaNodeEndpoint,
  hasMegaNodeConfig,
};
