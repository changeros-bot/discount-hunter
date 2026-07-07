import fs from "fs";
import path from "path";

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(",");
    return headers.reduce((row, h, i) => {
      row[h] = values[i] ?? "";
      return row;
    }, {});
  });
}

function readCsv(name) {
  const file = path.join(process.cwd(), "reports", "backtests", name);
  if (!fs.existsSync(file)) return [];
  return parseCsv(fs.readFileSync(file, "utf8"));
}

const ownerView = {
  QQQ: { finalRule: "-15% / -25% / -35%", decision: "ETF 可淺買，3層即可", grade: "A+" },
  AVGO: { finalRule: "-25% / -35% / -45% / -60%", decision: "AI 基建 A級，主力配置", grade: "A" },
  NVDA: { finalRule: "-25% / -35% / -45% / -60%", decision: "AI 基建 A級，主力配置", grade: "A" },
  TSM: { finalRule: "-25% / -35% / -45% / -60%", decision: "AI 基建 A級，主力配置", grade: "A" },
  AMD: { finalRule: "-25% / -35% / -45% / -60%", decision: "AI 基建 B級，降低權重", grade: "B" },
  MRVL: { finalRule: "-25% / -35% / -45% / -60%", decision: "AI 基建 B級，降低權重", grade: "C+" },
  GOOGL: { finalRule: "-20% / -30% / -40%", decision: "平台型，3層即可", grade: "B+" },
  RKLB: { finalRule: "-50% / -65% / -80%", decision: "高波動成長，深買少出手", grade: "C" },
  "BTC-USD": { finalRule: "-25% / -40% / -55% / -70% / -85%", decision: "獨立週期引擎，不能套股票規則", grade: "A-" }
};

function pctNum(v) {
  const n = Number(String(v || "").replace("%", ""));
  return Number.isFinite(n) ? n : -999;
}

function selectBest(rows) {
  const byTicker = new Map();
  for (const row of rows) {
    const ticker = row.ticker;
    const current = byTicker.get(ticker);
    const score = pctNum(row.avg_ret_252d) + pctNum(row.win_rate_ret_252d) - Math.abs(pctNum(row.avg_max_adverse_252d)) * 0.3;
    if (!current || score > current.score) byTicker.set(ticker, { ...row, score });
  }
  return Array.from(byTicker.values()).map((row) => ({ ...row, ...(ownerView[row.ticker] || {}) }));
}

export default function handler(req, res) {
  try {
    const summary = readCsv("discount_hunter_summary.csv");
    const events = readCsv("discount_hunter_events.csv");
    const best = selectBest(summary);
    res.status(200).json({
      ok: true,
      updatedAt: new Date().toISOString(),
      title: "DCA 折價獵人 V18.1 回測總覽",
      conclusion: "跌幅邏輯成立，但已升級為資產類型分層表：ETF淺買、AI基建中深買、高波動成長深買、BTC週期買。",
      best,
      summary,
      eventsCount: events.length
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
}
