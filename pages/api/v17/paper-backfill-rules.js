import { applyPaperDiscountRule, getAllPaperDiscountRules } from "../../../lib/v17-paper-discount-rules";
import { readPaperStore, writePaperStore } from "../../../lib/v17-paper-store";

function normalize(symbol) {
  return String(symbol || "").trim().toUpperCase().replace(/ON$/, "");
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  try {
    const rules = getAllPaperDiscountRules();
    const ruleKeys = new Set(Object.keys(rules).map(normalize));
    const trades = await readPaperStore("trades", []);
    const list = Array.isArray(trades) ? trades : [];
    const updatedSymbols = [];

    const next = list.map((trade) => {
      const key = normalize(trade?.symbol);
      if (!ruleKeys.has(key)) return trade;
      const patched = applyPaperDiscountRule(trade);
      updatedSymbols.push(trade.symbol);
      return patched;
    });

    const storage = updatedSymbols.length ? await writePaperStore("trades", next) : null;

    return res.status(200).json({
      ok: true,
      totalTrades: list.length,
      updatedCount: updatedSymbols.length,
      updatedSymbols,
      rules: Object.fromEntries(Object.entries(rules).map(([symbol, rule]) => [symbol, { profile: rule.profile, referenceMode: rule.referenceMode, rules: rule.rules, amounts: rule.amounts, note: rule.note }])),
      storage,
      realOrder: false,
      rule: "回填紙上交易買點規則：只補 rules / amounts / playbook，不會送出任何真實訂單。",
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "paper_backfill_rules_failed" });
  }
}
