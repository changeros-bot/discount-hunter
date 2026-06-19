// DCA Discount Hunter V15.5 - Moralis transfer fetcher
// REST-only implementation; no npm dependency required.
// Uses Moralis EVM API ERC20 transfer endpoint for BNB Chain.

const MORALIS_BSC_CHAIN = "bsc";
const DEFAULT_LIMIT = 100;
const MORALIS_BASE_URL = "https://deep-index.moralis.io/api/v2.2";

function norm(value) {
  return String(value || "").trim();
}

function getMoralisApiKey() {
  return process.env.MORALIS_API_KEY || process.env.MORALIS_KEY || "";
}

function hasMoralisKey() {
  return Boolean(getMoralisApiKey());
}

function toUnixSeconds(value) {
  if (!value) return "0";
  const n = Number(value);
  if (Number.isFinite(n) && n > 0) return String(Math.floor(n));
  const d = new Date(value);
  const ms = d.getTime();
  return Number.isFinite(ms) ? String(Math.floor(ms / 1000)) : "0";
}

function pickArray(json) {
  if (Array.isArray(json?.result)) return json.result;
  if (Array.isArray(json?.transfers)) return json.transfers;
  if (Array.isArray(json)) return json;
  return [];
}

function normalizeMoralisTransfer(t) {
  const token = t.token || t.token_metadata || {};
  return {
    blockNumber: String(t.block_number || t.blockNumber || "0"),
    timeStamp: toUnixSeconds(t.block_timestamp || t.blockTimestamp || t.timestamp),
    hash: t.transaction_hash || t.hash || t.tx_hash || "",
    from: norm(t.from_address || t.from || t.fromAddress).toLowerCase(),
    to: norm(t.to_address || t.to || t.toAddress).toLowerCase(),
    contractAddress: norm(t.address || t.token_address || t.contract_address || t.contractAddress).toLowerCase(),
    tokenName: t.token_name || token.name || t.name || "UNKNOWN",
    tokenSymbol: t.token_symbol || token.symbol || t.symbol || "UNKNOWN",
    tokenDecimal: String(t.token_decimals ?? t.decimals ?? token.decimals ?? "18"),
    value: String(t.value || t.raw_value || t.amount || "0"),
  };
}

async function moralisGet(url) {
  const apiKey = getMoralisApiKey();
  if (!apiKey) throw new Error("MORALIS_API_KEY not found");

  const response = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json",
      "X-API-Key": apiKey,
    },
    cache: "no-store",
  });

  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Moralis returned non-json: ${text.slice(0, 180)}`);
  }

  if (!response.ok) {
    throw new Error(json?.message || json?.error || `Moralis HTTP ${response.status}`);
  }

  return json;
}

async function fetchMoralisTokenTransfers(walletAddress) {
  const cleanWallet = norm(walletAddress);
  if (!cleanWallet) throw new Error("walletAddress is empty before Moralis fetch");

  const all = [];
  let cursor = "";
  let guard = 0;

  do {
    const params = new URLSearchParams({
      chain: MORALIS_BSC_CHAIN,
      limit: String(process.env.MORALIS_LIMIT || DEFAULT_LIMIT),
    });
    if (cursor) params.set("cursor", cursor);

    // Moralis EVM API v2.2 ERC20 transfer history endpoint:
    // GET /:address/erc20/transfers?chain=bsc
    const url = `${MORALIS_BASE_URL}/${cleanWallet}/erc20/transfers?${params.toString()}`;
    const json = await moralisGet(url);
    all.push(...pickArray(json).map(normalizeMoralisTransfer));

    cursor = json?.cursor || json?.page_token || json?.next || "";
    guard += 1;
    if (guard > Number(process.env.MORALIS_MAX_PAGES || 20)) break;
  } while (cursor);

  const seen = new Set();
  return all
    .filter((tx) => {
      const key = `${tx.hash}-${tx.contractAddress}-${tx.from}-${tx.to}-${tx.value}`;
      if (!tx.hash || !tx.contractAddress || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => Number(a.blockNumber || 0) - Number(b.blockNumber || 0));
}

module.exports = {
  fetchMoralisTokenTransfers,
  hasMoralisKey,
};
