export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  return res.status(200).json({
    ok: true,
    version: "v17-4-automation-dry-run-frozen",
    updatedAt: new Date().toISOString(),
    frozen: true,
    mode: "historical_diagnostic_only",
    autoTradingEnabled: false,
    wouldSubmitOrders: false,
    manualConfirmationRequired: true,
    killSwitchRequired: true,
    summary: {
      draftCount: 0,
      qualityBlockedCount: 0,
      wouldRequestManualConfirmationCount: 0,
      wouldBlockCount: 0,
      totalDraftAmountUsd: 0,
      readinessStatus: "FROZEN",
      readinessLabel: "Automation dry-run frozen under Market 91 v17.4",
    },
    simulatedOrders: [],
    qualityBlocked: [],
    tradeReadiness: null,
    policy: {
      currentMainline: ["Universe Integrity", "Strategy Bucket", "Action Gate"],
      allowedActionGateOutputs: ["No Action", "Discount Add Allowed", "Watch Only", "Blocked"],
      forbiddenOutputs: ["Buy", "Semi-auto", "Whitelist", "Permission dry-run"],
    },
    note: "Automation dry-run is frozen. Market 91 now exposes Action Gate only and never simulates order submission.",
  });
}
