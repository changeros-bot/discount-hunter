// DCA折價獵人 V15.0 - BscScan API Integration

async function fetchBep20Transfers(walletAddress) {
  const apiKey = process.env.BSCSCAN_API_KEY;

  if (!apiKey) {
    throw new Error("BSCSCAN_API_KEY not found in environment variables");
  }

  const allTransfers = [];
  let page = 1;
  const offset = 1000;

  while (true) {
    const url =
      `https://api.bscscan.com/api?module=account&action=tokentx` +
      `&address=${walletAddress}&page=${page}&offset=${offset}` +
      `&sort=asc&apikey=${apiKey}`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.status === "0" && data.message === "No transactions found") {
      break;
    }

    if (data.status !== "1" || !Array.isArray(data.result)) {
      throw new Error(
        `BscScan API error: ${data.message || "unknown error"}`
      );
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