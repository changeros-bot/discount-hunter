import { getPaperSummary } from "../../../lib/v17-paper-engine";
import { fetchPaperStockQuotes, PAPER_STOCK_SYMBOLS } from "../../../lib/v17-paper-stock-quotes";
import { getAllPaperDiscountRules } from "../../../lib/v17-paper-discount-rules";

function buildPaperStockAssetMap() {
  const rules = getAllPaperDiscountRules();
  return Object.fromEntries(PAPER_STOCK_SYMBOLS.map((symbol) => {
    const rule = rules[symbol] || {};
    return [symbol, {
      symbol,
      rules: rule.rules || [],
      amounts: rule.amounts || [],
      profile: rule.profile || "paper_stock",
      ruleNote: rule.note || "Market paper stock quote",
    }];
  }));
}

function marketMapFromQuotes(quotes = []) {
  return Object.fromEntries(
    quotes
      .filter((row) => row?.symbol && Number(row?.price || 0) > 0)
      .map((row) => [row.symbol, row])
  );
}

function quoteHealth(quotes = []) {
  const ok = quotes.filter((row) => row?.quoteAudit?.status === "PASS").map((row) => row.symbol);
  const failed = quotes
    .filter((row) => row?.quoteAudit?.status !== "PASS")
    .map((row) => ({ symbol: row.symbol, status: row?.quoteAudit?.status || "UNKNOWN", error: row?.quoteAudit?.error || null }));
  const binance = quotes.filter((row) => row?.quoteAudit?.provider === "Binance xStocks").map((row) => row.symbol);
  const fallback = quotes.filter((row) => row?.quoteAudit?.fallbackUsed === true).map((row) => row.symbol);
  return { okCount: ok.length, ok, failedCount: failed.length, failed, binanceCount: binance.length, binance, fallbackCount: fallback.length, fallback };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  try {
    if (req.method !== "POST" && req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }
    const body = req.method === "POST" ? (req.body || {}) : {};
    const persistMetrics = String(req.query?.persistMetrics || body.persistMetrics || "").toLowerCase() === "true";
    const quotes = await fetchPaperStockQuotes(PAPER_STOCK_SYMBOLS, buildPaperStockAssetMap());
    const quoteMarkets = marketMapFromQuotes(quotes);
    const result = await getPaperSummary({ markets: { ...quoteMarkets, ...(body.markets || {}) }, persistMetrics });
    return res.status(200).json({
      ...result,
      quoteSource: "Binance xStocks first / Yahoo fallback only",
      quotePolicy: "paper symbols prefer Binance tradable xStock token price; Yahoo only when Binance xStock is unavailable",
      quoteHealth: quoteHealth(quotes),
      placeholderFallbackDisabled: true,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "paper_summary_failed" });
  }
}
