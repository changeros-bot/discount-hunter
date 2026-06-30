import { V17_STORAGE_KEYS, readV17State, writeV17State, getV17StorageStatus } from "../../../lib/v17-storage";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");

  try {
    if (req.method === "GET") {
      const state = await readV17State(V17_STORAGE_KEYS.ACTION_STATE, {});
      return res.status(200).json({
        ok: true,
        version: "v17-action-state-v1",
        storage: getV17StorageStatus(),
        state
      });
    }

    if (req.method === "POST") {
      const nextState = req.body?.state || req.body?.states || {};
      const payload = {
        updatedAt: new Date().toISOString(),
        states: nextState
      };
      const write = await writeV17State(V17_STORAGE_KEYS.ACTION_STATE, payload);
      return res.status(200).json({
        ok: true,
        version: "v17-action-state-v1",
        write,
        payload
      });
    }

    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "v17_action_state_failed" });
  }
}
