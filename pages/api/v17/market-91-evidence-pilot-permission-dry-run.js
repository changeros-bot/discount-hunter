export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  return res.status(200).json({
    ok: true,
    version: "v17-4-permission-dry-run-frozen",
    updatedAt: new Date().toISOString(),
    frozen: true,
    mode: "historical_diagnostic_only",
    permissionDryRunEnabled: false,
    policy: {
      currentMainline: ["Universe Integrity", "Strategy Bucket", "Action Gate"],
      allowedActionGateOutputs: ["No Action", "Discount Add Allowed", "Watch Only", "Blocked"],
      forbiddenOutputs: ["Buy", "Semi-auto", "Whitelist", "Permission dry-run"],
      reason: "Permission dry-run belongs to the frozen Evidence Pilot path and is no longer part of Market 91 v17.4 execution flow.",
    },
    rows: [],
    summary: { total: 0, frozen: 1 },
  });
}
