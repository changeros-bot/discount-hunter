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
  const file = path.join(process.cwd(), "reports", "paper", name);
  if (!fs.existsSync(file)) return [];
  return parseCsv(fs.readFileSync(file, "utf8"));
}

function toNum(v) {
  const n = Number(String(v ?? "").replace("%", ""));
  if (!Number.isFinite(n)) return 0;
  return String(v).includes("%") ? n / 100 : n;
}

export default function handler(req, res) {
  try {
    const trades = readCsv("2560_paper_trades.csv");
    const open = readCsv("2560_open_positions.csv");
    const closed = readCsv("2560_closed_trades.csv");
    const summaryRows = readCsv("2560_paper_summary.csv");
    const pending = open.filter((t) => t.status === "PENDING");
    const active = open.filter((t) => t.status === "OPEN");
    const closedReturns = closed.map((t) => toNum(t.return_pct)).filter((n) => Number.isFinite(n));
    const wins = closedReturns.filter((n) => n > 0);
    const losses = closedReturns.filter((n) => n <= 0);
    const grossWin = wins.reduce((a, b) => a + b, 0);
    const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0));
    const summary = {
      total: trades.length,
      pending: pending.length,
      open: active.length,
      closed: closed.length,
      winRate: closedReturns.length ? wins.length / closedReturns.length : null,
      avgReturn: closedReturns.length ? closedReturns.reduce((a, b) => a + b, 0) / closedReturns.length : null,
      profitFactor: grossLoss > 0 ? grossWin / grossLoss : null,
      source: "reports/paper",
      mode: "EOD / next-day open paper trading",
      rule: "risk_30d：停損 -8%｜停利 +15%｜最多 30 個交易日",
      universe: "AAPL, MSFT, GOOGL, META, AMZN, NFLX",
      updatedAt: new Date().toISOString(),
      rawSummary: summaryRows[0] || null,
    };
    res.status(200).json({ ok: true, summary, pending, open: active, closed: closed.slice(-20).reverse() });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
}
