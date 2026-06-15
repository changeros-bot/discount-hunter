const BINANCE_LIST_URL = "https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/stock/detail/list/ai";

const headers = {
  accept: "application/json, text/plain, */*",
  "accept-language": "en-US,en;q=0.9",
  clienttype: "web",
  lang: "en",
  origin: "https://www.binance.com",
  referer: "https://www.binance.com/en/markets/overview/rwa",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
};

export default async function handler(req, res) {
  try {
    const response = await fetch(BINANCE_LIST_URL, { headers });
    const text = await response.text();

    return res.status(200).json({
      ok: response.ok,
      status: response.status,
      source: "Binance xStocks public API",
      preview: text.slice(0, 220)
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      reason: "binance_xstocks_health_check_failed",
      message: error.message
    });
  }
}
