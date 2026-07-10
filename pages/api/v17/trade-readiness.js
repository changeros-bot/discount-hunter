import { evaluateTradeReadiness } from "../../../lib/v17-risk-gate";
import { automationErrorStatus, requireAutomationWriteAuth } from "../../../lib/v17-automation-security";
import { buildServerVerifiedDecisions } from "../../../lib/v17-server-decisions";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    if (req.method === "POST") requireAutomationWriteAuth(req);
    const serverDecisions = await buildServerVerifiedDecisions();
    const readiness = await evaluateTradeReadiness({ decisions: serverDecisions.actionQueue || [] });
    return res.status(200).json({
      ok: true,
      version: "v17.7-server-verified-risk-gate",
      verification: serverDecisions.verification,
      ...readiness,
    });
  } catch (error) {
    return res.status(automationErrorStatus(error)).json({ ok: false, error: error.message });
  }
}
