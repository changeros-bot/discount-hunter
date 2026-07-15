import { readAutoMode, setAutoMode } from "../../../lib/v17-auto-mode";
import { assertKillSwitchAllowsDryRun, automationErrorStatus, requireAutomationWriteAuth } from "../../../lib/v17-automation-security";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  try {
    if (req.method === "GET") {
      const autoMode = await readAutoMode();
      return res.status(200).json({ ok: true, ...autoMode });
    }

    if (req.method === "POST") {
      const auth = requireAutomationWriteAuth(req);
      const { mode, note } = req.body || {};
      if (String(mode || "").trim().toUpperCase() !== "OFF") assertKillSwitchAllowsDryRun();
      const next = await setAutoMode({ mode, updatedBy: auth.actor, note });
      return res.status(200).json({ ok: true, ...next });
    }

    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  } catch (error) {
    return res.status(automationErrorStatus(error)).json({ ok: false, error: error.message });
  }
}
