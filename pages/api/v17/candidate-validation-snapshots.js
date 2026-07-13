import { neon } from "@neondatabase/serverless";

const ALLOWED_TRIGGERED_BY = new Set(["manual", "scheduled", "github_actions"]);

function connectionString() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL || process.env.STORAGE_URL || "";
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

  const url = connectionString();
  if (!url) return res.status(503).json({ ok: false, error: "neon_not_configured" });

  const sql = neon(url);

  try {
    if (req.method === "GET") {
      const limit = Math.min(Math.max(Number(req.query.limit || 500), 1), 2000);
      const symbol = String(req.query.symbol || "").trim().toUpperCase();
      const rows = symbol
        ? await sql.query("select * from public.candidate_validation_snapshots where symbol = $1 order by captured_at desc limit $2", [symbol, limit])
        : await sql.query("select * from public.candidate_validation_snapshots order by captured_at desc limit $1", [limit]);
      return res.status(200).json({ ok: true, storage: "neon_postgres", rows });
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
      const rows = inputRows.map((row) => normalizeRow(row, triggeredBy)).filter((row) => row.symbol && Number.isFinite(row.price) && row.price >= 0);
      if (!rows.length) return res.status(400).json({ ok: false, error: "no_valid_rows" });

      const inserted = [];
      for (const row of rows) {
        const result = await sql.query(
          `insert into public.candidate_validation_snapshots
          (symbol, captured_at, price, high_52w, low_52w, discount_pct, provider, token_symbol, shares_multiplier, signal_level, validation_status, anomaly_flags, triggered_by)
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13)
          returning *`,
          [
            row.symbol,
            row.captured_at,
            row.price,
            row.high_52w,
            row.low_52w,
            row.discount_pct,
            row.provider,
            row.token_symbol,
            row.shares_multiplier,
            row.signal_level,
            row.validation_status,
            JSON.stringify(row.anomaly_flags),
            row.triggered_by,
          ]
        );
        if (result[0]) inserted.push(result[0]);
      }

      return res.status(201).json({ ok: true, storage: "neon_postgres", inserted: inserted.length, rows: inserted });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  } catch (error) {
    console.error("candidate_validation_snapshots_failed", error);
    return res.status(500).json({ ok: false, error: error?.message || "snapshot_database_failed" });
  }
}
