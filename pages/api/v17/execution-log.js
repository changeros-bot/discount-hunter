import { readExecutionLog } from "../../../lib/v17-execution-log";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  try {
    if (req.method !== "GET") return res.status(405).json({ ok: false, error: "method_not_allowed" });
    const logs = await readExecutionLog();
    return res.status(200).json({ ok: true, dryRunOnly: true, logs });
  } catch (error) {
    return res.status(400).json({ ok: false, error: error.message });
  }
}
