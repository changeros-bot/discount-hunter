import { readPaperTrades } from "../../../lib/v17-paper-engine";
import { nowIso, taipeiDateKey, writePaperStore } from "../../../lib/v17-paper-store";
import { fetchPaperStockQuotes, PAPER_STOCK_SYMBOLS } from "../../../lib/v17-paper-stock-quotes";
import { getAllPaperDiscountRules } from "../../../lib/v17-paper-discount-rules";

const PAPER_SYMBOL_SET = new Set(PAPER_STOCK_SYMBOLS.map((s) => String(s).toUpperCase()));

function normalize(symbol) {
  return String(symbol || "").trim().toUpperCase().replace(/ON$/, "");
}

function safeNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function isCoreTenTrade(trade = {}) {
  const text = `${trade.group || ""} ${trade.sourceType || ""} ${trade.source || ""}`;
  return /既有V17十檔|既有10檔|existing_ten/i.test(text);
}

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

function quoteMapFromRows(rows = []) {
  return new Map(rows
    .filter((row) => row?.symbol && Number(row?.price || 0) > 0)
    .map((row) => [normalize(row.symbol), row]));
}

function quoteHealth(quotes = []) {
  const binance = quotes.filter((row) => row?.quoteAudit?.provider === "Binance xStocks").map((row) => row.symbol);
  const fallback = quotes.filter((row) => row?.quoteAudit?.fallbackUsed === true).map((row) => row.symbol);
  const failed = quotes
    .filter((row) => row?.quoteAudit?.status !== "PASS")
    .map((row) => ({ symbol: row.symbol, status: row?.quoteAudit?.status || "UNKNOWN", error: row?.quoteAudit?.error || null }));
  return { total: quotes.length, binanceCount: binance.length, binance, fallbackCount: fallback.length, fallback, failedCount: failed.length, failed };
}

function shouldResetTrade(trade = {}) {
  if (trade.status !== "OPEN") return false;
  if (isCoreTenTrade(trade)) return false;
  return PAPER_SYMBOL_SET.has(normalize(trade.symbol));
}

function resetTradeToQuote(trade, quote, now, today) {
  const price = safeNumber(quote.price);
  const amountUSDT = safeNumber(trade.amountUSDT || 5);
  const quantity = price > 0 ? amountUSDT / price : 0;
  return {
    ...trade,
    originalIdBeforeBinanceBaselineReset: trade.originalIdBeforeBinanceBaselineReset || trade.id,
    originalDateKeyBeforeBinanceBaselineReset: trade.originalDateKeyBeforeBinanceBaselineReset || trade.dateKey || null,
    originalCreatedAtBeforeBinanceBaselineReset: trade.originalCreatedAtBeforeBinanceBaselineReset || trade.createdAt || null,
    originalPriceBeforeBinanceBaselineReset: trade.originalPriceBeforeBinanceBaselineReset ?? trade.price ?? null,
    originalQuantityBeforeBinanceBaselineReset: trade.originalQuantityBeforeBinanceBaselineReset ?? trade.quantity ?? null,
    originalCurrentPriceBeforeBinanceBaselineReset: trade.originalCurrentPriceBeforeBinanceBaselineReset ?? trade.currentPrice ?? null,
    id: `PAPER-${today.replace(/-/g, "")}-${normalize(trade.symbol)}-BINANCE-RESET`,
    dateKey: today,
    createdAt: now,
    repairedAt: now,
    baselineResetAt: now,
    baselineResetReason: "previous_quote_source_invalid_reset_to_binance_xstock_live_price",
    baselineResetPolicy: "avg_price_equals_current_binance_xstock_price; pnl_restarts_from_zero; four_week_validation_restarts_today",
    baselineResetQuoteSource: quote.priceSource || "Binance xStocks tokenInfo.price / sharesMultiplier",
    baselineResetProvider: quote?.quoteAudit?.provider || null,
    baselineResetTokenSymbol: quote.tokenSymbol || quote.tradableSymbol || `${normalize(trade.symbol)}on`,
    amountUSDT,
    price,
    quantity,
    currentPrice: price,
    currentValue: amountUSDT,
    pnl: 0,
    pnlPct: 0,
    maxGainUSDT: 0,
    maxDrawdownUSDT: 0,
    maxGainPct: 0,
    maxDrawdownPct: 0,
    lastSnapshotAt: now,
    testDays: 28,
    quoteSource: quote.priceSource || "Binance xStocks tokenInfo.price / sharesMultiplier",
    quoteAudit: quote.quoteAudit || null,
    realOrder: false,
    promotionGate: "4週驗證通過也只取得提案資格；必須 Josh 明確同意才可升格折扣獵人。",
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  try {
    const dryRun = String(req.query?.dryRun || req.body?.dryRun || "false").toLowerCase() === "true";
    const trades = await readPaperTrades();
    const quotes = await fetchPaperStockQuotes(PAPER_STOCK_SYMBOLS, buildPaperStockAssetMap());
    const qmap = quoteMapFromRows(quotes);
    const now = nowIso();
    const today = taipeiDateKey();
    const reset = [];
    const skipped = [];

    const nextTrades = trades.map((trade) => {
      if (!shouldResetTrade(trade)) return trade;
      const key = normalize(trade.symbol);
      const quote = qmap.get(key);
      if (!quote || safeNumber(quote.price) <= 0) {
        skipped.push({ id: trade.id, symbol: trade.symbol, reason: "missing_binance_xstock_quote" });
        return trade;
      }
      if (quote?.quoteAudit?.provider !== "Binance xStocks") {
        skipped.push({ id: trade.id, symbol: trade.symbol, reason: "not_binance_xstocks_quote", provider: quote?.quoteAudit?.provider || null });
        return trade;
      }
      const updated = resetTradeToQuote(trade, quote, now, today);
      reset.push({
        symbol: updated.symbol,
        idBefore: trade.id,
        idAfter: updated.id,
        oldPrice: safeNumber(trade.price),
        newPrice: updated.price,
        amountUSDT: updated.amountUSDT,
        newQuantity: updated.quantity,
        provider: quote.quoteAudit.provider,
        tokenSymbol: quote.tokenSymbol || quote.tradableSymbol || null,
      });
      return updated;
    });

    const storage = dryRun ? null : await writePaperStore("trades", nextTrades);
    return res.status(200).json({
      ok: true,
      dryRun,
      today,
      resetAt: now,
      rule: "4週紙上驗證區使用 Binance xStocks 最新現價作為第一次投入基準；均價=現價，PnL歸零，4週重新開始。",
      target: "paper_validation_only_excluding_core_10",
      realOrder: false,
      autoTrade: false,
      resetCount: reset.length,
      skippedCount: skipped.length,
      storage,
      quoteHealth: quoteHealth(quotes),
      reset,
      skipped,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "paper_reset_binance_baseline_failed" });
  }
}
