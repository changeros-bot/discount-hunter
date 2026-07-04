import {
  readV17State,
  writeV17State,
  V17_STORAGE_KEYS
} from "../../../lib/v17-storage";

export default async function handler(req, res) {
  if (req.method === "GET") {
    const snapshot = await readV17State(
      V17_STORAGE_KEYS.SNAPSHOT,
      null
    );

    return res.status(200).json({
      ok: true,
      source: snapshot ? "upstash_snapshot" : "empty",
      snapshot
    });
  }

  if (req.method === "POST") {
    const snapshot = {
      updatedAt: new Date().toISOString(),
      data: req.body || {}
    };

    await writeV17State(
      V17_STORAGE_KEYS.SNAPSHOT,
      snapshot
    );

    return res.status(200).json({
      ok: true,
      updatedAt: snapshot.updatedAt
    });
  }

  return res.status(405).json({
    ok: false,
    error: "method_not_allowed"
  });
}
