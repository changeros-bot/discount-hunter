import { writeV17State, V17_STORAGE_KEYS } from "../../../lib/v17-storage";

async function readJson(url, options = {}) {
  try {
    const res = await fetch(url, options);
    const data = await res.json();
    return { ok: res.ok && data?.ok !== false, status: res.status, data };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const host = req.headers.host;
  const protocol = req.headers["x-forwarded-proto"] || "http";
  const base = `${protocol}://${host}`;
  const updatedAt = new Date().toISOString();

  const prices = await readJson(`${base}/api/prices?t=${Date.now()}`);
  const wallet = await readJson(`${base}/api/sync-wallet?t=${Date.now()}`);
  const decisions = await readJson(`${base}/api/v17/decisions?t=${Date.now()}`);
  const health = await readJson(`${base}/api/v17/health?t=${Date.now()}`);

  const snapshot = {
    updatedAt,
    source: "v18_fast_open_snapshot",
    prices: prices.data,
    wallet: wallet.data,
    decisions: decisions.data,
    health: health.data,
    status: {
      prices: prices.ok,
      wallet: wallet.ok,
      decisions: decisions.ok,
      health: health.ok
    }
  };

  await writeV17State(V17_STORAGE_KEYS.SNAPSHOT, snapshot);

  return res.status(200).json({
    ok: true,
    updatedAt,
    status: snapshot.status,
    priceCount: prices.data?.count ?? prices.data?.data?.length ?? 0,
    walletHoldings: wallet.data?.holdings?.length ?? 0,
    decisionCount: decisions.data?.count ?? 0
  });
}
