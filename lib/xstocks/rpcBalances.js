// DCA Discount Hunter V15.27 - BSC RPC balanceOf live wallet scanner
// Reads token balances directly from BNB Chain RPC.
// Priority: verified contract whitelist > wallet transfer contract hints > Binance metadata.
// Every contract scan is kept in contractHoldings for debug, including zero balances.
// Aggregated homepage holdings still include only positive balances.

const { fetchTokenMetadata } = require("./prices");
const { getKnownContracts } = require("./contracts");

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const DEFAULT_BSC_RPC_URLS = [
  "https://bsc-dataseed.binance.org",
  "https://bsc-dataseed1.bnbchain.org",
  "https://bsc-dataseed2.bnbchain.org",
];

function getRpcUrls() {
  const custom = process.env.BSC_RPC_URL || process.env.NEXT_PUBLIC_BSC_RPC_URL;
  if (!custom) return DEFAULT_BSC_RPC_URLS;
  return [custom, ...DEFAULT_BSC_RPC_URLS.filter((url) => url !== custom)];
}

function normalizeAddress(address) {
  return String(address || "").trim().toLowerCase();
}

function upper(value) {
  return String(value || "").trim().toUpperCase();
}

function isEvmAddress(value) {
  return EVM_ADDRESS_RE.test(String(value || "").trim());
}

function normalizeTokenSymbol(symbol) {
  const s = upper(symbol);
  if (!s) return "";
  return s.endsWith("ON") ? s : `${s}ON`;
}

function dedupeTokens(tokens) {
  const map = new Map();
  for (const token of tokens || []) {
    const symbol = normalizeTokenSymbol(token.symbol);
    const contractAddress = normalizeAddress(token.contractAddress);
    if (!symbol || !isEvmAddress(contractAddress)) continue;
    const key = `${symbol}:${contractAddress}`;
    if (map.has(key)) continue;
    map.set(key, {
      symbol,
      ticker: symbol.replace(/ON$/, ""),
      contractAddress,
      decimals: Number(token.decimals || token.tokenDecimal || 18) || 18,
      source: token.source || "unknown_contract_source",
    });
  }
  return [...map.values()];
}

function aggregateHoldingsBySymbol(contractHoldings) {
  const map = new Map();

  for (const holding of contractHoldings || []) {
    const symbol = normalizeTokenSymbol(holding.symbol);
    const quantity = Number(holding.quantity || 0);
    if (!symbol || !Number.isFinite(quantity) || quantity <= 0) continue;

    const existing = map.get(symbol) || {
      symbol,
      quantity: 0,
      totalCost: 0,
      averageCost: 0,
      buyCount: 0,
      firstBuyTimestamp: null,
      lastBuyTimestamp: null,
      source: "bsc_rpc_balanceOf_aggregated",
      contractAddress: null,
      contractAddresses: [],
      sources: [],
      decimals: holding.decimals,
      details: [],
    };

    existing.quantity += quantity;
    if (holding.contractAddress && !existing.contractAddresses.includes(holding.contractAddress)) {
      existing.contractAddresses.push(holding.contractAddress);
    }
    if (holding.source && !existing.sources.includes(holding.source)) {
      existing.sources.push(holding.source);
    }
    existing.details.push({
      symbol,
      quantity,
      rawBalance: holding.rawBalance || null,
      contractAddress: holding.contractAddress || null,
      decimals: holding.decimals,
      source: holding.source || null,
    });
    existing.contractAddress = existing.contractAddresses[0] || null;
    existing.source = existing.sources.length > 1 ? "bsc_rpc_balanceOf_multi_contract" : (existing.sources[0] || "bsc_rpc_balanceOf");

    map.set(symbol, existing);
  }

  return [...map.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
}

function padAddress(address) {
  const clean = normalizeAddress(address).replace(/^0x/, "");
  if (clean.length !== 40) throw new Error(`Invalid address for eth_call: ${address}`);
  return clean.padStart(64, "0");
}

function hexToBigInt(hex) {
  if (!hex || hex === "0x") return 0n;
  return BigInt(hex);
}

function formatUnits(raw, decimals) {
  const d = Number.isFinite(Number(decimals)) ? Number(decimals) : 18;
  const base = 10n ** BigInt(d);
  const whole = raw / base;
  const fraction = raw % base;
  const fractionText = fraction.toString().padStart(d, "0").replace(/0+$/, "");
  return Number(`${whole.toString()}${fractionText ? `.${fractionText}` : ""}`);
}

async function rpcCall(url, method, params) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });

  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`RPC returned non-json: ${text.slice(0, 180)}`);
  }

  if (!response.ok || json.error) {
    throw new Error(json.error?.message || `RPC HTTP ${response.status}`);
  }

  return json.result;
}

