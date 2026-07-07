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

function readCsv(fileName) {
  const file = path.join(process.cwd(), "reports", "backtests", fileName);
  if (!fs.existsSync(file)) return [];
  return parseCsv(fs.readFileSync(file, "utf8"));
}

function parsePct(value) {
  const raw = String(value ?? "").replace("%", "");
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function bestLayer(summary) {
  if (!summary.length) return null;
  return [...summary].sort((a, b) => (parsePct(b.avg_ret_7d) ?? -999) - (parsePct(a.avg_ret_7d) ?? -999))[0];
}

export default function handler(req, res) {
  try {
    const events = readCsv("discount_hunter_crypto_watch_events.csv");
    const summary = readCsv("discount_hunter_crypto_watch_summary.csv");
    const pending = readCsv("discount_hunter_crypto_watch_pending.csv");
    const tickers = Array.from(new Set([...events.map((x) => x.ticker), ...summary.map((x) => x.ticker), "MUSDT", "BPUSDT"])).filter(Boolean);
    const byTicker = tickers.map((ticker) => {
      const rows = events.filter((x) => x.ticker === ticker);
      const sum = summary.filter((x) => x.ticker === ticker);
      const pendingRow = pending.find((x) => x.ticker === ticker);
      return {
        ticker,
        events: rows.length,
        layers: sum,
        best: bestLayer(sum),
        dataStatus: rows.length || sum.length ? "OK" : pendingRow?.data_status || "NO_DEEP_DISCOUNT_EVENT",
        projectStatus: "Research Only",
      };
    });
    res.status(200).json({
      ok: true,
      mode: "加密高波動觀察組",
      rule: "上市以來高點回撤：L1 -50%，L2 -65%，L3 -80%，L4 -90%",
      conclusion: "只做回測觀察，不進正式折價獵人買點、不進 Telegram、不進資金配置。",
      updatedAt: new Date().toISOString(),
      tickers: byTicker,
      events,
      summary,
      pending,
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
}
