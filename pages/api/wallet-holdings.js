const BINANCE_LIST_URL = "https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/stock/detail/list/ai";

const WATCHLIST = ["NVDAon", "TSMon", "AMDon", "AVGOon", "MRVLon", "VRTon", "RKLBon", "LITEon", "SPCXon"];

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

    const holdings = WATCHLIST.map((symbol) => {
      const meta = bySymbol.get(symbol);
      const chainId = getChainId(meta);
      const contractAddress = getContractAddress(meta);
      return {
        symbol,
        walletAddress,
        chainId,
        contractAddress,
        found: Boolean(meta && contractAddress),
        balance: "0",
        quantity: 0,
        value: 0,
        source: "Binance xStocks metadata ready; on-chain balance connector pending",
        status: meta && contractAddress ? "metadata_ready" : "missing_contract"
      };
    });

    res.status(200).json({
      ok: true,
      version: "14.0-wallet-metadata",
      walletAddress,
      updatedAt: new Date().toISOString(),
      source: "Binance xStocks metadata",
      note: "V14 first step: wallet address and token contract mapping are ready. BalanceOf sync will be enabled after RPC provider is configured.",
      count: holdings.length,
      activeCount: 0,
      totalValue: 0,
      holdings
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: "wallet_holdings_metadata_failed", message: error.message });
  }
}