async function rpcCallWithFallback(method, params) {
  const errors = [];
  for (const url of getRpcUrls()) {
    try {
      return await rpcCall(url, method, params);
    } catch (error) {
      errors.push(`${url}: ${error.message}`);
    }
  }
  throw new Error(`BSC RPC error: ${errors.join(" | ")}`);
}

async function ethCall(to, data) {
  return rpcCallWithFallback("eth_call", [{ to, data }, "latest"]);
}

async function getCurrentBlockNumber() {
  const result = await rpcCallWithFallback("eth_blockNumber", []);
  return Number.parseInt(result, 16);
}

async function getTokenDecimals(contractAddress, fallbackDecimals = 18) {
  try {
    const result = await ethCall(contractAddress, "0x313ce567");
    const parsed = Number.parseInt(result, 16);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallbackDecimals;
  } catch {
    return fallbackDecimals;
  }
}

async function getBalanceOf(contractAddress, walletAddress) {
  const data = `0x70a08231${padAddress(walletAddress)}`;
  const result = await ethCall(contractAddress, data);
  return hexToBigInt(result);
}

function normalizeContractHints(contractHints) {
  return dedupeTokens((contractHints || []).map((hint) => ({
    symbol: hint?.symbol,
    contractAddress: hint?.contractAddress,
    decimals: hint?.decimals || hint?.tokenDecimal || 18,
    source: hint?.source || "wallet_transfer_contract_hint",
  })));
}

async function fetchMetadataTokens(symbols) {
  try {
    const metadata = await fetchTokenMetadata(symbols);
    return dedupeTokens((metadata || []).map((token) => ({
      symbol: token.symbol,
      contractAddress: token.contractAddress,
      decimals: token.decimals || 18,
      source: "binance_metadata_evm_primary",
    })));
  } catch {
    return [];
  }
}

async function buildTokenList(symbols, contractHints = []) {
  const requested = Array.from(new Set((symbols || []).map(normalizeTokenSymbol).filter(Boolean)));
  const verified = getKnownContracts(requested);
  const verifiedSymbols = new Set(verified.map((token) => upper(token.symbol)));

  const hintTokens = normalizeContractHints(contractHints)
    .filter((token) => requested.includes(upper(token.symbol)))
    .filter((token) => !verifiedSymbols.has(upper(token.symbol)));
  const hintedSymbols = new Set(hintTokens.map((t) => upper(t.symbol)));

  const metadataTargets = requested.filter((symbol) => !verifiedSymbols.has(symbol) && !hintedSymbols.has(symbol));
  const metadata = await fetchMetadataTokens(metadataTargets);

  return dedupeTokens([...verified, ...hintTokens, ...metadata]);
}

async function fetchWalletBalancesViaRpc(walletAddress, symbols, contractHints = []) {
  const cleanWalletAddress = normalizeAddress(walletAddress);
  if (!cleanWalletAddress) throw new Error("walletAddress is empty before RPC balanceOf");

  const tokenMetadata = await buildTokenList(symbols, contractHints);
  const checkedBlockNumber = await getCurrentBlockNumber();
  const contractHoldings = [];
  const errors = [];

  await Promise.all(tokenMetadata.map(async (token) => {
    try {
      if (!isEvmAddress(token.contractAddress)) {
        errors.push(`${token.symbol}: invalid contractAddress ${token.contractAddress || "null"}`);
        return;
      }

      const decimals = await getTokenDecimals(token.contractAddress, token.decimals || 18);
      const rawBalance = await getBalanceOf(token.contractAddress, cleanWalletAddress);
      const quantity = formatUnits(rawBalance, decimals);

      contractHoldings.push({
        symbol: token.symbol,
        quantity,
        rawBalance: rawBalance.toString(),
        totalCost: 0,
        averageCost: 0,
        buyCount: 0,
        firstBuyTimestamp: null,
        lastBuyTimestamp: null,
        source: token.source || "bsc_rpc_balanceOf",
        contractAddress: token.contractAddress,
        decimals,
        isZeroBalance: quantity <= 0,
      });
    } catch (error) {
      errors.push(`${token.symbol}: ${error.message}`);
    }
  }));

  return {
    holdings: aggregateHoldingsBySymbol(contractHoldings),
    contractHoldings: contractHoldings.sort((a, b) => a.symbol.localeCompare(b.symbol)),
    checkedBlockNumber,
    errors,
    tokenMetadata,
  };
}

module.exports = {
  fetchWalletBalancesViaRpc,
};
