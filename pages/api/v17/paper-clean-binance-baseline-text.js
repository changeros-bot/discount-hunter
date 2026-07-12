import { readPaperTrades } from "../../../lib/v17-paper-engine";
import { nowIso, writePaperStore } from "../../../lib/v17-paper-store";
import { PAPER_STOCK_SYMBOLS } from "../../../lib/v17-paper-stock-quotes";

const PAPER_SYMBOL_SET = new Set(PAPER_STOCK_SYMBOLS.map((s) => String(s).toUpperCase()));

function normalize(symbol) {
  return String(symbol || "").trim().toUpperCase().replace(/ON$/, "");
}

function isCoreTenTrade(trade = {}) {
  const text = `${trade.group || ""} ${trade.sourceType || ""} ${trade.source || ""}`;
  return /既有V17十檔|既有10檔|existing_ten/i.test(text);
}

function shouldClean(trade = {}) {
  if (trade.status !== "OPEN") return false;
  if (isCoreTenTrade(trade)) return false;
  if (!PAPER_SYMBOL_SET.has(normalize(trade.symbol))) return false;
  return /BINANCE-RESET|previous_quote_source_invalid_reset_to_binance_xstock_live_price|Binance xStocks/i.test(`${trade.id || ""} ${trade.baselineResetReason || ""} ${trade.quoteSource || ""}`);
}

function cleanText(value) {
  if (typeof value !== "string") return value;
  return value
    .replace(/7天紙上交易/g, "4週紙上驗證")
    .replace(/7 天紙上交易/g, "4 週紙上驗證")
    .replace(/7天紙上測試/g, "4週紙上驗證")
    .replace(/7 天紙上測試/g, "4 週紙上驗證")
    .replace(/第 7 天檢查 PnL、最大浮虧、資料品質；/g, "第 4 週檢查 PnL、最大浮虧、資料品質與報價穩定性；")
    .replace(/Yahoo 52週高點/g, "Binance xStocks 現價基準")
    .replace(/Yahoo 52 週高點/g, "Binance xStocks 現價基準")
    .replace(/原 \$100 佔位價格已作廢，已用 Yahoo 真實報價重設 7 天測試基準。/g, "前次報價來源錯誤已作廢，已用 Binance xStocks 現價重設 4 週驗證基準。")
    .replace(/原始 \$100 為佔位符，不可用於 PnL；已用真實報價重設 7 天紙上測試基準。/g, "前次報價來源錯誤，不可用於 PnL；已用 Binance xStocks 現價重設 4 週紙上驗證基準。")
    .replace(/這只是紙上測試修復後的基準/g, "這只是 Binance xStocks 基準重置後的紙上驗證")
    .replace(/這只是 Market45 紙上候選/g, "這只是 Market45 紙上驗證候選")
    .replace(/不是真實交易白名單；禁止真實自動交易/g, "不是真實交易白名單；禁止真實自動交易");
}

function deepClean(value) {
  if (Array.isArray(value)) return value.map(deepClean);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, deepClean(val)]));
  }
  return cleanText(value);
}

function cleanTrade(trade, now) {
  const playbook = deepClean(trade.playbook || {});
  const symbol = normalize(trade.symbol);
  return {
    ...deepClean(trade),
    playbook: {
      ...playbook,
      title: `${symbol} 4週紙上驗證 Playbook`,
      entryRule: "基準：Binance xStocks 最新現價；均價=現價；PnL 從 0 重新計算。後續買點仍依各檔折價層級觀察，但不自動加碼、不真實下單。",
      exitRule: "第 4 週檢查 PnL、最大浮虧、報價穩定性、流動性與資料品質；未通過則退回觀察。",
      whyNotReal: "這只是 Binance xStocks 現價基準的紙上驗證，不是真實交易白名單；禁止真實自動交易。",
    },
    trigger: "Binance xStocks 現價基準重置；4週紙上驗證重新開始",
    repairNote: "前次報價來源錯誤，不可用於 PnL；已用 Binance xStocks 現價重設 4 週紙上驗證基準。",
    baselineTextCleanedAt: now,
    baselineTextPolicy: "remove_yahoo_7d_placeholder_terms_after_binance_xstocks_baseline_reset",
    quoteSource: "Binance xStocks tokenInfo.price / sharesMultiplier",
    realOrder: false,
    promotionGate: "4週驗證通過也只取得提案資格；必須 Josh 明確同意才可升格折扣獵人。",
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  try {
    const dryRun = String(req.query?.dryRun || req.body?.dryRun || "false").toLowerCase() === "true";
    const trades = await readPaperTrades();
    const now = nowIso();
    const cleaned = [];
    const nextTrades = trades.map((trade) => {
      if (!shouldClean(trade)) return trade;
      const updated = cleanTrade(trade, now);
      cleaned.push({
        symbol: updated.symbol,
        id: updated.id,
        group: updated.group,
        sourceType: updated.sourceType,
        testDays: updated.testDays,
        trigger: updated.trigger,
        entryRule: updated.playbook?.entryRule || null,
      });
      return updated;
    });

    const storage = dryRun ? null : await writePaperStore("trades", nextTrades);
    return res.status(200).json({
      ok: true,
      dryRun,
      cleanedAt: now,
      rule: "清理 Binance xStocks 基準重置後的紙上驗證文字：移除 Yahoo / 7天 / $100 佔位價殘留，不改價格、不改數量、不改 PnL。",
      realOrder: false,
      autoTrade: false,
      cleanedCount: cleaned.length,
      storage,
      cleaned,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "paper_clean_binance_baseline_text_failed" });
  }
}
