// DCA Discount Hunter - BscScan / Etherscan V2 BEP20 transfer fallback
// Etherscan API V2: BSC uses chainid=56.
// Normalizes rows into the same transfer shape used by Moralis / MegaNode.

const ETHERSCAN_V2_URL = "https://api.etherscan.io/v2/api";

function norm(value) {
  return String(value || "").trim();
}

function getBscScanApiKey() {
  return process.env.BSCSCAN_API_KEY || process.env.BSC_SCAN_API_KEY || process.env.ETHERSCAN_API_KEY || "";
}

function hasBscScanKey() {
  return Boolean(getBscScanApiKey());
}

function toUnixSeconds(value) {
  if (!value) return "0";
  const n = Number(value);
  if (Number.isFinite(n) && n > 0) return String(Math.floor(n));
  const d = new Date(value);
  const ms = d.getTime();
  return Number.isFinite(ms) ? String(Math.floor(ms / 1000)) : "0";
}

function normalizeBscScanTransfer(t) {
  return {
    blockNumber: String(t.blockNumber || "0"),
    timeStamp: toUnixSeconds(t.timeStamp || t.block_timestamp),
    hash: t.hash || t.transactionHash || "",
    from: norm(t.from || t.fromAddress).toLowerCase(),
    to: norm(t.to || t.toAddress).toLowerCase(),
    contractAddress: norm(t.contractAddress || t.tokenAddress).toLowerCase(),
    tokenName: t.tokenName || t.token_name || "UNKNOWN",
    tokenSymbol: t.tokenSymbol || t.token_symbol || "UNKNOWN",
    tokenDecimal: String(t.tokenDecimal ?? t.token_decimals ?? "18"),
    value: String(t.value || "0"),
    bscscanRaw: {
      tokenSymbol: t.tokenSymbol,
      tokenName: t.tokenName,
      value: t.value,
      tokenDecimal: t.tokenDecimal,
    },
  };
}

async function fetchBep20Transfers(walletAddress) {
  const apiKey = getBscScanApiKey();
  if (!apiKey) throw new Error("BSCSCAN_API_KEY / ETHERSCAN_API_KEY not found in environment variables");

  const cleanWallet = norm(walletAddress);
  if (!cleanWallet) throw new Error("walletAddress is empty before BscScan fetch");

  const allTransfers = [];
  let page = 1;
  const offset = Number(process.env.BSCSCAN_OFFSET || 1000);
  const maxPages = Number(process.env.BSCSCAN_MAX_PAGES || 20);

  while (page <= maxPages) {
    const params = new URLSearchParams({
      chainid: "56",
      module: "account",
      action: "tokentx",
      address: cleanWallet,
      page: String(page),
      offset: String(offset),
      sort: "asc",
      apikey: apiKey,
    });

    const res = await fetch(`${ETHERSCAN_V2_URL}?${params.toString()}`, { cache: "no-store" });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`BscScan/Etherscan V2 returned non-json: ${text.slice(0, 180)}`);
    }

    if (data.status === "0" && String(data.message || data.result || "").toLowerCase().includes("no transactions")) break;
    if (data.status !== "1" || !Array.isArray(data.result)) {
      const detail = typeof data.result === "string" ? data.result : data.message || "unknown error";
      throw new Error(`BscScan/Etherscan V2 API error: ${data.message || "NOTOK"} - ${detail}`);
    }

    const batch = data.result.map(normalizeBscScanTransfer);
    allTransfers.push(...batch);
    if (batch.length < offset) break;
    page += 1;
  }

  const seen = new Set();
  return allTransfers
    .filter((tx) => {
      const key = `${tx.hash}-${tx.contractAddress}-${tx.from}-${tx.to}-${tx.value}`;
      if (!tx.hash || !tx.contractAddress || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => Number(a.blockNumber || 0) - Number(b.blockNumber || 0));
}

async function fetchBscScanTokenTransfers(walletAddress) {
  return fetchBep20Transfers(walletAddress);
}

module.exports = {
  fetchBep20Transfers,
  fetchBscScanTokenTransfers,
  hasBscScanKey,
};
