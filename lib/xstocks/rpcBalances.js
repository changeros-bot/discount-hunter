// DCA Discount Hunter V15.2 - BSC RPC balanceOf fallback
// Reads token balances directly from BNB Chain RPC without explorer API keys.

const { fetchTokenMetadata } = require("./prices");

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

function padAddress(address) {
  const clean = normalizeAddress(address).replace(/^0x/, "");
  if (clean.length !== 40) throw new Error(`Invalid address for eth_call: ${address}`);
  return clean.padStart(64, "0");
}

function numberToHexQuantity(value) {
  const n = Number(value || 0);
  return `0x${Math.max(0, Math.floor(n)).toString(16)}`;
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

async function getTokenDecimals(contractAddress) {
  try {
    const result = await ethCall(contractAddress, "0x313ce567");
    return Number.parseInt(result, 16);
  } catch {
    return 18;
  }
}

async function getBalanceOf(contractAddress, walletAddress) {
  const data = `0x70a08231${padAddress(walletAddress)}`;
  const result = await ethCall(contractAddress, data);
  return hexToBigInt(result);
}

async function fetchWalletBalancesViaRpc(walletAddress, symbols) {
  const cleanWalletAddress = normalizeAddress(walletAddress);
  if (!cleanWalletAddress) throw new Error("walletAddress is empty before RPC balanceOf");

  const tokenMetadata = await fetchTokenMetadata(symbols);
  const checkedBlockNumber = await getCurrentBlockNumber();
  const holdings = [];
  const errors = [];

  await Promise.all(tokenMetadata.map(async (token) => {
    try {
      if (!token.contractAddress) return;
      const decimals = await getTokenDecimals(token.contractAddress);
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
          source: "bsc_rpc_balanceOf",
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
  };
}

module.exports = {
  fetchWalletBalancesViaRpc,
};
