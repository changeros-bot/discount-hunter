const PAPER_TEXT_PATTERNS = [
  [/原始 \$100 為佔位符，不可用於 PnL；已用真實報價重設 7 天紙上測試基準。/g, "前次報價來源錯誤，不可用於 PnL；已用 Binance xStocks 現價重設 4 週紙上驗證基準。"],
  [/原始 \$100 為佔位符，不可用於 PnL；已用真實報價重設 4 週紙上驗證基準。/g, "前次報價來源錯誤，不可用於 PnL；已用 Binance xStocks 現價重設 4 週紙上驗證基準。"],
  [/原 \$100 佔位價格已作廢，已用 Yahoo 真實報價重設 7 天測試基準。/g, "前次報價來源錯誤已作廢，已用 Binance xStocks 現價重設 4 週驗證基準。"],
  [/原 \$100 佔位價格已作廢，已用 Binance xStocks 現價重設 4 週測試基準。/g, "前次報價來源錯誤已作廢，已用 Binance xStocks 現價重設 4 週驗證基準。"],
  [/7天紙上交易/g, "4週紙上驗證"],
  [/7 天紙上交易/g, "4 週紙上驗證"],
  [/7天紙上測試/g, "4週紙上驗證"],
  [/7 天紙上測試/g, "4 週紙上驗證"],
  [/7天紙上/g, "4週紙上驗證"],
  [/7 天紙上/g, "4 週紙上驗證"],
  [/7 天紙上 PnL/g, "4 週紙上 PnL"],
  [/7天紙上 PnL/g, "4週紙上 PnL"],
  [/7 天績效測試/g, "4 週驗證"],
  [/7天績效測試/g, "4週驗證"],
  [/第 7 天檢查 PnL、最大浮虧、資料品質；表現不穩定則退回觀察。/g, "第 4 週檢查 PnL、最大浮虧、報價穩定性、流動性與資料品質；未通過則退回觀察。"],
  [/紙上測試先跑 7 天；真實持倉仍依 V17 原規則，不由紙上交易自動轉入。/g, "紙上測試仍只供驗證；真實持倉仍依 V17 原規則，不由紙上交易自動轉入。"],
  [/Yahoo 52週高點/g, "Binance xStocks 現價基準"],
  [/Yahoo 52 週高點/g, "Binance xStocks 現價基準"],
  [/參考高點：Yahoo 52週高點/g, "參考基準：Binance xStocks 現價基準"],
  [/參考高點：Yahoo 52 週高點/g, "參考基準：Binance xStocks 現價基準"],
  [/修復 \$100 佔位價後重新建立紙上基準/g, "Binance xStocks 現價基準重置；4週紙上驗證重新開始"],
  [/\$100 佔位價/g, "前次錯誤報價"],
  [/\$100/g, "前次錯誤報價"],
  [/佔位符/g, "錯誤報價"],
  [/佔位/g, "錯誤報價"],
  [/已用 Yahoo 真實報價重設/g, "已用 Binance xStocks 現價重設"],
  [/這只是紙上測試修復後的基準/g, "這只是 Binance xStocks 基準重置後的紙上驗證"],
  [/這只是 Market45 紙上候選/g, "這只是 4週紙上驗證候選"],
  [/可列入 7 天紙上交易測試/g, "可列入 4 週紙上驗證"],
  [/列入 7 天紙上交易測試/g, "列入 4 週紙上驗證"],
  [/允許 5U、7 天紙上交易/g, "允許 5U、4 週紙上驗證"],
  [/允許高風險 3U、7 天紙上壓力測試/g, "允許高風險 3U、4 週紙上壓力測試"],
  [/7 天內 OPEN 紙上測試/g, "4 週內 OPEN 紙上驗證"],
];

export function sanitizePaperText(value) {
  if (typeof value !== "string") return value;
  return PAPER_TEXT_PATTERNS.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);
}

export function sanitizePaperObject(value) {
  if (Array.isArray(value)) return value.map(sanitizePaperObject);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, sanitizePaperObject(val)]));
  }
  return sanitizePaperText(value);
}

export function countPaperLegacyText(value, path = "root", hits = []) {
  if (typeof value === "string") {
    const patterns = ["Yahoo 52", "$100", "佔位", "7天紙上", "7 天紙上", "第 7 天", "7 天內 OPEN", "Yahoo 真實報價"];
    for (const pattern of patterns) {
      if (value.includes(pattern)) hits.push({ path, pattern, value });
    }
    return hits;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => countPaperLegacyText(item, `${path}[${index}]`, hits));
    return hits;
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, val]) => countPaperLegacyText(val, `${path}.${key}`, hits));
  }
  return hits;
}
