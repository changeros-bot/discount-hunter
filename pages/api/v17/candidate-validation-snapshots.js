const ALLOWED_TRIGGERED_BY = new Set(["manual", "scheduled", "github_actions"]);

function envReady() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function supabaseHeaders(extra = {}) {
  return {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function normalizeRow(row, triggeredBy) {
  return {
    symbol: String(row.symbol || "").trim().toUpperCase(),
    captured_at: row.captured_at || new Date().toISOString(),
    price: Number(row.price || 0),
    high_52w: row.high_52w == null ? null : Number(row.high_52w),
    low_52w: row.low_52w == null ? null : Number(row.low_52w),
    discount_pct: row.discount_pct == null ? null : Number(row.discount_pct),
    provider: row.provider || null,
    token_symbol: row.token_symbol || null,
    shares_multiplier: row.shares_multiplier == null ? null : Number(row.shares_multiplier),
    signal_level: Number(row.signal_level || 0),
    validation_status: row.validation_status || "OBSERVED",
    anomaly_flags: Array.isArray(row.anomaly_flags) ? row.anomaly_flags : [],
    triggered_by: triggeredBy,
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");

  if (!envReady()) {
    return res.status(503).json({ ok: false, error: "supabase_not_configured" });
  }

  const baseUrl = `${process.env.SUPABASE_URL}/rest/v1/candidate_validation_snapshots`;

  if (req.method === "GET") {
    const limit = Math.min(Math.max(Number(req.query.limit || 500), 1), 2000);
    const symbol = String(req.query.symbol || "").trim().toUpperCase();
    const url = new URL(baseUrl);
    url.searchParams.set("select", "*");
    url.searchParams.set("order", "captured_at.desc");
    url.searchParams.set("limit", String(limit));
    if (symbol) url.searchParams.set("symbol", `eq.${symbol}`);

    const response = await fetch(url.toString(), { headers: supabaseHeaders() });
    const text = await response.text();
    if (!response.ok) return res.status(response.status).json({ ok: false, error: text || "snapshot_read_failed" });
    return res.status(200).json({ ok: true, rows: JSON.parse(text || "[]") });
  }

  if (req.method === "POST") {
    const expectedSecret = process.env.CANDIDATE_LAB_WRITE_SECRET;
    const suppliedSecret = req.headers["x-candidate-lab-secret"];
    if (!expectedSecret || suppliedSecret !== expectedSecret) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    const triggeredBy = String(req.body?.triggered_by || "");
    if (!ALLOWED_TRIGGERED_BY.has(triggeredBy)) {
      return res.status(400).json({ ok: false, error: "invalid_triggered_by" });
    }

    const inputRows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    const rows = inputRows.map((row) => normalizeRow(row, triggeredBy)).filter((row) => row.symbol && row.price >= 0);
    if (!rows.length) return res.status(400).json({ ok: false, error: "no_valid_rows" });

    const response = await fetch(baseUrl, {
      method: "POST",
      headers: supabaseHeaders({ Prefer: "return=representation" }),
      body: JSON.stringify(rows),
    });
    const text = await response.text();
    if (!response.ok) return res.status(response.status).json({ ok: false, error: text || "snapshot_write_failed" });
    const inserted = JSON.parse(text || "[]");
    return res.status(201).json({ ok: true, inserted: inserted.length, rows: inserted });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ ok: false, error: "method_not_allowed" });
}
