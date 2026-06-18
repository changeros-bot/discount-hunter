const BINANCE_LIST_URL = "https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/stock/detail/list/ai";
const BSC_RPC_URLS = [
  process.env.BSC_RPC_URL,
  "https://bsc-dataseed.binance.org",
  "https://bsc-dataseed1.binance.org",
  "https://bsc-dataseed2.binance.org",
  "https://bsc-dataseed3.binance.org",
  "https://bsc-dataseed4.binance.org",
  "https://bsc.publicnode.com"
].filter(Boolean);
const BSC_CHAIN_ID = 56;
const WATCHLIST = ["GOOGLon", "NVDAon", "QQQon", "TSMon", "SPCXon", "AMDon", "MRVLon", "RKLBon", "AVGOon"];

const headers = {
  accept: "application/json, text/plain, */*",
  clienttype: "web",
  lang: "en",
  origin: "https://www.binance.com",
  referer: "https://www.binance.com/en/markets/overview/rwa",
  "user-agent": "discount-hunter-v14-wallet-balance"
};

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data?.list)) return value.data.list;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.list)) return value.list;
  if (Array.isArray(value?.result)) return value.result;
  return [];
}

function getSymbol(item) {
  return item?.symbol || item?.ticker || item?.tokenSymbol || item?.stockSymbol || item?.assetSymbol;
}

function isEvmAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value || ""));
}

function looksLikeBscContext(path, value) {
  const text = `${path} ${String(value || "")}`.toLowerCase();
  return text.includes("bsc") || text.includes("bnb") || text.includes("binance smart chain") || text.includes("binance-smart-chain") || text.includes("56");
}

function collectEvmContracts(node, path = "root", context = "") {
  const results = [];
  if (!node || typeof node !== "object") return results;

  if (Array.isArray(node)) {
    node.forEach((item, index) => {
      results.push(...collectEvmContracts(item, `${path}[${index}]`, context));
    });
    return results;
  }

  const localContextParts = [];
  for (const [key, value] of Object.entries(node)) {
    if (["chainId", "chainID", "network", "chain", "chainName", "networkName", "blockchain"].includes(key)) {
      localContextParts.push(`${key}:${typeof value === "object" ? JSON.stringify(value) : String(value)}`);
    }
  }
  const nextContext = `${context} ${localContextParts.join(" ")}`;

  for (const [key, value] of Object.entries(node)) {
    const currentPath = `${path}.${key}`;
    if (typeof value === "string" && isEvmAddress(value)) {
      results.push({ address: value, path: currentPath, context: nextContext, isBscCandidate: looksLikeBscContext(currentPath, nextContext) });
    } else if (value && typeof value === "object") {
      results.push(...collectEvmContracts(value, currentPath, nextContext));
    }
  }
  return results;
}

function selectContract(item) {
  const directCandidates = [
    { address: item?.contractAddress, path: "contractAddress", context: "direct" },
    { address: item?.address, path: "address", context: "direct" },
    { address: item?.tokenAddress, path: "tokenAddress", context: "direct" }
  ].filter((x) => isEvmAddress(x.address)).map((x) => ({ ...x, isBscCandidate: looksLikeBscContext(x.path, x.context) }));

  const nestedCandidates = collectEvmContracts(item);
  const candidates = [...directCandidates, ...nestedCandidates]
    .filter((x, index, arr) => arr.findIndex((y) => y.address.toLowerCase() === x.address.toLowerCase()) === index);

  const bscCandidate = candidates.find((x) => x.isBscCandidate) || candidates.find((x) => x.context.toLowerCase().includes("chainid:56"));
  return bscCandidate || candidates[0] || null;
}

function padAddress(address) {
  return String(address).toLowerCase().replace(/^0x/, "").padStart(64, "0");
}

function hexToBigInt(hex) {
  if (!hex || hex === "0x") return 0n;
  return BigInt(hex);
}

function formatUnits(value, decimals) {
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const fraction = value % base;
  const text = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  return text ? `${whole}.${text}` : whole.toString();
}

