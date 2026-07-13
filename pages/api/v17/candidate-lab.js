import { fetchPaperStockQuotes } from "../../../lib/v17-paper-stock-quotes";
import { CANDIDATE_LAB_ASSETS, CANDIDATE_LAB_STARTED_AT, candidateAssetMap } from "../../../lib/v17-candidate-lab";

function statusFor(row) {
  const quoteOk = row?.quoteAudit?.status === "PASS" && Number(row?.price || 0) > 0;
  const hasHigh = Number(row?.high52w || row?.high || 0) > 0;
  const isBinance = row?.quoteAudit?.provider === "Binance xStocks";
  if (!quoteOk) return "FAIL";
  if (!isBinance || !hasHigh) return "CHECK";
  return "PASS";
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  try {
    const symbols = CANDIDATE_LAB_ASSETS.map((asset) => asset.symbol);
    const quotes = await fetchPaperStockQuotes(symbols, candidateAssetMap());
    const rows = quotes.map((row) => ({
      ...row,
      labStatus: statusFor(row),
      realOrder: false,
      autoTrade: false,
      paperPositionCreated: false,
      validationStage: "STAGE_1_QUOTE_AND_METADATA",
    }));
    const summary = rows.reduce((acc, row) => {
      acc.total += 1;
      acc[row.labStatus.toLowerCase()] += 1;
      if (row.quoteAudit?.provider === "Binance xStocks") acc.binance += 1;
      if (row.quoteAudit?.fallbackUsed) acc.fallback += 1;
      return acc;
    }, { total: 0, pass: 0, check: 0, fail: 0, binance: 0, fallback: 0 });

    return res.status(200).json({
      ok: true,
      mode: "CANDIDATE_LAB_STAGE_1",
      startedAt: CANDIDATE_LAB_STARTED_AT,
      summary,
      rows,
      safeguards: {
        separateFromOfficialTen: true,
        separateFromPaper28: true,
        realOrder: false,
        autoTrade: false,
        createsPaperPositions: false,
      },
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "candidate_lab_failed" });
  }
}
