import { readAutoMode, setAutoMode } from "../../../lib/v17-auto-mode";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  try {
    if (req.method === "GET") {
      const autoMode = await readAutoMode();
      return res.status(200).json({ ok: true, ...autoMode });
    }

    if (req.method === "POST") {
      const { mode, updatedBy, note } = req.body || {};
      const next = await setAutoMode({ mode, updatedBy: updatedBy || "user", note });
      return res.status(200).json({ ok: true, ...next });
    }

    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  } catch (error) {
    return res.status(400).json({ ok: false, error: error.message });
  }
}
