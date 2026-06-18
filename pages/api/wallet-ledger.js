const BINANCE_LIST_URL = "https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/stock/detail/list/ai";
const BSC_RPC_URL = process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org";
const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY || "";
const BSC_CHAIN_ID = 56;
const USDT_BSC = "0x55d398326f99059ff775485246999027b3197955";
const WATCHLIST = ["GOOGLon", "NVDAon", "QQQon", "TSMon", "SPCXon", "AMDon", "MRVLon", "RKLBon", "AVGOon"];

const headers = {
  accept: "application/json, text/plain, */*",
  clienttype: "web",
  lang: "en",
  origin: "https://www.binance.com",
  referer: "https://www.binance.com/en/markets/overview/rwa",
  "user-agent": "discount-hunter-v15-ledger-debug"
};

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

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

function getContractAddress(item) {
  return item?.contractAddress || item?.address || item?.tokenAddress || "";
}

function isEvmAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value || ""));
}

function normalizeAddress(value) {
  return String(value || "").toLowerCase();
}

function topicToAddress(topic) {
  if (!topic || topic.length < 66) return "";
  return `0x${topic.slice(-40)}`.toLowerCase();
}

function hexToBigInt(hex) {
  if (!hex || hex === "0x") return 0n;
  return BigInt(hex);
}

function formatUnits(value, decimals = 18) {
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const fraction = value % base;
  const text = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  return text ? `${whole}.${text}` : whole.toString();
}

async function rpc(method, params) {
  const response = await fetch(BSC_RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params })
  });
  const json = await response.json();
  if (json.error) throw new Error(json.error.message || "rpc_error");
  return json.result;
}

async function getTokenList() {
  const response = await fetch(`${BINANCE_LIST_URL}?_=${Date.now()}`, { headers, cache: "no-store" });
  const json = await response.json();
  const tokenList = asArray(json);
  const bySymbol = new Map(tokenList.map((item) => [getSymbol(item), item]).filter(([symbol]) => symbol));
  return WATCHLIST.map((symbol) => {
    const meta = bySymbol.get(symbol);
    return {
      symbol,
      chainId: BSC_CHAIN_ID,
      contractAddress: getContractAddress(meta),
      decimals: Number(meta?.decimals || meta?.tokenDecimals || 18),
      found: Boolean(meta && getContractAddress(meta))
    };
  });
}

async function getBscScanTokenTransfers(walletAddress, contractAddress, pageSize = 100) {
  const params = new URLSearchParams({
    module: "account",
    action: "tokentx",
    address: walletAddress,
    contractaddress: contractAddress,
    startblock: "0",
    endblock: "99999999",
    page: "1",
    offset: String(pageSize),
    sort: "desc"
  });
  if (BSCSCAN_API_KEY) params.set("apikey", BSCSCAN_API_KEY);
  const response = await fetch(`https://api.bscscan.com/api?${params.toString()}`, { cache: "no-store" });
  const json = await response.json();
  if (json.status === "0" && !Array.isArray(json.result)) throw new Error(json.message || json.result || "bscscan_error");
  return asArray(json);
}

function parseTransferLogsFromReceipt(receipt, tokenMap, walletAddress) {
  const wallet = normalizeAddress(walletAddress);
  const out = [];
  for (const log of receipt?.logs || []) {
    const address = normalizeAddress(log.address);
    const token = tokenMap.get(address);
    if (!token) continue;
    const topics = log.topics || [];
    if (normalizeAddress(topics[0]) !== TRANSFER_TOPIC) continue;
    const from = topicToAddress(topics[1]);
    const to = topicToAddress(topics[2]);
    if (from !== wallet && to !== wallet) continue;
    const raw = hexToBigInt(log.data);
    const amount = formatUnits(raw, token.decimals || 18);
    out.push({
      token: token.symbol,
      contractAddress: address,
      from,
      to,
      direction: to === wallet ? "in" : "out",
      rawAmount: raw.toString(),
      amount: Number(amount),
      amountText: amount
    });
  }
  return out;
}