async function rpcCallOne(url, to, data) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] })
    });
    const json = await response.json();
    if (json.error) throw new Error(json.error.message || "rpc_error");
    return json.result;
  } finally {
    clearTimeout(timeout);
  }
}

async function rpcCall(to, data) {
  let lastError = null;
  for (const url of BSC_RPC_URLS) {
    try {
      const result = await rpcCallOne(url, to, data);
      return { result, rpcUrl: url };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("all_rpc_failed");
}

async function getDecimals(contractAddress) {
  try {
    const { result, rpcUrl } = await rpcCall(contractAddress, "0x313ce567");
    const n = Number(hexToBigInt(result));
    return { decimals: Number.isFinite(n) && n >= 0 && n <= 36 ? n : 18, rpcUrl };
  } catch {
    return { decimals: 18, rpcUrl: "fallback_default_18" };
  }
}

async function getBalance(contractAddress, walletAddress, decimals) {
  const data = `0x70a08231${padAddress(walletAddress)}`;
  const { result, rpcUrl } = await rpcCall(contractAddress, data);
  const raw = hexToBigInt(result);
  const balance = formatUnits(raw, decimals);
  return { rawBalance: raw.toString(), balance, quantity: Number(balance), rpcUrl };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  try {
    const walletAddress = String(req.query.address || "").trim();
    if (!isEvmAddress(walletAddress)) {
      return res.status(400).json({ ok: false, error: "invalid_wallet_address", message: "請輸入 0x 開頭的 EVM wallet address。" });
    }

    const response = await fetch(`${BINANCE_LIST_URL}?_=${Date.now()}`, { headers, cache: "no-store" });
    const json = await response.json();
    const tokenList = asArray(json);
    const bySymbol = new Map(tokenList.map((item) => [getSymbol(item), item]).filter(([symbol]) => symbol));

    const holdings = await Promise.all(WATCHLIST.map(async (symbol) => {
      const meta = bySymbol.get(symbol);
      const selected = meta ? selectContract(meta) : null;
      const contractAddress = selected?.address || "";

      if (!meta || !contractAddress) {
        return { symbol, walletAddress, chainId: BSC_CHAIN_ID, contractAddress, found: Boolean(meta), balance: "0", quantity: 0, value: 0, status: "missing_bsc_evm_contract" };
      }

      try {
        const decimalsData = await getDecimals(contractAddress);
        const balanceData = await getBalance(contractAddress, walletAddress, decimalsData.decimals);
        return {
          symbol,
          walletAddress,
          chainId: BSC_CHAIN_ID,
          contractAddress,
          contractSource: selected.path,
          contractContext: selected.context,
          found: true,
          decimals: decimalsData.decimals,
          ...balanceData,
          value: 0,
          source: "Binance xStocks metadata nested BSC contract + BSC balanceOf",
          holdingQuantitySource: "Balance / ERC20 balanceOf",
          status: Number(balanceData.quantity) > 0 ? "holding_found" : "zero_balance",
          decimalsRpcUrl: decimalsData.rpcUrl
        };
      } catch (error) {
        return {
          symbol,
          walletAddress,
          chainId: BSC_CHAIN_ID,
          contractAddress,
          contractSource: selected.path,
          contractContext: selected.context,
          found: true,
          balance: "0",
          quantity: 0,
          value: 0,
          source: "Binance xStocks metadata nested BSC contract + BSC balanceOf",
          holdingQuantitySource: "Balance / ERC20 balanceOf",
          status: error.message || "balance_error"
        };
      }
    }));

    const activeHoldings = holdings.filter((h) => Number(h.quantity || 0) > 0);

    res.status(200).json({
      ok: true,
      version: "14.9-wallet-nested-bsc-contracts",
      walletAddress,
      updatedAt: new Date().toISOString(),
      source: "Binance xStocks metadata + nested BSC/EVM contract discovery + BSC public RPC balanceOf",
      note: "V14.9: recursively searches Binance xStocks metadata for BSC/EVM contract addresses before calling balanceOf.",
      count: holdings.length,
      activeCount: activeHoldings.length,
      totalValue: 0,
      holdings
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: "wallet_holdings_balance_failed", message: error.message });
  }
}
