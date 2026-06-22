async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");

  try {
    const host = req.headers.host;
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const base = `${protocol}://${host}`;

    const syncRes = await fetch(`${base}/api/sync-wallet?t=${Date.now()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      cache: "no-store",
    });

    const data = await syncRes.json();
    const holdings = data.holdings || [];
    const liveHoldings = holdings.filter((h) => Number(h.quantity || 0) > 0 && h.quantitySource === "bsc_rpc_balanceOf_live");
    const fallbackHoldings = holdings.filter((h) => Number(h.quantity || 0) > 0 && h.quantitySource !== "bsc_rpc_balanceOf_live");

    return res.status(200).json({
      ok: true,
      frontendVersionExpected: "15.8-live-holding-ui",
      syncWalletVersion: data.version || null,
      walletAddress: data.walletAddress || null,
      fullWalletAddress: data.fullWalletAddress || null,
      allHoldingCount: holdings.length,
      liveHoldingCount: liveHoldings.length,
      fallbackHoldingCount: fallbackHoldings.length,
      liveSymbols: liveHoldings.map((h) => h.symbol),
      fallbackSymbols: fallbackHoldings.map((h) => ({
        symbol: h.symbol,
        quantitySource: h.quantitySource,
        quantity: h.quantity,
        totalCost: h.totalCost,
      })),
      allSources: holdings.map((h) => ({
        symbol: h.symbol,
        quantity: h.quantity,
        quantitySource: h.quantitySource,
        source: h.source,
        liveBalanceContractAddress: h.liveBalanceContractAddress || null,
      })),
      debugCounts: data.debugCounts || null,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "debug failed" });
  }
}

module.exports = handler;
