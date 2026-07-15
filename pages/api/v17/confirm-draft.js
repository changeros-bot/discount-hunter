import { appendExecutionLog, findExecutionByDraftId } from "../../../lib/v17-execution-log";
import { readTradeDraftById, updateDraftStatus } from "../../../lib/v17-trade-drafts";
import { acquireAutomationIdempotency } from "../../../lib/v17-automation-idempotency";
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

    if (normalizedAction === "SKIP" || normalizedAction === "CANCEL") {
      const status = normalizedAction === "SKIP" ? "SKIPPED" : "CANCELLED";
      const result = await updateDraftStatus({ draftId, status, userAction: normalizedAction });
      return res.status(200).json({
        ok: true,
        dryRunOnly: true,
        draftStatus: result.draft.status,
        draft: result.draft,
        storage: result.storage,
        duplicate: result.duplicate === true,
      });
    }

    if (normalizedAction !== "CONFIRM") throw new Error(`invalid_action:${action}`);

    const draft = await readTradeDraftById(draftId);
    if (!draft) throw new Error(`draft_not_found:${draftId}`);

    const existingExecution = await findExecutionByDraftId(draftId);
    if (existingExecution) {
      const repair = await updateDraftStatus({
        draftId,
        status: "CONFIRMED",
        userAction: "CONFIRM_DRY_RUN_RECOVERED",
      });
      return res.status(200).json({
        ok: true,
        dryRun: true,
        dryRunOnly: true,
        duplicatePrevented: true,
        recovered: true,
        message: "Existing simulated execution recovered; no second execution was created.",
        execution: existingExecution,
        draft: repair.draft,
      });
    }

    const lock = await acquireAutomationIdempotency({
      actionId: `confirm-draft:${draftId}`,
      ttlSeconds: 604800,
    });
    if (!lock.acquired) {
      return res.status(409).json({
        ok: false,
        dryRunOnly: true,
        error: "duplicate_confirmation_blocked",
        duplicatePrevented: true,
      });
    }

    const executionResult = await appendExecutionLog({ draft, status: "SIMULATED" });
    const draftResult = await updateDraftStatus({
      draftId,
      status: "CONFIRMED",
      userAction: "CONFIRM_DRY_RUN",
    });

    return res.status(200).json({
      ok: true,
      dryRun: true,
      dryRunOnly: true,
      message: "SIMULATED only. No Binance real order API was called.",
      execution: executionResult.entry,
      draft: draftResult.draft,
      storage: executionResult.storage,
      idempotency: { acquired: true, store: lock.store },
    });
  } catch (error) {
    return res.status(automationErrorStatus(error)).json({ ok: false, error: error.message });
  }
}
