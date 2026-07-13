import { neon } from "@neondatabase/serverless";

const APPROVED_STAGE2_SYMBOLS = ["AAPL", "AMZN", "KO", "BAC", "AXP", "CVX", "XOM", "LIN", "NOC", "UNH"];
const UNCONFIRMED_TICKERS = ["SKHY", "DRAMB"];

function connectionString() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL || process.env.STORAGE_URL || "";
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const url = connectionString();
  if (!url) return res.status(503).json({ ok: false, error: "neon_not_configured" });

  try {
    const sql = neon(url);
    const rows = await sql.query(`
      with ranked as (
        select *, row_number() over (partition by symbol order by captured_at desc, id desc) rn
        from public.candidate_validation_snapshots
      ), pairs as (
        select
          a.symbol,
          a.price latest_price,
          b.price previous_price,
          a.high_52w latest_high,
          b.high_52w previous_high,
          a.low_52w latest_low,
          b.low_52w previous_low,
          a.provider latest_provider,
          b.provider previous_provider,
          a.token_symbol latest_token,
          b.token_symbol previous_token,
          a.shares_multiplier latest_multiplier,
          b.shares_multiplier previous_multiplier,
          a.signal_level latest_signal,
          b.signal_level previous_signal,
          a.captured_at latest_captured_at,
          b.captured_at previous_captured_at
        from ranked a
        join ranked b on a.symbol = b.symbol and a.rn = 1 and b.rn = 2
      )
      select
        symbol,
        latest_captured_at,
        previous_captured_at,
        latest_price,
        previous_price,
        round(((latest_price - previous_price) / nullif(previous_price, 0) * 100)::numeric, 4) as price_change_pct,
        (latest_high = previous_high) as high_stable,
        (latest_low = previous_low) as low_stable,
        (latest_provider = previous_provider) as provider_stable,
        (latest_token = previous_token) as token_stable,
        (latest_multiplier = previous_multiplier) as multiplier_stable,
        (latest_signal = previous_signal) as signal_stable
      from pairs
      order by symbol
    `);

    const counts = await sql.query(`
      select
        count(*)::int as total_snapshots,
        count(distinct symbol)::int as symbols,
        count(*) filter (where validation_status = 'STAGE_2_BASELINE')::int as baselines,
        count(*) filter (where validation_status = 'STAGE_2_OBSERVATION')::int as observations,
        count(*) filter (where triggered_by = 'manual')::int as manual,
        count(*) filter (where triggered_by = 'scheduled')::int as scheduled,
        count(*) filter (where triggered_by = 'github_actions')::int as github_actions
      from public.candidate_validation_snapshots
    `);

    const writeAudit = await sql.query(
      `select
        count(*) filter (where not (symbol = any($1::text[])))::int as unauthorized_writes,
        count(*) filter (where symbol = any($2::text[]))::int as unconfirmed_ticker_writes,
        array_agg(distinct symbol) filter (where not (symbol = any($1::text[]))) as unauthorized_symbols
      from public.candidate_validation_snapshots`,
      [APPROVED_STAGE2_SYMBOLS, UNCONFIRMED_TICKERS]
    );

    const anomalies = rows.filter((row) =>
      Math.abs(Number(row.price_change_pct || 0)) > 5 ||
      !row.high_stable ||
      !row.low_stable ||
      !row.provider_stable ||
      !row.token_stable ||
      !row.multiplier_stable ||
      !row.signal_stable
    );
    const audit = writeAudit[0] || {};
    const internalPass = rows.length >= 10 && anomalies.length === 0 && Number(audit.unauthorized_writes || 0) === 0 && Number(audit.unconfirmed_ticker_writes || 0) === 0;

    return res.status(200).json({
      ok: true,
      storage: "neon_postgres",
      summary: {
        ...(counts[0] || {}),
        compared_symbols: rows.length,
        anomalies: anomalies.length,
        unauthorized_writes: Number(audit.unauthorized_writes || 0),
        unconfirmed_ticker_writes: Number(audit.unconfirmed_ticker_writes || 0),
        internal_test_status: internalPass ? "PASS" : "FAIL",
        paper_positions: 0,
        real_orders: 0,
      },
      rows,
      safeguards: {
        createsPaperPositions: false,
        realOrder: false,
        approvedStage2Symbols: APPROVED_STAGE2_SYMBOLS,
        unauthorizedSymbols: audit.unauthorized_symbols || [],
        architectureIncompatibleWritten: Number(audit.unauthorized_writes || 0),
        unconfirmedTickersWritten: Number(audit.unconfirmed_ticker_writes || 0),
      },
    });
  } catch (error) {
    console.error("candidate_stage2_report_failed", error);
    return res.status(500).json({ ok: false, error: error?.message || "candidate_stage2_report_failed" });
  }
}
