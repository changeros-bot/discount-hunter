const BINANCE_LIST_URL = "https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/stock/detail/list/ai";
const BSC_RPC_URL = process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org";

// V14 holding rule: current position quantity must use wallet Balance / ERC20 balanceOf, not Bought.
// Actual Josh wallet baseline: 9 BSC xStocks currently held in Binance Wallet.
const WATCHLIST = ["GOOGLon", "NVDAon", "QQQon", "TSMon", "SPCXon", "AMDon", "MRVLon", "RKLBon", "AVGOon"];

const headers = {
  accept: "application/json, text/plain, */*",
  clienttype: "web",
  lang: "en",
  origin: "https://www.binance.com",
  referer: "https://www.binance.com/en/markets/overview/rwa",
  "user-agent": "discount-hunter-v14"
};

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data?.list)) return value.data.list;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.list)) return value.list;
  return [];
}

function getSymbol(item) {
  return item?.symbol || item?.ticker || item?.tokenSymbol || item?.stockSymbol || item?.assetSymbol;
}

function getContractAddress(item) {
  return item?.contractAddress || item?.address || item?.tokenAddress || "";
}

function getChainId(item) {
  return Number(item?.chainId || item?.chainID || item?.chain?.id || 56);
}

function isEvmAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value || ""));
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

async function rpcCall(url, to, data) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] })
  });
  const json = await response.json();
  if (json.error) throw new Error(json.error.message || "rpc_error");
  return json.result;
}

async function getDecimals(chainId, contractAddress) {
  if (chainId !== 56) return 18;
  try {
    const result = await rpcCall(BSC_RPC_URL, contractAddress, "0x313ce567");
    const n = Number(hexToBigInt(result));
    return Number.isFinite(n) && n >= 0 && n <= 36 ? n : 18;
  } catch {
    return 18;
  }
}

async function getBalance(chainId, contractAddress, walletAddress, decimals) {
  if (chainId !== 56) throw new Error("unsupported_chain");
  const data = `0x70a08231${padAddress(walletAddress)}`;
  const result = await rpcCall(BSC_RPC_URL, contractAddress, data);
  const raw = hexToBigInt(result);
  const balance = formatUnits(raw, decimals);
  return { rawBalance: raw.toString(), balance, quantity: Number(balance) };
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
      const chainId = getChainId(meta);
      const contractAddress = getContractAddress(meta);

      if (!meta || !contractAddress) {
        return { symbol, walletAddress, chainId, contractAddress, found: false, balance: "0", quantity: 0, value: 0, status: "missing_contract" };
      }

      try {
        const decimals = await getDecimals(chainId, contractAddress);
        const balanceData = await getBalance(chainId, contractAddress, walletAddress, decimals);
        return {
          symbol,
          walletAddress,
          chainId,
          contractAddress,
          found: true,
          decimals,
          ...balanceData,
          value: 0,
          source: "Binance xStocks metadata + BSC balanceOf",
          holdingQuantitySource: "Balance / ERC20 balanceOf",
          status: Number(balanceData.quantity) > 0 ? "holding_found" : "zero_balance"
        };
      } catch (error) {
        return {
          symbol,
          walletAddress,
          chainId,
          contractAddress,
          found: true,
          balance: "0",
          quantity: 0,
          value: 0,
          source: "Binance xStocks metadata",
          holdingQuantitySource: "Balance / ERC20 balanceOf",
          status: error.message || "balance_error"
        };
      }
    }));

    const activeHoldings = holdings.filter((h) => Number(h.quantity || 0) > 0);

    res.status(200).json({
      ok: true,
      version: "14.1-wallet-balance-bsc",
      walletAddress,
      updatedAt: new Date().toISOString(),
      source: "Binance xStocks metadata + BSC public RPC balanceOf",
      note: "V14.1: current holding quantity uses Balance / ERC20 balanceOf, not Bought. Cost basis is tracked separately.",
      count: holdings.length,
      activeCount: activeHoldings.length,
      totalValue: 0,
      holdings
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: "wallet_holdings_balance_failed", message: error.message });
  }
}
