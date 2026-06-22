// DCA Discount Hunter V15.31 - Multi-RPC token balance fallback
// Kept function name fetchBscScanTokenBalance for backward compatibility.
// It no longer calls BscScan/Etherscan paid APIs.
// When the primary RPC returns zero, this helper checks other free BSC RPC endpoints.

const FALLBACK_BSC_RPC_URLS = [
  "https://bsc-dataseed1.bnbchain.org",
  "https://bsc-dataseed2.bnbchain.org",
  "https://bsc-dataseed3.bnbchain.org",
  "https://bsc-dataseed4.bnbchain.org",
  "https://bsc-dataseed1.defibit.io",
  "https://bsc-dataseed1.ninicoin.io",
  "https://bsc-dataseed.binance.org",
];

function cleanAddress(value) {
  return String(value || "").trim();
}

function isEvmAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(cleanAddress(value));
}

function padAddress(address) {
  const clean = cleanAddress(address).toLowerCase().replace(/^0x/, "");
  if (clean.length !== 40) throw new Error(`Invalid address for balanceOf: ${address}`);
  return clean.padStart(64, "0");
}

function hexToBigInt(hex) {
  if (!hex || hex === "0x") return 0n;
  return BigInt(hex);
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
    throw new Error(`RPC returned non-json: ${text.slice(0, 120)}`);
  }

  if (!response.ok || json.error) {
    throw new Error(json.error?.message || `RPC HTTP ${response.status}`);
  }

  return json.result;
}

async function balanceOfViaRpc(rpcUrl, walletAddress, contractAddress) {
  const data = `0x70a08231${padAddress(walletAddress)}`;
  const result = await rpcCall(rpcUrl, "eth_call", [{ to: contractAddress, data }, "latest"]);
  return hexToBigInt(result);
}

async function fetchBscScanTokenBalance(walletAddress, contractAddress) {
  const wallet = cleanAddress(walletAddress);
  const contract = cleanAddress(contractAddress);

  if (!isEvmAddress(wallet)) throw new Error("Invalid wallet address for multi-RPC token balance fallback");
  if (!isEvmAddress(contract)) throw new Error("Invalid contract address for multi-RPC token balance fallback");

  const errors = [];
  let sawZero = false;

  for (const rpcUrl of FALLBACK_BSC_RPC_URLS) {
    try {
      const rawBalance = await balanceOfViaRpc(rpcUrl, wallet, contract);
      if (rawBalance > 0n) return rawBalance.toString();
      sawZero = true;
    } catch (error) {
      errors.push(`${rpcUrl}: ${error.message || "RPC error"}`);
    }
  }

  if (sawZero) return "0";
  throw new Error(`Multi-RPC token balance fallback failed: ${errors.join(" | ")}`);
}

module.exports = { fetchBscScanTokenBalance };
