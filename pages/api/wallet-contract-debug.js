const BINANCE_LIST_URL = "https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/stock/detail/list/ai";
const WATCHLIST = ["GOOGLon", "NVDAon", "QQQon", "TSMon", "SPCXon", "AMDon", "MRVLon", "RKLBon", "AVGOon"];

const headers = {
  accept: "application/json, text/plain, */*",
  clienttype: "web",
  lang: "en",
  origin: "https://www.binance.com",
  referer: "https://www.binance.com/en/markets/overview/rwa",
  "user-agent": "discount-hunter-contract-debug"
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
      results.push({
        address: value,
        path: currentPath,
        context: nextContext.trim(),
        isBscCandidate: looksLikeBscContext(currentPath, nextContext)
      });
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
  return { selected: bscCandidate || candidates[0] || null, candidates };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  try {
    const response = await fetch(`${BINANCE_LIST_URL}?_=${Date.now()}`, { headers, cache: "no-store" });
    const json = await response.json();
    const tokenList = asArray(json);
    const bySymbol = new Map(tokenList.map((item) => [getSymbol(item), item]).filter(([symbol]) => symbol));

    const results = WATCHLIST.map((symbol) => {
      const item = bySymbol.get(symbol);
      const { selected, candidates } = item ? selectContract(item) : { selected: null, candidates: [] };
      return {
        symbol,
        found: Boolean(item),
        selected,
        candidateCount: candidates.length,
        candidates,
        topLevelKeys: item ? Object.keys(item) : []
      };
    });

    res.status(200).json({
      ok: true,
      version: "contract-debug-v1",
      itemCount: tokenList.length,
      matchedCount: results.filter((r) => r.found).length,
      results
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: "contract_debug_failed", message: error.message });
  }
}
