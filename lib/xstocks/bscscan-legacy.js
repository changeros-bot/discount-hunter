// DCA Discount Hunter V15.2 - BscScan legacy endpoint helper
// Use with a real BscScan API key from bscscan.com/myapikey

async function fetchBep20TransfersLegacy(walletAddress) {
  const apiKey = process.env.BSCSCAN_API_KEY;
  const cleanWalletAddress = String(walletAddress || "").trim();

  if (!apiKey) {
    throw new Error("BSCSCAN_API_KEY not found in environment variables");
  }

  if (String(apiKey).startsWith("sk_")) {
    throw new Error(
      "BSCSCAN_API_KEY looks invalid: it starts with sk_. Please use a real BscScan API key from bscscan.com/myapikey"
    );
  }

  if (!cleanWalletAddress) {
    throw new Error("walletAddress is empty before calling BscScan");
  }

  const allTransfers = [];
  let page = 1;
  const offset = 1000;

  while (true) {
    const params = new URLSearchParams({
      module: "account",
      action: "tokentx",
      address: cleanWalletAddress,
      page: String(page),
      offset: String(offset),
      sort: "asc",
      apikey: apiKey,
    });

    const url = `https://api.bscscan.com/api?${params.toString()}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status === "0" && data.message === "No transactions found") break;

    if (data.status !== "1" || !Array.isArray(data.result)) {
      const detail = typeof data.result === "string" ? data.result : data.message || "unknown error";
      throw new Error(`BscScan API error: ${data.message || "NOTOK"} - ${detail}`);
    }

    allTransfers.push(...data.result);
    if (data.result.length < offset) break;
    page++;
  }

  return allTransfers;
}

module.exports = { fetchBep20TransfersLegacy };