async function enrichByReceipts(transfers, tokenMap, walletAddress, maxReceipts = 12) {
  const txHashes = [...new Set(transfers.map((t) => t.hash).filter(Boolean))].slice(0, maxReceipts);
  const receipts = [];
  for (const hash of txHashes) {
    try {
      const receipt = await rpc("eth_getTransactionReceipt", [hash]);
      const decodedTransfers = parseTransferLogsFromReceipt(receipt, tokenMap, walletAddress);
      receipts.push({ hash, to: receipt?.to, from: receipt?.from, status: receipt?.status, decodedTransfers });
    } catch (error) {
      receipts.push({ hash, error: error.message });
    }
  }
  return receipts;
}

function inferTradesFromReceipts(receipts) {
  return receipts.map((receipt) => {
    const xstocksIn = (receipt.decodedTransfers || []).filter((t) => t.token !== "USDT" && t.direction === "in");
    const usdtOut = (receipt.decodedTransfers || []).find((t) => t.token === "USDT" && t.direction === "out");
    const xstocksOut = (receipt.decodedTransfers || []).filter((t) => t.token !== "USDT" && t.direction === "out");
    const usdtIn = (receipt.decodedTransfers || []).find((t) => t.token === "USDT" && t.direction === "in");

    if (xstocksIn.length && usdtOut) {
      return xstocksIn.map((x) => ({
        hash: receipt.hash,
        side: "buy",
        symbol: x.token,
        tokenAmount: x.amount,
        usdtAmount: usdtOut.amount,
        estimatedAveragePrice: x.amount > 0 ? usdtOut.amount / x.amount : null,
        router: receipt.to
      }));
    }

    if (xstocksOut.length && usdtIn) {
      return xstocksOut.map((x) => ({
        hash: receipt.hash,
        side: "sell",
        symbol: x.token,
        tokenAmount: x.amount,
        usdtAmount: usdtIn.amount,
        estimatedAveragePrice: x.amount > 0 ? usdtIn.amount / x.amount : null,
        router: receipt.to
      }));
    }

    return [{ hash: receipt.hash, side: "unknown", router: receipt.to, decodedTransfers: receipt.decodedTransfers || [] }];
  }).flat();
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

    const limit = Math.min(Number(req.query.limit || 30), 100);
    const tokens = await getTokenList();
    const knownTokens = [
      ...tokens.filter((t) => t.found),
      { symbol: "USDT", contractAddress: USDT_BSC, decimals: 18, chainId: BSC_CHAIN_ID, found: true }
    ];
    const tokenMap = new Map(knownTokens.map((t) => [normalizeAddress(t.contractAddress), t]));

    const transferBatches = await Promise.all(tokens.filter((t) => t.found).map(async (token) => {
      try {
        const rows = await getBscScanTokenTransfers(walletAddress, token.contractAddress, limit);
        return { symbol: token.symbol, contractAddress: token.contractAddress, ok: true, count: rows.length, rows };
      } catch (error) {
        return { symbol: token.symbol, contractAddress: token.contractAddress, ok: false, error: error.message, rows: [] };
      }
    }));

    const flatTransfers = transferBatches.flatMap((batch) => batch.rows.map((row) => ({ ...row, trackedSymbol: batch.symbol })));
    const receipts = await enrichByReceipts(flatTransfers, tokenMap, walletAddress, Number(req.query.receipts || 12));
    const inferredTrades = inferTradesFromReceipts(receipts);

    res.status(200).json({
      ok: true,
      version: "15.0-ledger-debug",
      walletAddress,
      updatedAt: new Date().toISOString(),
      source: "Binance xStocks metadata + BscScan tokentx + BSC RPC receipts",
      requires: BSCSCAN_API_KEY ? "BSCSCAN_API_KEY configured" : "BscScan free/no-key mode; may be rate-limited",
      tokenCount: tokens.length,
      transferBatchCount: transferBatches.length,
      receiptCount: receipts.length,
      tradeCount: inferredTrades.length,
      tokens,
      transferBatches,
      receipts,
      inferredTrades
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: "wallet_ledger_failed", message: error.message });
  }
}
