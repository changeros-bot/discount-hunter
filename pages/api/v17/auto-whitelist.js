export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  return res.status(200).json({
    ok: true,
    version: "v17-4-auto-whitelist-frozen",
    updatedAt: new Date().toISOString(),
    frozen: true,
    mode: "historical_diagnostic_only",
    autoTradingEnabled: false,
    whitelistEnabled: false,
    eligibleCount: 0,
    summary: {
      total: 0,
      ELIGIBLE: 0,
      NOT_YET: 0,
      EXCLUDED: 0,
      FROZEN: 1,
    },
    policy: {
      currentMainline: ["Universe Integrity", "Strategy Bucket", "Action Gate"],
      allowedActionGateOutputs: ["No Action", "Discount Add Allowed", "Watch Only", "Blocked"],
      forbiddenOutputs: ["Buy", "Semi-auto", "Whitelist", "Permission dry-run"],
      reason: "Market 91 v17.4 is an individual-stock / xStocks discount-add auxiliary system. It no longer promotes anything into an auto-trading whitelist.",
    },
    rows: [],
    message: "Auto Whitelist is frozen. Use Market 91 Action Gate instead.",
  });
}
