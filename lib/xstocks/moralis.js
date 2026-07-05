// DCA Discount Hunter V15.8 - Moralis transfer fetcher
// REST-only implementation; no npm dependency required.
// Uses Moralis EVM API ERC20 transfer endpoint for BNB Chain.
// Narrows queries to known xStock contracts + USDT so wallet-level scans do not return empty/noisy results.

const { XSTOCK_CONTRACTS } = require("./contracts");

const MORALIS_BSC_CHAINS = ["bsc", "0x38"];
const DEFAULT_LIMIT = 100;
const MORALIS_BASE_URL = "https://deep-index.moralis.io/api/v2.2";
const STABLE_CONTRACTS = [
  "0x55d398326f99059ff775485246999027b3197955", // Binance-Peg BSC-USD / USDT
  "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", // Binance-Peg USDC
  "0xe9e7cea3dedca5984780bafc599bd69add087d56", // BUSD
];

function norm(value) { return String(value || "").trim(); }
function lower(value) { return norm(value).toLowerCase(); }
function uniq(values) { return [...new Set((values || []).map(lower).filter(Boolean))]; }

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
function pickDecimalAmount(t) {
  const candidates = [t.value_decimal, t.valueDecimal, t.amount_decimal, t.amountDecimal, t.amount_formatted, t.amountFormatted, t.decimal];
  for (const value of candidates) {
    const str = norm(value);
    if (!str) continue;
    const n = Number(str);
    if (Number.isFinite(n)) return str;
  }
  return "";
}
function normalizeMoralisTransfer(t) {
  const token = t.token || t.token_metadata || {};
  const rawValue = norm(t.value || t.raw_value || t.rawValue || "0");
  const decimalValue = pickDecimalAmount(t);
  return {
    blockNumber: String(t.block_number || t.blockNumber || "0"),
    timeStamp: toUnixSeconds(t.block_timestamp || t.blockTimestamp || t.timestamp),
    hash: t.transaction_hash || t.hash || t.tx_hash || "",
    from: lower(t.from_address || t.from || t.fromAddress),
    to: lower(t.to_address || t.to || t.toAddress),
    contractAddress: lower(t.address || t.token_address || t.contract_address || t.contractAddress),
    tokenName: t.token_name || token.name || t.name || "UNKNOWN",
    tokenSymbol: t.token_symbol || token.symbol || t.symbol || "UNKNOWN",
    tokenDecimal: String(t.token_decimals ?? t.decimals ?? token.decimals ?? "18"),
    value: rawValue,
    valueDecimal: decimalValue,
    amountFormatted: decimalValue,
    moralisRaw: {
      value: t.value,
      raw_value: t.raw_value,
      value_decimal: t.value_decimal,
      amount_formatted: t.amount_formatted,
      decimals: t.token_decimals ?? t.decimals ?? token.decimals,
    },
  };
}
async function moralisGet(url) {
  const apiKey = getMoralisApiKey();
  if (!apiKey) throw new Error("MORALIS_API_KEY not found");
  const response = await fetch(url, {
    method: "GET",
    headers: { accept: "application/json", "X-API-Key": apiKey },
    cache: "no-store",
  });
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error(`Moralis returned non-json: ${text.slice(0, 180)}`); }
  if (!response.ok) throw new Error(json?.message || json?.error || `Moralis HTTP ${response.status}`);
  return json;
}
function getContractAddressFilter() {
  const xStocks = Object.values(XSTOCK_CONTRACTS).map((t) => t.contractAddress);
  const configured = norm(process.env.MORALIS_CONTRACT_ADDRESSES).split(",").map(norm).filter(Boolean);
  return uniq([...xStocks, ...STABLE_CONTRACTS, ...configured]);
}
function appendContractFilters(params, contracts) {
  // Moralis documents contract_addresses as a string[] query param. Try both common encodings.
  // URLSearchParams keeps repeated keys in order.
  contracts.forEach((address) => params.append("contract_addresses", address));
  contracts.forEach((address) => params.append("contract_addresses[]", address));
}
async function fetchMoralisForChain(walletAddress, chain) {
  const contracts = getContractAddressFilter();
  const all = [];
  let cursor = "";
  let guard = 0;
  do {
    const params = new URLSearchParams({
      chain,
      limit: String(process.env.MORALIS_LIMIT || DEFAULT_LIMIT),
      order: "ASC",
    });
    appendContractFilters(params, contracts);
    if (cursor) params.set("cursor", cursor);
    const fromBlock = norm(process.env.MORALIS_FROM_BLOCK || process.env.XSTOCKS_TRANSFER_START_BLOCK);
    const toBlock = norm(process.env.MORALIS_TO_BLOCK || process.env.XSTOCKS_TRANSFER_END_BLOCK);
    if (fromBlock) params.set("from_block", fromBlock);
    if (toBlock) params.set("to_block", toBlock);

    const url = `${MORALIS_BASE_URL}/${walletAddress}/erc20/transfers?${params.toString()}`;
    const json = await moralisGet(url);
    all.push(...pickArray(json).map(normalizeMoralisTransfer));
    cursor = json?.cursor || json?.page_token || json?.next || "";
    guard += 1;
    if (guard > Number(process.env.MORALIS_MAX_PAGES || 30)) break;
  } while (cursor);
  return all;
}
async function fetchMoralisTokenTransfers(walletAddress) {
  const cleanWallet = norm(walletAddress);
  if (!cleanWallet) throw new Error("walletAddress is empty before Moralis fetch");

  const errors = [];
  for (const chain of MORALIS_BSC_CHAINS) {
    try {
      const rows = await fetchMoralisForChain(cleanWallet, chain);
      if (rows.length > 0) return dedupe(rows);
      errors.push(`chain ${chain} returned 0`);
    } catch (error) {
      errors.push(`chain ${chain}: ${error.message}`);
    }
  }
  if (errors.some((e) => !e.includes("returned 0"))) throw new Error(errors.join(" | "));
  return [];
}
function dedupe(rows) {
  const seen = new Set();
  return rows
    .filter((tx) => {
      const key = `${tx.hash}-${tx.contractAddress}-${tx.from}-${tx.to}-${tx.value}-${tx.valueDecimal}`;
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
