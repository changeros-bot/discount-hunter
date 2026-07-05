// DCA Discount Hunter - Public BSC RPC transfer fetcher
// Free fallback for ERC20 Transfer logs when NodeReal quota is exhausted and Etherscan V2 BSC is unavailable.
// Uses standard eth_getLogs with wallet-topic filters, then filters known xStock/stablecoin contracts locally.

const { XSTOCK_CONTRACTS } = require("./contracts");

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const DEFAULT_ENDPOINTS = [
  "https://bsc-dataseed.binance.org/",
  "https://bsc-dataseed1.binance.org/",
  "https://bsc-dataseed2.binance.org/",
  "https://bsc-dataseed3.binance.org/",
  "https://bsc-rpc.publicnode.com",
];
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
function uniq(values) { return [...new Set((values || []).map(norm).filter(Boolean))]; }
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function envList(name) { return norm(process.env[name]).split(",").map(norm).filter(Boolean); }
function getPublicRpcEndpoints() {
  return uniq([
    ...envList("PUBLIC_BSC_RPC_URLS"),
    ...envList("BSC_PUBLIC_RPC_URLS"),
    norm(process.env.PUBLIC_BSC_RPC_URL),
    norm(process.env.BSC_PUBLIC_RPC_URL),
    norm(process.env.BSC_RPC_URL),
    ...DEFAULT_ENDPOINTS,
  ]);
}
function hasPublicRpcConfig() { return getPublicRpcEndpoints().length > 0; }

async function rpc(method, params) {
  const endpoints = getPublicRpcEndpoints();
  const errors = [];
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
      });
      const text = await response.text();
      let json;
      try { json = JSON.parse(text); } catch { throw new Error(`non-json: ${text.slice(0, 140)}`); }
      if (!response.ok || json.error) throw new Error(json.error?.message || `HTTP ${response.status}`);
      return json.result;
    } catch (error) {
      errors.push(`${endpoint}: ${error.message}`);
    }
  }
  throw new Error(`Public BSC RPC failed: ${errors.join(" | ")}`);
}

async function getBlockNumber() {
  const hex = await rpc("eth_blockNumber", []);
  return parseInt(hex, 16);
}

function buildTokenMeta() {
  const xTokens = Object.values(XSTOCK_CONTRACTS).map((t) => ({
    symbol: t.symbol,
    tokenName: t.symbol,
    contractAddress: t.contractAddress,
    decimals: t.decimals || 18,
  }));
  const tokens = [...xTokens, ...STABLE_CONTRACTS];
  const map = new Map();
  for (const token of tokens) map.set(lower(token.contractAddress), token);
  return { tokens, map };
}

function logToTransfer(log, tokenMap) {
  const topics = log.topics || [];
  const tokenMeta = tokenMap.get(lower(log.address));
  if (!tokenMeta) return null;
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

async function getKnownLogsInChunks(filterBase, tokenMap, fromBlock, toBlock) {
  const logs = [];
  const chunkSize = Number(process.env.PUBLIC_BSC_RPC_LOG_CHUNK_SIZE || process.env.BSC_RPC_LOG_CHUNK_SIZE || 10000);
  const delayMs = Number(process.env.PUBLIC_BSC_RPC_DELAY_MS || process.env.BSC_RPC_DELAY_MS || 80);
  const maxChunks = Number(process.env.PUBLIC_BSC_RPC_MAX_CHUNKS || process.env.BSC_RPC_MAX_CHUNKS || 80);
  let stop = Math.max(0, Number(toBlock || 0));
  const floor = Math.max(0, Number(fromBlock || 0));
  let chunks = 0;

  while (stop >= floor && chunks < maxChunks) {
    const start = Math.max(floor, stop - chunkSize + 1);
    const rows = await rpc("eth_getLogs", [{ ...filterBase, fromBlock: toHex(start), toBlock: toHex(stop) }]);
    if (Array.isArray(rows)) {
      for (const row of rows) if (tokenMap.has(lower(row.address))) logs.push(row);
    }
    stop = start - 1;
    chunks += 1;
    if (delayMs > 0) await sleep(delayMs);
  }
  return logs;
}

async function fetchPublicRpcTransfers(walletAddress) {
  const cleanWallet = lower(walletAddress);
  if (!/^0x[a-f0-9]{40}$/.test(cleanWallet)) throw new Error("walletAddress is invalid before public RPC fetch");

  const currentBlock = await getBlockNumber();
  const lookbackBlocks = Number(process.env.PUBLIC_BSC_RPC_LOOKBACK_BLOCKS || process.env.XSTOCKS_TRANSFER_LOOKBACK_BLOCKS || 800000);
  const fromBlock = Number(process.env.XSTOCKS_TRANSFER_START_BLOCK || process.env.PUBLIC_BSC_RPC_START_BLOCK || Math.max(0, currentBlock - lookbackBlocks));
  const toBlock = Number(process.env.XSTOCKS_TRANSFER_END_BLOCK || process.env.PUBLIC_BSC_RPC_END_BLOCK || currentBlock);
  const walletTopic = padTopicAddress(cleanWallet);
  const { map } = buildTokenMeta();

  // Do not pass address arrays to public RPC nodes. Some nodes block params.0.address arrays.
  // Query by indexed wallet topics, then keep only known xStock/stablecoin contracts locally.
  const inboundFilter = { topics: [TRANSFER_TOPIC, null, walletTopic] };
  const outboundFilter = { topics: [TRANSFER_TOPIC, walletTopic, null] };
  const inLogs = await getKnownLogsInChunks(inboundFilter, map, fromBlock, toBlock);
  const outLogs = await getKnownLogsInChunks(outboundFilter, map, fromBlock, toBlock);

  const seen = new Set();
  return [...inLogs, ...outLogs].map((log) => logToTransfer(log, map)).filter(Boolean)
    .filter((tx) => {
      const key = `${tx.hash}-${tx.contractAddress}-${tx.from}-${tx.to}-${tx.value}`;
      if (!tx.hash || !tx.contractAddress || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => Number(a.blockNumber || 0) - Number(b.blockNumber || 0));
}

module.exports = {
  fetchPublicRpcTransfers,
  hasPublicRpcConfig,
  getPublicRpcEndpoints,
};
