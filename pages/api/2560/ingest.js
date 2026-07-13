import crypto from "crypto";
import { get2560StorageStatus, write2560Snapshot } from "../../../lib/2560-store";

function clean(value) {
  return String(value || "").trim();
}

function suppliedToken(req) {
  const auth = clean(req.headers?.authorization);
  if (/^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, "").trim();
  return clean(req.headers?.["x-2560-ingest-token"]);
}

function safeEqual(left, right) {
  const a = Buffer.from(clean(left));
  const b = Buffer.from(clean(right));
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

function validateSnapshot(body) {
  if (!body || typeof body !== "object") throw new Error("invalid_snapshot");
  if (!body.lastScan || typeof body.lastScan !== "object") throw new Error("missing_last_scan");
  for (const key of ["trades", "open", "closed"]) {
    if (!Array.isArray(body[key])) throw new Error(`invalid_${key}`);
  }
  if (!body.summary || typeof body.summary !== "object") throw new Error("invalid_summary");
  return body;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  try {
    const expected = clean(process.env.INGEST_TOKEN_2560);
    if (!expected) return res.status(503).json({ ok: false, error: "2560_ingest_token_not_configured" });
    if (!safeEqual(suppliedToken(req), expected)) return res.status(401).json({ ok: false, error: "2560_ingest_auth_failed" });

    const snapshot = validateSnapshot(req.body);
    const saved = await write2560Snapshot(snapshot);
    return res.status(200).json({
      ok: true,
      schemaVersion: saved.snapshot.schemaVersion,
      ingestedAt: saved.snapshot.ingestedAt,
      storage: get2560StorageStatus(),
    });
  } catch (error) {
    return res.status(400).json({ ok: false, error: error.message });
  }
}
