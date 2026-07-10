import { appendExecutionLog } from "../../../lib/v17-execution-log";
import { updateDraftStatus } from "../../../lib/v17-trade-drafts";
import { assertKillSwitchAllowsDryRun, automationErrorStatus, requireAutomationWriteAuth } from "../../../lib/v17-automation-security";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    requireAutomationWriteAuth(req);
    assertKillSwitchAllowsDryRun();

    const { draftId, action } = req.body || {};
    const normalizedAction = String(action || "").trim().toUpperCase();
    if (!draftId) throw new Error("missing_draft_id");

    if (normalizedAction === "SKIP") {
      const { draft, storage } = await updateDraftStatus({ draftId, status: "SKIPPED", userAction: "SKIP" });
      return res.status(200).json({ ok: true, dryRunOnly: true, draftStatus: draft.status, draft, storage });
    }

    if (normalizedAction === "CANCEL") {
      const { draft, storage } = await updateDraftStatus({ draftId, status: "CANCELLED", userAction: "CANCEL" });
      return res.status(200).json({ ok: true, dryRunOnly: true, draftStatus: draft.status, draft, storage });
    }

    if (normalizedAction !== "CONFIRM") throw new Error(`invalid_action:${action}`);

    const { draft } = await updateDraftStatus({ draftId, status: "CONFIRMED", userAction: "CONFIRM_DRY_RUN" });
    const { entry, storage } = await appendExecutionLog({ draft, status: "SIMULATED" });

    return res.status(200).json({
      ok: true,
      dryRun: true,
      dryRunOnly: true,
      message: "SIMULATED only. No Binance real order API was called.",
      execution: entry,
      storage,
    });
  } catch (error) {
    return res.status(automationErrorStatus(error)).json({ ok: false, error: error.message });
  }
}
