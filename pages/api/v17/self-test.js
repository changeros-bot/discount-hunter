import { runV17SelfTest } from "../../../lib/v17-self-test";

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const result = runV17SelfTest();
  return res.status(result.ok ? 200 : 500).json(result);
}
