import { fetchPaperStockQuotes } from "../../../lib/v17-paper-stock-quotes";
import { CANDIDATE_LAB_ASSETS, CANDIDATE_LAB_STARTED_AT, candidateAssetMap } from "../../../lib/v17-candidate-lab";

const HARD_LOCKED_TICKERS = new Set(["SKHY", "DRAMB"]);

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
    const assetMap = candidateAssetMap();
    const symbols = CANDIDATE_LAB_ASSETS.map((asset) => asset.symbol);
    const quotes = await fetchPaperStockQuotes(symbols, assetMap);
    const rows = quotes.map((row) => {
      const asset = assetMap[row.symbol] || {};
      const labStatus = statusFor(row);
      const tickerHardLocked = HARD_LOCKED_TICKERS.has(row.symbol);
      const stage2Gate = tickerHardLocked
        ? "CLOSED"
        : asset.stage2Eligible && labStatus === "PASS"
          ? "OPEN"
          : "BLOCKED";
      return {
        ...asset,
        ...row,
        labStatus,
        stage2Gate,
        blockCode: tickerHardLocked ? "TICKER_UNCONFIRMED" : null,
        stage2WriteAllowed: tickerHardLocked ? false : stage2Gate === "OPEN",
        realOrder: false,
        autoTrade: false,
        paperPositionCreated: false,
        validationStage: "STAGE_1_AND_MANUAL_REVIEW_GATE",
      };
    });

    const summary = rows.reduce((acc, row) => {
      acc.total += 1;
      acc[row.labStatus.toLowerCase()] += 1;
      acc.classes[row.maturityClass] = (acc.classes[row.maturityClass] || 0) + 1;
      if (row.stage2WriteAllowed) acc.stage2Eligible += 1;
      if (row.reviewStatus === "ARCHITECTURE_INCOMPATIBLE") acc.architectureIncompatible += 1;
      if (row.blockCode === "TICKER_UNCONFIRMED") acc.tickerUnconfirmed += 1;
      if (row.quoteAudit?.provider === "Binance xStocks") acc.binance += 1;
      if (row.quoteAudit?.fallbackUsed) acc.fallback += 1;
      return acc;
    }, {
      total: 0,
      pass: 0,
      check: 0,
      fail: 0,
      binance: 0,
      fallback: 0,
      stage2Eligible: 0,
      architectureIncompatible: 0,
      tickerUnconfirmed: 0,
      classes: { A: 0, B: 0, C: 0, D: 0 },
    });

    return res.status(200).json({
      ok: true,
      mode: "CANDIDATE_LAB_REVIEW_GATE",
      startedAt: CANDIDATE_LAB_STARTED_AT,
      summary,
      rows,
      safeguards: {
        separateFromOfficialTen: true,
        separateFromPaper28: true,
        realOrder: false,
        autoTrade: false,
        createsPaperPositions: false,
        neonWriteRequiresStage2GateOpen: true,
        unconfirmedTickersHardLocked: ["SKHY", "DRAMB"],
      },
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "candidate_lab_failed" });
  }
}
