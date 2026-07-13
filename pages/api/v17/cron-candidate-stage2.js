import { neon } from "@neondatabase/serverless";
import { fetchPaperStockQuotes } from "../../../lib/v17-paper-stock-quotes";
import { CANDIDATE_LAB_ASSETS, candidateAssetMap } from "../../../lib/v17-candidate-lab";

const HARD_LOCKED_TICKERS = new Set(["SKHY", "DRAMB"]);

function connectionString() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL || process.env.STORAGE_URL || "";
}

function stage1Status(row) {
  const quoteOk = row?.quoteAudit?.status === "PASS" && Number(row?.price || 0) > 0;
  const hasHigh = Number(row?.high52w || row?.high || 0) > 0;
  const isBinance = row?.quoteAudit?.provider === "Binance xStocks";
  if (!quoteOk) return "FAIL";
  if (!isBinance || !hasHigh) return "CHECK";
  return "PASS";
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  const url = connectionString();
  if (!url) return res.status(503).json({ ok: false, error: "neon_not_configured" });

  try {
    const assetMap = candidateAssetMap();
    const quotes = await fetchPaperStockQuotes(CANDIDATE_LAB_ASSETS.map((asset) => asset.symbol), assetMap);

    const eligible = quotes.filter((row) => {
      const asset = assetMap[row.symbol] || {};
      return !HARD_LOCKED_TICKERS.has(row.symbol) &&
        asset.maturityClass === "A" &&
        asset.stage2Eligible === true &&
        stage1Status(row) === "PASS";
    });

    const sql = neon(url);
    const inserted = [];

    for (const row of eligible) {
      const result = await sql.query(
        `insert into public.candidate_validation_snapshots
        (symbol, captured_at, price, high_52w, low_52w, discount_pct, provider, token_symbol, shares_multiplier, signal_level, validation_status, anomaly_flags, triggered_by)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13)
        returning id, symbol, captured_at`,
        [
          row.symbol,
          row.quoteAudit?.checkedAt || new Date().toISOString(),
          Number(row.price),
          Number(row.high52w || row.high),
          Number(row.low52w || row.low || 0),
          row.discountRaw == null ? null : Number(row.discountRaw),
          row.quoteAudit?.provider || null,
          row.tokenSymbol || null,
          row.sharesMultiplier == null ? null : Number(row.sharesMultiplier),
          Number(row.signal?.level || 0),
          "STAGE_2_OBSERVATION",
          JSON.stringify([]),
          "scheduled",
        ]
      );
      if (result[0]) inserted.push(result[0]);
    }

    return res.status(200).json({
      ok: true,
      mode: "CANDIDATE_STAGE_2_SCHEDULED",
      evaluated: quotes.length,
      eligible: eligible.length,
      inserted: inserted.length,
      symbols: inserted.map((row) => row.symbol),
      triggered_by: "scheduled",
      safeguards: {
        requiresCronSecret: true,
        requiresMaturityClassA: true,
        requiresStage1Pass: true,
        unconfirmedTickersHardLocked: ["SKHY", "DRAMB"],
        createsPaperPositions: false,
        realOrder: false,
      },
    });
  } catch (error) {
    console.error("candidate_stage2_cron_failed", error);
    return res.status(500).json({ ok: false, error: error?.message || "candidate_stage2_cron_failed" });
  }
}
