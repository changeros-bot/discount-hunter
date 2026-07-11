import { fetchYahooStockQuotes, PAPER_STOCK_SYMBOLS } from "../../../lib/v17-paper-stock-quotes";
import { getAllPaperDiscountRules } from "../../../lib/v17-paper-discount-rules";
import { nowIso, readPaperStore, taipeiDateKey, writePaperStore } from "../../../lib/v17-paper-store";

function normalize(symbol) {
  return String(symbol || "").trim().toUpperCase().replace(/ON$/, "");
}

function buildAssetMap() {
  const rules = getAllPaperDiscountRules();
  return Object.fromEntries(PAPER_STOCK_SYMBOLS.map((symbol) => {
    const rule = rules[symbol] || {};
    return [symbol, { symbol, rules: rule.rules || [], amounts: rule.amounts || [], profile: rule.profile, ruleNote: rule.note }];
  }));
}

function isPlaceholderTrade(trade) {
  const symbol = normalize(trade?.symbol);
  if (!PAPER_STOCK_SYMBOLS.includes(symbol)) return false;
  const price = Number(trade?.price || 0);
  const sourceText = `${trade?.sourceType || ""} ${trade?.group || ""} ${trade?.source || ""}`;
  return price === 100 && /Market45|Market91|Market10|sector|產業|paper|audit/i.test(sourceText);
}

function rebuildPlaybook(trade, quote, rule = {}) {
  const rules = Array.isArray(rule.rules) ? rule.rules : [];
  const amounts = Array.isArray(rule.amounts) ? rule.amounts : [];
  return {
    ...(trade.playbook || {}),
    entryRule: rules.length ? `參考高點：Yahoo 52週高點；折價層級：${rules.map((x, i) => `D${i + 1} ${x}%`).join(" / ")}` : (trade.playbook?.entryRule || "使用真實報價重設紙上基準。"),
    buyPointRule: rules.length ? `參考高點：Yahoo 52週高點；折價層級：${rules.map((x, i) => `D${i + 1} ${x}%`).join(" / ")}` : trade.playbook?.buyPointRule,
    sizing: amounts.length ? `層級金額：${amounts.map((x, i) => `D${i + 1} ${x}U`).join(" / ")}` : (trade.playbook?.sizing || "每筆紙上測試；禁止真實交易。"),
    whyIncluded: `${trade.playbook?.whyIncluded || "紙上測試候選。"}｜注意：原 $100 佔位價格已作廢，已用 Yahoo 真實報價重設 7 天測試基準。`,
    whyNotReal: "這只是紙上測試修復後的基準，不是真實交易白名單；禁止真實自動交易。",
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  try {
    const dryRun = String(req.query?.dryRun || "").toLowerCase() === "true";
    const today = taipeiDateKey();
    const checkedAt = nowIso();
    const trades = await readPaperStore("trades", []);
    const list = Array.isArray(trades) ? trades : [];
    const symbols = [...new Set(list.filter(isPlaceholderTrade).map((trade) => normalize(trade.symbol)))];
    const quotes = await fetchYahooStockQuotes(symbols, buildAssetMap());
    const quoteMap = new Map(quotes.map((row) => [normalize(row.symbol), row]));
    const rules = getAllPaperDiscountRules();
    const repaired = [];
    const skipped = [];

    const next = list.map((trade) => {
      if (!isPlaceholderTrade(trade)) return trade;
      const symbol = normalize(trade.symbol);
      const quote = quoteMap.get(symbol);
      const price = Number(quote?.price || 0);
      if (!price) {
        skipped.push({ id: trade.id, symbol: trade.symbol, reason: "missing_real_quote" });
        return trade;
      }
      const amountUSDT = Number(trade.amountUSDT || 0);
      const quantity = amountUSDT > 0 ? amountUSDT / price : 0;
      const updated = {
        ...trade,
        id: `${trade.id}-REPAIRED-${today.replace(/-/g, "")}`,
        originalPlaceholderId: trade.id,
        originalPlaceholderPrice: trade.price,
        repairedAt: checkedAt,
        dateKey: today,
        createdAt: checkedAt,
        price,
        quantity,
        discount: quote.discount,
        high52w: quote.high52w || quote.high || null,
        low52w: quote.low52w || quote.low || null,
        priceSource: quote.priceSource || "Yahoo Finance quote",
        quoteAudit: quote.quoteAudit || null,
        trigger: "修復 $100 佔位價後重新建立紙上基準",
        realOrder: false,
        playbook: rebuildPlaybook(trade, quote, rules[symbol] || {}),
        repairNote: "原始 $100 為佔位符，不可用於 PnL；已用真實報價重設 7 天紙上測試基準。",
      };
      repaired.push({ id: trade.id, newId: updated.id, symbol: trade.symbol, oldPrice: trade.price, newPrice: price, amountUSDT, quantity });
      return updated;
    });

    const storage = !dryRun && repaired.length ? await writePaperStore("trades", next) : null;
    return res.status(200).json({
      ok: true,
      dryRun,
      checkedAt,
      candidateSymbols: symbols,
      repairedCount: repaired.length,
      skippedCount: skipped.length,
      repaired,
      skipped,
      storage,
      realOrder: false,
      rule: "$100 placeholder paper prices are invalid for PnL; reset eligible stock paper lots using Yahoo real quotes and restart 7-day baseline.",
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "paper_repair_placeholder_prices_failed" });
  }
}
