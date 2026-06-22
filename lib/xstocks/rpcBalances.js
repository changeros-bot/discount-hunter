// DCA Discount Hunter V15.15 - BSC RPC balanceOf live wallet scanner
// Reads token balances directly from BNB Chain RPC.
// Priority: wallet transfer contract hints > verified fallback mapping > Binance metadata.

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
  const map = new Map();
  for (const hint of contractHints || []) {
    const symbol = normalizeTokenSymbol(hint?.symbol);
    const contractAddress = normalizeAddress(hint?.contractAddress);
    if (!symbol || !isEvmAddress(contractAddress)) continue;
    const key = `${symbol}:${contractAddress}`;
    if (map.has(key)) continue;
    map.set(key, {
      symbol,
      ticker: symbol.replace(/ON$/, ""),
      contractAddress,
      decimals: Number(hint.decimals || hint.tokenDecimal || 18) || 18,
      source: hint.source || "wallet_transfer_contract_hint",
    });
  }
  return [...map.values()];
}

async function buildTokenList(symbols, contractHints = []) {
  const requested = (symbols || []).map(normalizeTokenSymbol).filter(Boolean);
  const hintTokens = normalizeContractHints(contractHints).filter((token) => requested.includes(upper(token.symbol)));
  const hintedSymbols = new Set(hintTokens.map((t) => upper(t.symbol)));

  // Only use old verified/static contracts for symbols that do not have wallet-derived contract hints.
  // This prevents stale hardcoded addresses from overriding the actual tokens seen in the wallet.
  const staticCandidates = requested.filter((symbol) => !hintedSymbols.has(symbol));
  const verified = getKnownContracts(staticCandidates);
  const verifiedSymbols = new Set(verified.map((t) => upper(t.symbol)));

  let metadata = [];
  const missingSymbols = staticCandidates.filter((symbol) => !verifiedSymbols.has(symbol));
  if (missingSymbols.length > 0) {
    try {
      metadata = (await fetchTokenMetadata(missingSymbols))
        .filter((token) => isEvmAddress(token.contractAddress))
        .map((token) => ({
          symbol: normalizeTokenSymbol(token.symbol),
          ticker: normalizeTokenSymbol(token.symbol).replace(/ON$/, ""),
          contractAddress: normalizeAddress(token.contractAddress),
          decimals: 18,
          source: "binance_metadata_evm_fallback",
        }));
    } catch {
      metadata = [];
    }
  }

  return [...hintTokens, ...verified, ...metadata];
}

async function fetchWalletBalancesViaRpc(walletAddress, symbols, contractHints = []) {
  const cleanWalletAddress = normalizeAddress(walletAddress);
  if (!cleanWalletAddress) throw new Error("walletAddress is empty before RPC balanceOf");

  const tokenMetadata = await buildTokenList(symbols, contractHints);
  const checkedBlockNumber = await getCurrentBlockNumber();
  const holdings = [];
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

      if (quantity > 0) {
        holdings.push({
          symbol: token.symbol,
          quantity,
          totalCost: 0,
          averageCost: 0,
          buyCount: 0,
          firstBuyTimestamp: null,
          lastBuyTimestamp: null,
          source: token.source || "bsc_rpc_balanceOf",
          contractAddress: token.contractAddress,
          decimals,
        });
      }
    } catch (error) {
      errors.push(`${token.symbol}: ${error.message}`);
    }
  }));

  return {
    holdings: holdings.sort((a, b) => a.symbol.localeCompare(b.symbol)),
    checkedBlockNumber,
    errors,
    tokenMetadata,
  };
}

module.exports = {
  fetchWalletBalancesViaRpc,
};
