export default async function handler(req, res) {
  const key = process.env.ONDO_API_KEY;

  if (!key) {
    return res.status(200).json({
      ok: false,
      reason: "missing_ondo_api_key"
    });
  }

  try {
    const response = await fetch("https://api.gm.ondo.finance/v1/assets/all/market", {
      headers: { "x-api-key": key, accept: "application/json" }
    });

    return res.status(200).json({
      ok: response.ok,
      status: response.status,
      source: "Ondo GM API all market endpoint"
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      reason: "ondo_health_check_failed",
      message: error.message
    });
  }
}
