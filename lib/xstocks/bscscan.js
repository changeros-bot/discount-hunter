// DCA折價獵人 V15.0 - BSC BEP-20 Transfer API Integration
// Etherscan API V2: BscScan API keys migrated to Etherscan V2, BSC uses chainid=56.

async function fetchBep20Transfers(walletAddress) {
  const apiKey = process.env.BSCSCAN_API_KEY || process.env.ETHERSCAN_API_KEY;

  if (!apiKey) {
    throw new Error("BSCSCAN_API_KEY not found in environment variables");
  }

  const allTransfers = [];
  let page = 1;
  const offset = 1000;

  while (true) {
    const params = new URLSearchParams({
      chainid: "56",
      module: "account",
      action: "tokentx",
      address: walletAddress,
      page: String(page),
      offset: String(offset),
      sort: "asc",
      apikey: apiKey,
    });

    const url = `https://api.etherscan.io/v2/api?${params.toString()}`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.status === "0" && data.message === "No transactions found") {
      break;
    }

    if (data.status !== "1" || !Array.isArray(data.result)) {
      const detail = typeof data.result === "string" ? data.result : data.message || "unknown error";
      throw new Error(`BscScan API error: ${data.message || "NOTOK"} - ${detail}`);
    }

    const batch = data.result;
    allTransfers.push(...batch);

    if (batch.length < offset) {
      break;
    }

    page++;
  }

  return allTransfers;
}

module.exports = {
  fetchBep20Transfers,
};
