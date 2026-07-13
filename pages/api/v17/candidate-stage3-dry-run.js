import { neon } from "@neondatabase/serverless";

const APPROVED_STAGE2_SYMBOLS = ["AAPL", "AMZN", "KO", "BAC", "AXP", "CVX", "XOM", "LIN", "NOC", "UNH"];

function connectionString() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL || process.env.STORAGE_URL || "";
}

function actionGate(row) {
  const signalLevel = Number(row.signal_level || 0);
  const discount = Number(row.discount_pct || 0);

  if (signalLevel >= 2) {
    return {
      action: "DISCOUNT_ADD_CANDIDATE",
      label: "折價加碼候選",
      reason: `Signal Level ${signalLevel}，目前較 52 週高點 ${discount.toFixed(2)}%`,
      hypotheticalAmountUsd: 5,
    };
  }
  if (signalLevel === 1) {
    return {
      action: "WATCH_ONLY",
      label: "僅觀察",
      reason: `Signal Level 1，尚未進入第二層買點`,
      hypotheticalAmountUsd: 0,
    };
  }
  return {
    action: "NO_ACTION",
    label: "不動作",
    reason: "尚未達候選買點",
    hypotheticalAmountUsd: 0,
  };
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
    const rows = await sql.query(
      `with ranked as (
        select *,
          row_number() over (partition by symbol order by captured_at desc, id desc) as rn,
          count(*) over (partition by symbol) as snapshot_count
        from public.candidate_validation_snapshots
        where symbol = any($1::text[])
      )
      select symbol, captured_at, price, high_52w, low_52w, discount_pct, provider,
        token_symbol, shares_multiplier, signal_level, validation_status,
        anomaly_flags, triggered_by, snapshot_count
      from ranked
      where rn = 1
      order by symbol`,
      [APPROVED_STAGE2_SYMBOLS]
    );

    const audit = await sql.query(
      `select
        count(*) filter (where not (symbol = any($1::text[])))::int as unauthorized_writes,
        count(distinct symbol) filter (where symbol = any($1::text[]))::int as approved_symbols_present
      from public.candidate_validation_snapshots`,
      [APPROVED_STAGE2_SYMBOLS]
    );

    const unauthorizedWrites = Number(audit[0]?.unauthorized_writes || 0);
    const complete = rows.length === APPROVED_STAGE2_SYMBOLS.length && rows.every((row) => Number(row.snapshot_count) >= 2);
    const clean = rows.every((row) => Array.isArray(row.anomaly_flags) ? row.anomaly_flags.length === 0 : true);
    const stage3GateOpen = complete && clean && unauthorizedWrites === 0;

    const decisions = rows.map((row) => {
      const gate = actionGate(row);
      return {
        symbol: row.symbol,
        capturedAt: row.captured_at,
        price: Number(row.price),
        high52w: Number(row.high_52w),
        discountPct: Number(row.discount_pct),
        signalLevel: Number(row.signal_level || 0),
        snapshotCount: Number(row.snapshot_count),
        provider: row.provider,
        tokenSymbol: row.token_symbol,
        action: stage3GateOpen ? gate.action : "BLOCKED",
        actionLabel: stage3GateOpen ? gate.label : "Stage 3 Gate 關閉",
        reason: stage3GateOpen ? gate.reason : "Stage 2 資料完整性或稽核未通過",
        hypotheticalAmountUsd: stage3GateOpen ? gate.hypotheticalAmountUsd : 0,
      };
    });

    const candidates = decisions.filter((row) => row.action === "DISCOUNT_ADD_CANDIDATE");

    return res.status(200).json({
      ok: true,
      mode: "CANDIDATE_STAGE_3_DRY_RUN",
      stage3Gate: stage3GateOpen ? "OPEN" : "CLOSED",
      summary: {
        approvedSymbols: APPROVED_STAGE2_SYMBOLS.length,
        evaluated: decisions.length,
        completeStage2Histories: decisions.filter((row) => row.snapshotCount >= 2).length,
        unauthorizedWrites,
        discountAddCandidates: candidates.length,
        watchOnly: decisions.filter((row) => row.action === "WATCH_ONLY").length,
        noAction: decisions.filter((row) => row.action === "NO_ACTION").length,
        blocked: decisions.filter((row) => row.action === "BLOCKED").length,
        hypotheticalTotalUsd: candidates.reduce((sum, row) => sum + row.hypotheticalAmountUsd, 0),
      },
      decisions,
      safeguards: {
        readOnly: true,
        writesDatabase: false,
        createsTradeDrafts: false,
        createsPaperPositions: false,
        submitsRealOrders: false,
        modifiesExistingPaperAccount: false,
        manualApprovalRequiredBeforePaper: true,
      },
    });
  } catch (error) {
    console.error("candidate_stage3_dry_run_failed", error);
    return res.status(500).json({ ok: false, error: error?.message || "candidate_stage3_dry_run_failed" });
  }
}
