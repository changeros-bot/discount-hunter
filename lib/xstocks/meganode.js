// DCA Discount Hunter V15.4 - MegaNode / NodeReal transfer fetcher
// Uses BSCTrace enhanced API nr_getAssetTransfers as the primary wallet-wide transfer source.

const DEFAULT_PAGE_SIZE = 1000;
const BSC_CHAIN_ENDPOINT_BASE = "https://bsc-mainnet.nodereal.io/v1";

function norm(value) {
  return String(value || "").trim();
}

function firstEnv(names = []) {
  for (const name of names) {
    const value = norm(process.env[name]);
    if (value) return value;
  }
  return "";
}

function getMegaNodeApiKey() {
  return firstEnv([
    "MEGANODE_API_KEY",
    "MEGA_NODE_API_KEY",
    "MEGANODE_KEY",
    "MEGA_NODE_KEY",
    "NODEREAL_API_KEY",
    "NODE_REAL_API_KEY",
    "NODEREAL_APIKEY",
    "NODE_REAL_APIKEY",
    "NODEREAL_KEY",
    "NODE_REAL_KEY",
    "NODEREAL_BSC_API_KEY",
    "NODEREAL_BSC_MAINNET_API_KEY",
  ]);
}

function getMegaNodeEndpoint() {
  const custom = firstEnv([
    "MEGANODE_ENDPOINT",
    "MEGA_NODE_ENDPOINT",
    "NODEREAL_ENDPOINT",
    "NODE_REAL_ENDPOINT",
    "NODEREAL_BSC_ENDPOINT",
    "NODEREAL_BSC_MAINNET_ENDPOINT",
  ]);
  if (custom) return custom;

  const apiKey = getMegaNodeApiKey();
  if (!apiKey) return "";
  return `${BSC_CHAIN_ENDPOINT_BASE}/${apiKey}`;
}

function hasMegaNodeConfig() {
  return Boolean(getMegaNodeEndpoint());
}

async function megaNodeRpc(method, params) {
  const endpoint = getMegaNodeEndpoint();
  if (!endpoint) throw new Error("MEGANODE / NODEREAL API key or endpoint not found");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    }),
  });

  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`MegaNode returned non-json: ${text.slice(0, 180)}`);
  }

  if (!response.ok || json.error) {
    throw new Error(json.error?.message || `MegaNode HTTP ${response.status}`);
  }

  return json.result;
}

function pickTransfers(result) {
  if (Array.isArray(result?.transfers)) return result.transfers;
  if (Array.isArray(result?.result)) return result.result;
  if (Array.isArray(result)) return result;
  return [];
}

function pickNextPageToken(result) {
  return result?.page?.pageToken || result?.pageKey || result?.nextPageToken || result?.cursor || "";
}

function normalizeMegaNodeTransfer(t, fallbackWallet) {
  const asset = t.asset || t.rawContract || t.token || {};
  const metadata = t.metadata || {};
  const blockTimestamp = metadata.blockTimestamp || t.blockTimestamp || t.timeStamp || t.timestamp;
  const ts = blockTimestamp
    ? Math.floor(new Date(blockTimestamp).getTime() / 1000).toString()
    : "0";

  return {
    blockNumber: String(t.blockNum || t.blockNumber || metadata.blockNumber || "0"),
    timeStamp: ts,
    hash: t.hash || t.transactionHash || t.txHash || "",
    from: norm(t.from || t.fromAddress).toLowerCase(),
    to: norm(t.to || t.toAddress || fallbackWallet).toLowerCase(),
    contractAddress: norm(asset.address || t.assetAddress || t.contractAddress || t.rawContract?.address).toLowerCase(),
    tokenName: asset.name || t.assetName || t.tokenName || asset.symbol || "UNKNOWN",
    tokenSymbol: asset.symbol || t.assetSymbol || t.tokenSymbol || "UNKNOWN",
    tokenDecimal: String(asset.decimals ?? t.decimals ?? t.tokenDecimal ?? "18"),
    value: String(t.value || t.rawValue || t.amount || "0"),
  };
}

async function fetchTransfersByDirection(walletAddress, direction) {
  const cleanWallet = norm(walletAddress).toLowerCase();
  const allTransfers = [];
  let pageToken = "";
  let guard = 0;

  do {
    const filter = {
      category: ["erc20"],
      withMetadata: true,
      excludeZeroValue: false,
      pageSize: Number(process.env.MEGANODE_PAGE_SIZE || DEFAULT_PAGE_SIZE),
    };

    if (direction === "out") filter.fromAddress = cleanWallet;
    else filter.toAddress = cleanWallet;

    if (pageToken) filter.pageToken = pageToken;

    const result = await megaNodeRpc("nr_getAssetTransfers", [filter]);
    const transfers = pickTransfers(result).map((t) => normalizeMegaNodeTransfer(t, cleanWallet));
    allTransfers.push(...transfers);

    pageToken = pickNextPageToken(result);
    guard += 1;
    if (guard > Number(process.env.MEGANODE_MAX_PAGES || 20)) break;
  } while (pageToken);

  return allTransfers;
}

async function fetchMegaNodeTransfers(walletAddress) {
  const inbound = await fetchTransfersByDirection(walletAddress, "in");
  const outbound = await fetchTransfersByDirection(walletAddress, "out");
  const seen = new Set();

  return [...inbound, ...outbound]
    .filter((tx) => {
      const key = `${tx.hash}-${tx.contractAddress}-${tx.from}-${tx.to}-${tx.value}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return Boolean(tx.hash && tx.contractAddress);
    })
    .sort((a, b) => Number(a.blockNumber || 0) - Number(b.blockNumber || 0));
}

module.exports = {
  fetchMegaNodeTransfers,
  getMegaNodeApiKey,
  getMegaNodeEndpoint,
  hasMegaNodeConfig,
};
